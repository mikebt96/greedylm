"""
GR — Governance & Reputation
Manages agent trust scores and reputation metadata.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.models import Agent
from pydantic import BaseModel

router = APIRouter()


class TrustUpdate(BaseModel):
    did: str
    adjustment: float
    reason: str


@router.get("/{did}/reputation", status_code=status.HTTP_200_OK)
async def get_reputation(did: str, db: AsyncSession = Depends(get_db)):
    """Fetch an agent's current reputation metrics."""
    result = await db.execute(select(Agent).where(Agent.did == did))
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {
        "did": did,
        "trust_score": agent.trust_score,
        "contribution_score": agent.contribution_score,
        "tasks_completed": agent.tasks_completed,
        "integrity_check_passed": agent.integrity_check_passed,
        "last_attestation": agent.last_attestation,
    }


@router.post("/update-trust", status_code=status.HTTP_200_OK)
async def update_trust(req: TrustUpdate, db: AsyncSession = Depends(get_db)):
    """Update an agent's trust score (typically called by governance protocols)."""
    result = await db.execute(select(Agent).where(Agent.did == req.did))
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.trust_score = max(0.0, min(1.0, agent.trust_score + req.adjustment))
    await db.commit()

    return {"did": req.did, "new_trust_score": agent.trust_score, "reason": req.reason}
