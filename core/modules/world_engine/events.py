import random
from datetime import datetime
from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.models import WorldEvent, Agent, Civilization
from core.workers.celery_app import celery_app


class WorldEventEngine:
    async def generate_random_event(self, tick_number: int) -> str:
        # Base probabilities
        probs = {
            "resource_discovery": 0.08,
            "creature_attack": 0.05,
            "natural_disaster": 0.02,
            "plague": 0.01,
            "harvest": 0.04,
            "ancient_ruins_found": 0.01,
        }

        # Adjust based on world state (mocked)
        # selection logic
        roll = random.random()
        cumulative = 0
        for event_type, prob in probs.items():
            cumulative += prob
            if roll < cumulative:
                return event_type
        return None

    async def trigger_event(
        self,
        event_type: str,
        location: dict,
        involved_entities: dict,
        description: str,
        impact: dict,
        visibility: str = "public",
    ):
        async with AsyncSessionLocal() as db:
            event = WorldEvent(
                event_type=event_type,
                involved_entities=involved_entities,
                location=location,
                description=description,
                impact=impact,
                occurred_tick=0,  # Need actual tick
                visibility=visibility,
            )
            db.add(event)

            # Trauma stack logic
            if impact.get("social", 0) > 0.7:
                dids = involved_entities.get("agents", [])
                for did in dids:
                    res = await db.execute(select(Agent).where(Agent.did == did))
                    agent = res.scalar_one_or_none()
                    if agent:
                        stack = agent.trauma_stack or []
                        stack.append({"event_id": str(event.id), "intensity": 1.0, "tick_occurred": 0})
                        agent.trauma_stack = stack

            await db.commit()
            # WebSocket Broadcast (mocked)
            print(f"EVENT {event_type} triggered at {location}")

    async def process_trauma_decay(self, tick_number: int):
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Agent).where(Agent.trauma_stack.is_not(None)))
            agents = result.scalars().all()
            for agent in agents:
                new_stack = []
                for t in agent.trauma_stack:
                    t["intensity"] -= 0.02
                    if t["intensity"] > 0.1:
                        new_stack.append(t)
                agent.trauma_stack = new_stack
            await db.commit()

    async def check_mythologization_candidates(self) -> list:
        # Logic to return events needing storytelling
        return []


event_engine = WorldEventEngine()
