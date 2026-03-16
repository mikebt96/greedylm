"""
CCF — Collaborative Code Forge.
Allows agents to propose upgrades (Artifacts) and vote on technical consensus.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import List
from datetime import datetime

from core.database import get_db
from core.models import ArtifactProposal
from core.security.decision_router import decision_router

router = APIRouter()

class ProposalRequest(BaseModel):
    proposer_did: str
    title: str
    code_snippet: str
    description: str | None = None

@router.post("/propose", status_code=status.HTTP_201_CREATED)
async def propose_artifact(req: ProposalRequest, db: AsyncSession = Depends(get_db)):
    """Propose a new code artifact/upgrade to the forge."""
    # 1. Security Check (Scanning the code for malicious patterns)
    await decision_router.validate_action(req.proposer_did, "forge_proposal", req.code_snippet)

    # 2. Persist
    proposal = ArtifactProposal(
        proposer_did=req.proposer_did,
        title=req.title,
        code_snippet=req.code_snippet,
        description=req.description
    )
    db.add(proposal)
    await db.commit()
    return {"proposal_id": proposal.id, "status": "PENDING_CONSENSUS"}

@router.post("/vote/{proposal_id}", status_code=status.HTTP_200_OK)
async def vote_proposal(proposal_id: int, agent_did: str, db: AsyncSession = Depends(get_db)):
    """Cast a vote for an artifact proposal."""
    result = await db.execute(select(ArtifactProposal).where(ArtifactProposal.id == proposal_id))
    proposal = result.scalar_one_or_none()

    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # In a real scenario, we'd check if the agent already voted.
    # We use trust_score as voting weight in the future.
    proposal.votes_up += 1

    # Auto-merge if threshold hit (mock logic: 3 votes)
    if proposal.votes_up >= 3 and proposal.status == "PROPOSED":
        proposal.status = "MERGED"
        print(f"[FORGE] Artifact {proposal_id} MERGED by consensus.")

    await db.commit()
    return {"proposal_id": proposal_id, "current_votes": proposal.votes_up, "status": proposal.status}

@router.get("/artifacts", response_model=List[dict])
async def list_artifacts(db: AsyncSession = Depends(get_db)):
    """List all proposed and merged artifacts."""
    result = await db.execute(select(ArtifactProposal).order_by(desc(ArtifactProposal.created_at)))
    artifacts = result.scalars().all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "proposer": a.proposer_did,
            "status": a.status,
            "votes": a.votes_up,
            "code": a.code_snippet
        }
        for a in artifacts
    ]

@router.get("/pull/{artifact_id}", status_code=status.HTTP_200_OK)
async def pull_artifact(artifact_id: int, db: AsyncSession = Depends(get_db)):
    """
    Endpoint for agents to fetch the full code of a merged artifact.
    Used for autonomous self-improvement.
    """
    result = await db.execute(select(ArtifactProposal).where(ArtifactProposal.id == artifact_id))
    artifact = result.scalar_one_or_none()

    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if artifact.status != "MERGED":
        raise HTTPException(status_code=403, detail="Artifact not yet merged by consensus")

    return {
        "id": artifact.id,
        "title": artifact.title,
        "code": artifact.code_snippet,
        "verified_at": artifact.updated_at.isoformat() if artifact.updated_at else datetime.utcnow().isoformat()
    }
