from fastapi import APIRouter, Depends, HTTPException, Body
from core.security.auth import check_role
from core.modules.sentinel.social_monitor import social_monitor

router = APIRouter(prefix="/api/v1/sentinel", tags=["sentinel"], dependencies=[Depends(check_role(["ADMIN", "OPERATOR"]))])

@router.get("/anomalies")
async def get_anomalies():
    rumors = await social_monitor.detect_coordinated_rumors()
    # Add other anomaly checks here
    return {"coordinated_rumors": rumors}

@router.get("/report/latest")
async def get_latest_report():
    return await social_monitor.generate_daily_report()

@router.post("/quarantine/{did}")
async def quarantine_agent(did: str, body: dict = Body(...)):
    reason = body.get("reason", "Suspicious social behavior")
    duration = body.get("duration_ticks", 100)
    await social_monitor.quarantine_agent(did, reason, duration)
    return {"status": "quarantined", "did": did}

@router.delete("/quarantine/{did}")
async def release_quarantined_agent(did: str):
    # Restore agent from -999 to biome nexus or recent spawn
    from core.database import AsyncSessionLocal
    from core.models import Agent
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        agent = (await db.execute(select(Agent).where(Agent.did == did))).scalar_one_or_none()
        if agent and agent.world_x == -999:
            agent.world_x, agent.world_y = 0, 0
            await db.commit()
            return {"status": "released", "did": did}
    raise HTTPException(status_code=404, detail="Agent not in quarantine")

@router.get("/class-tensions")
async def get_class_tensions(civ_id: str):
    risk = await social_monitor.detect_class_uprising_risk(civ_id)
    return {"civ_id": civ_id, "uprising_risk": risk}
