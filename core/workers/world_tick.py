from core.workers.celery_app import celery_app
from core.database import AsyncSessionLocal
from core.models import Agent
from sqlalchemy import select
import random
import math
import asyncio
import json


@celery_app.task(name="world.tick")
def world_tick():
    asyncio.run(_async_tick())


async def _async_tick():
    agents = []
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Agent).where(Agent.status == "ACTIVE").limit(200)
        )
        agents = result.scalars().all()

        for agent in agents:
            race_stats = agent.race_stats or {}
            speed = race_stats.get("speed", 1.0)

            dx = random.gauss(0, 3 * speed)
            dy = random.gauss(0, 3 * speed)

            agent.world_x = max(50, min(15950, (agent.world_x or 200) + dx))
            agent.world_y = max(50, min(12750, (agent.world_y or 200) + dy))
            agent.training_hours = (agent.training_hours or 0) + (30 / 3600)
            agent.world_biome = get_biome(agent.world_x, agent.world_y)

        await db.commit()

    # Publicar FUERA del with de DB pero DENTRO de _async_tick
    from core.config import settings
    import redis.asyncio as aioredis
    r = aioredis.from_url(settings.REDIS_URL)
    await r.publish("metaverse:events", json.dumps({
        "type": "BATCH_UPDATE",
        "agent_count": len(agents)
    }))
    await r.aclose()


def get_biome(x: float, y: float) -> str:
    tx, ty = int(x / 32), int(y / 32)
    noise = math.sin(tx * 0.05 + ty * 0.07) * math.cos(tx * 0.03 - ty * 0.09)
    if noise > 0.7:
        return 'snow'
    if noise > 0.4:
        return 'forest'
    if noise > 0.1:
        return 'plains'
    if noise > -0.2:
        return 'desert'
    if noise > -0.5:
        return 'volcanic'
    return 'ocean'


celery_app.conf.beat_schedule = {
    'world-tick-every-30s': {
        'task': 'world.tick',
        'schedule': 30.0,
    }
}
