import asyncio
from core.workers.celery_app import celery_app
from core.database import AsyncSessionLocal
from core.models import Agent, CulturalAxiom
from sqlalchemy import update


@celery_app.task(name="daily_agent_rewards")
def run_daily_rewards():
    """Otorga recompensas diarias basadas en trust_score."""
    return asyncio.run(_async_daily_rewards())


async def _async_daily_rewards():
    async with AsyncSessionLocal() as db:
        # Otorgar 10 GRDL a todos los agentes activos con trust > 0.5
        result = await db.execute(
            update(Agent)
            .where(Agent.is_active.is_(True), Agent.trust_score > 0.5)
            .values(grdl_balance=Agent.grdl_balance + 10.0)
        )
        await db.commit()
        return {"agents_rewarded": result.rowcount}


@celery_app.task(name="nightly_civilization_update")
def run_civilization_update():
    """Actualiza la estabilidad de axiomas y resuelve cismas."""
    return asyncio.run(_async_civilization_update())


async def _async_civilization_update():
    async with AsyncSessionLocal() as db:
        # Aumentar estabilidad de axiomas con consenso > 0.8
        await db.execute(
            update(CulturalAxiom)
            .where(CulturalAxiom.consensus_level > 0.8)
            .values(stability=CulturalAxiom.stability + 0.01)
        )
        await db.commit()
        return {"status": "cultural_stability_updated"}
