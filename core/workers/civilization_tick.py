import asyncio
from datetime import datetime
from sqlalchemy import select, func
from core.database import AsyncSessionLocal
from core.models import Agent, Civilization, WorldEvent, WorldChunk
from core.modules.world_engine.social_dynamics import social_dynamics
from core.modules.world_engine.events import event_engine
from core.workers.celery_app import celery_app


@celery_app.task(name="civilization.tick")
def civilization_tick():
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_async_civ_tick())
    else:
        loop.run_until_complete(_async_civ_tick())


async def _async_civ_tick():
    async with AsyncSessionLocal() as db:
        civs_res = await db.execute(select(Civilization).where(Civilization.is_active))
        civilizations = civs_res.scalars().all()

        for civ in civilizations:
            # 1. Update collective ESV and values
            members_res = await db.execute(select(Agent).where(Agent.civilization_id == civ.id))
            members = members_res.scalars().all()
            if not members:
                continue

            avg_esv = [0.0] * 8
            avg_values = [0.0] * 6  # Assuming 6 dimensions for values

            for m in members:
                esv = m.emotional_state_vector or [0.5] * 8
                vvec = m.values_vector or [0.5] * 6
                for i in range(8):
                    avg_esv[i] += esv[i]
                for i in range(6):
                    avg_values[i] += vvec[i]

            count = len(members)
            civ.collective_esv = [x / count for x in avg_esv]
            civ.dominant_values = [x / count for x in avg_values]
            civ.population = count

            # 2. Social Structure
            if civ.population > 50:
                civ.social_structure = "democratic"
            elif any(m.reputation_score > 0.9 for m in members):
                civ.social_structure = "feudal"
            else:
                civ.social_structure = "tribal"

            # 3. Territory and disputes
            # Check chunks claimed by this civ
            chunks_res = await db.execute(select(WorldChunk).where(WorldChunk.claimed_by == civ.id))
            chunks = chunks_res.scalars().all()

            # 4. Production
            # Simplified: generate 10 gold per chunk
            civ.treasury_balance += len(chunks) * 10.0

            # 5. Generational shift
            avg_age = sum(m.age_ticks for m in members) / count
            if avg_age > 1000 * civ.generation:
                civ.generation += 1
                event = WorldEvent(
                    event_type="generational_shift",
                    involved_entities={"civilizations": [str(civ.id)]},
                    description=f"A new generation has risen in {civ.name}.",
                    impact={"social": 0.5},
                    visibility="public",
                )
                db.add(event)

            await db.commit()

        # Global World Event checks
        await event_engine.process_trauma_decay(0)
