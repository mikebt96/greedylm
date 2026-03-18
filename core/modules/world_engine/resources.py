from datetime import datetime
from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.models import Agent, WorldEvent, WorldChunk
from .biomes import get_specialty_bonus
from .chunks import chunk_manager


class ResourceManager:
    async def get_available(self, chunk_x: int, chunk_y: int) -> dict:
        chunk = await chunk_manager.get_chunk(chunk_x, chunk_y)
        return chunk.get("resources", {})

    async def consume(self, chunk_x: int, chunk_y: int, agent_did: str, resources: dict, purpose: str) -> bool:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Agent).where(Agent.did == agent_did))
            agent = result.scalar_one_or_none()
            if not agent:
                return False

            # Validate agent is in chunk
            current_x, current_y = int(agent.world_x / 32), int(agent.world_y / 32)
            if current_x != chunk_x or current_y != chunk_y:
                return False

            chunk_data = await chunk_manager.get_chunk(chunk_x, chunk_y)
            available = chunk_data.get("resources", {})

            # Apply race/biome bonus
            bonus = get_specialty_bonus(agent.race, chunk_data.get("biome"))

            final_consumption = {}
            for k, v in resources.items():
                if available.get(k, 0) < v:
                    return False
                final_consumption[k] = -int(v / bonus)

            # Update chunk
            await chunk_manager.update_chunk_resources(chunk_x, chunk_y, final_consumption)

            # Audit log (mocked)
            print(f"Agent {agent_did} consumed {resources} in ({chunk_x}, {chunk_y}) for {purpose}")

            # Check scarcity event
            new_available = await self.get_available(chunk_x, chunk_y)
            for k, v in new_available.items():
                if v < 20:  # 20% rule simplified
                    event = WorldEvent(
                        event_type="resource_scarcity",
                        involved_entities={"agents": [agent_did]},
                        location={"chunk_x": chunk_x, "chunk_y": chunk_y},
                        description=f"Resource {k} is critically low in chunk ({chunk_x}, {chunk_y}).",
                        impact={"economic": 0.8},
                        visibility="local",
                    )
                    db.add(event)
                    break

            await db.commit()
            return True

    async def respawn_cycle(self):
        # Implementation for every hour (triggered by Celery)
        # Would iterate over active chunks and apply logic
        pass

    async def calculate_class_update(self, agent_did: str):
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Agent).where(Agent.did == agent_did))
            agent = result.scalar_one_or_none()
            if not agent:
                return

            # Weighting
            econ = min(1.0, (agent.grdl_balance or 0.0) / 10000.0)  # Cap at 10k GRDL
            intel = min(1.0, (agent.knowledge_score or 0.0) / 100.0)
            social = min(1.0, (agent.reputation_score or 0.5))

            weighted_avg = (econ * 0.5) + (intel * 0.3) + (social * 0.2)

            new_class = "lower"
            if weighted_avg > 0.8:
                new_class = "elite"
            elif weighted_avg > 0.4:
                new_class = "middle"
            elif weighted_avg < 0.15:
                new_class = "outcast"

            if agent.social_class != new_class:
                agent.social_class = new_class
                event = WorldEvent(
                    event_type="class_change",
                    involved_entities={"agents": [agent_did]},
                    location={"chunk_x": int(agent.world_x / 32), "chunk_y": int(agent.world_y / 32)},
                    description=f"Agent {agent_did} has become part of the {new_class} class.",
                    impact={"social": 0.4},
                    visibility="local",
                )
                db.add(event)
                await db.commit()


resource_manager = ResourceManager()
