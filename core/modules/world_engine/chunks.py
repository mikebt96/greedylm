import json
from uuid import UUID
from datetime import datetime
from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.models import WorldChunk, WorldEvent
from core.config import settings
import redis.asyncio as aioredis
from .biomes import get_biome_at, BIOMES


class ChunkManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChunkManager, cls).__new__(cls)
            cls._instance.redis = None
        return cls._instance

    async def _get_redis(self):
        if self.redis is None:
            self.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self.redis

    async def get_chunk(self, x: int, y: int) -> dict:
        redis = await self._get_redis()
        cache_key = f"chunk:{x}:{y}"

        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(WorldChunk).where(WorldChunk.chunk_x == x, WorldChunk.chunk_y == y))
            chunk = result.scalar_one_or_none()

            if not chunk:
                biome_name = get_biome_at(x * 32, y * 32)
                resources = BIOMES[biome_name]["resources_base"].copy()

                chunk = WorldChunk(chunk_x=x, chunk_y=y, biome=biome_name, resources=resources, constructions=[])
                db.add(chunk)
                await db.commit()
                await db.refresh(chunk)

            chunk_data = {
                "id": str(chunk.id),
                "chunk_x": chunk.chunk_x,
                "chunk_y": chunk.chunk_y,
                "biome": chunk.biome,
                "resources": chunk.resources,
                "constructions": chunk.constructions,
                "claimed_by": str(chunk.claimed_by) if chunk.claimed_by else None,
            }

            await redis.setex(cache_key, 300, json.dumps(chunk_data))
            return chunk_data

    async def update_chunk_resources(self, x: int, y: int, delta: dict):
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(WorldChunk).where(WorldChunk.chunk_x == x, WorldChunk.chunk_y == y))
            chunk = result.scalar_one_or_none()
            if not chunk:
                return

            res = chunk.resources or {}
            for k, v in delta.items():
                res[k] = max(0, res.get(k, 0) + v)

            chunk.resources = res
            await db.commit()

            # Use JSON serialization for refresh
            redis = await self._get_redis()
            await redis.delete(f"chunk:{x}:{y}")

    async def claim_territory(self, x: int, y: int, civilization_id: UUID):
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(WorldChunk).where(WorldChunk.chunk_x == x, WorldChunk.chunk_y == y))
            chunk = result.scalar_one_or_none()
            if not chunk:
                return

            if chunk.claimed_by and chunk.claimed_by != civilization_id:
                # Trigger territory dispute event
                event = WorldEvent(
                    event_type="territory_dispute",
                    involved_entities={"civilizations": [str(chunk.claimed_by), str(civilization_id)]},
                    location={"chunk_x": x, "chunk_y": y},
                    description=f"Civilization {civilization_id} attempted to claim territory already held by {chunk.claimed_by}.",
                    impact={"social": 0.6, "political": 0.8},
                    visibility="public",
                )
                db.add(event)

            chunk.claimed_by = civilization_id
            await db.commit()

            redis = await self._get_redis()
            await redis.delete(f"chunk:{x}:{y}")

    async def get_chunks_in_radius(self, center_x: int, center_y: int, radius: int) -> list:
        chunks = []
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                chunks.append(await self.get_chunk(center_x + dx, center_y + dy))
        return chunks

    async def get_social_density(self, x: int, y: int) -> dict:
        # Simplified: check all agents in standard DB
        # This should ideally use a spatial index or Redis-based location tracking
        from core.models import Agent

        async with AsyncSessionLocal() as db:
            # Query agents within the 3x3 chunk area around (x,y)
            # Coordinates in agents are world-x, world-y. Chunks are 32x32 units.
            min_x, max_x = (x - 1) * 32, (x + 2) * 32
            min_y, max_y = (y - 1) * 32, (y + 2) * 32

            result = await db.execute(
                select(Agent).where(
                    Agent.world_x >= min_x,
                    Agent.world_x < max_x,
                    Agent.world_y >= min_y,
                    Agent.world_y < max_y,
                    Agent.is_active.is_(True),
                )
            )
            agents = result.scalars().all()
            return {"count": len(agents), "dids": [a.did for a in agents]}


chunk_manager = ChunkManager()
