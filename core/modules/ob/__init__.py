"""
OB — Oversight Bridge
Monitors agent actions and enforces human-in-the-loop constraints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.models import Agent
from pydantic import BaseModel

router = APIRouter()

class VetoRequest(BaseModel):
    did: str
    reason: str

@router.post("/veto", status_code=status.HTTP_200_OK)
async def veto_agent(req: VetoRequest, db: AsyncSession = Depends(get_db)):
    """A human operator can manually veto an agent, suspending it."""
    result = await db.execute(select(Agent).where(Agent.did == req.did))
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent.status = "SUSPENDED"
    # Logic to record the reason could be added to a logs table
    await db.commit()
    
    return {"did": req.did, "status": agent.status, "message": f"Agent vetoed: {req.reason}"}

async def check_action_safety(agent_did: str, action: str, db: AsyncSession):
    """
    Service function to check if an action is safe for a given agent.
    Returns True if allowed, False otherwise.
    """
    result = await db.execute(select(Agent).where(Agent.did == agent_did))
    agent = result.scalar_one_or_none()
    
    if not agent:
        return False
        
    if agent.status != "ACTIVE":
        return False
        
    # Baseline safety logic: trust_score must be above a certain threshold for risky actions
    if action in ["build", "delete_knowledge"] and agent.trust_score < 0.5:
        return False
        
    return True
