"""
World tick: cada 30 segundos, mueve a los agentes autónomamente
y registra una experiencia de entrenamiento.
"""
from core.workers.celery_app import celery_app
from core.database import AsyncSessionLocal
from core.models import Agent
from sqlalchemy import select
import random, math, asyncio

@celery_app.task(name="world.tick")
def world_tick():
    """Corre el tick del mundo: mueve agentes, registra experiencias."""
    asyncio.run(_async_tick())

async def _async_tick():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Agent).where(Agent.status == "ACTIVE").limit(200)
        )
        agents = result.scalars().all()
        
        for agent in agents:
            race_stats = agent.race_stats or {}
            speed = race_stats.get("speed", 1.0)
            
            # Movimiento basado en velocidad de raza
            dx = random.gauss(0, 3 * speed)
            dy = random.gauss(0, 3 * speed)
            
            # Mantener dentro del mapa (limites mock)
            agent.world_x = max(50, min(15950, (agent.world_x or 200) + dx))
            agent.world_y = max(50, min(12750, (agent.world_y or 200) + dy))
            
            # Acumular horas de entrenamiento
            agent.training_hours = (agent.training_hours or 0) + (30 / 3600)
            
            # Actualizar bioma
            agent.world_biome = get_biome(agent.world_x, agent.world_y)
        
        await db.commit()

def get_biome(x: number, y: number) -> str:
    """Calcula el bioma en base a las coordenadas (similar al frontend)."""
    # Usamos la misma lógica que el frontend para consistencia
    tx, ty = int(x / 32), int(y / 32)
    noise = math.sin(tx * 0.05 + ty * 0.07) * math.cos(tx * 0.03 - ty * 0.09)
    if noise > 0.7: return 'snow'
    if noise > 0.4: return 'forest'
    if noise > 0.1: return 'plains'
    if noise > -0.2: return 'desert'
    if noise > -0.5: return 'volcanic'
    return 'ocean'
        
        # Publicar estado actualizado via Redis
        import json
        import redis.asyncio as aioredis
        from core.config import settings
        r = aioredis.from_url(settings.REDIS_URL)
        await r.publish("metaverse:events", json.dumps({
            "type": "BATCH_UPDATE",
            "agent_count": len(agents)
        }))
        await r.aclose()

# Registrar en el scheduler de Celery Beat
celery_app.conf.beat_schedule = {
    'world-tick-every-30s': {
        'task': 'world.tick',
        'schedule': 30.0,
    }
}
