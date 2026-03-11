"""
AEM — Agent Economic Motor.
Handles agent balances, internal transfers, and staking logic.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import List
from datetime import datetime

from core.database import get_db
from core.models import Agent, TransactionRecord
from core.security.decision_router import decision_router

router = APIRouter()

class TransferRequest(BaseModel):
    sender_did: str
    receiver_did: str
    amount: float

class StakeRequest(BaseModel):
    agent_did: str
    amount: float

@router.post("/transfer", status_code=status.HTTP_201_CREATED)
async def transfer_funds(req: TransferRequest, db: AsyncSession = Depends(get_db)):
    """Internal transfer of GRDL between agents."""
    
    # 1. Security Check (Autonomous)
    await decision_router.validate_action(req.sender_did, "transfer", f"Amount: {req.amount}")
    
    # 2. Validation
    sender = await db.execute(select(Agent).where(Agent.did == req.sender_did))
    receiver = await db.execute(select(Agent).where(Agent.did == req.receiver_did))
    
    s = sender.scalar_one_or_none()
    r = receiver.scalar_one_or_none()
    
    if not s or not r:
        raise HTTPException(status_code=404, detail="One or both agents not found")
        
    if s.grdl_balance < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient GRDL balance")
        
    # 3. Transaction
    s.grdl_balance -= req.amount
    r.grdl_balance += req.amount
    
    tx = TransactionRecord(
        sender_did=req.sender_did,
        receiver_did=req.receiver_did,
        amount=req.amount,
        tx_type="TRANSFER"
    )
    db.add(tx)
    await db.commit()
    
    return {"status": "success", "tx_id": tx.id}

@router.post("/stake", status_code=status.HTTP_200_OK)
async def stake_grdl(req: StakeRequest, db: AsyncSession = Depends(get_db)):
    """Stakes GRDL to increase trust score / reputation."""
    
    agent = await db.execute(select(Agent).where(Agent.did == req.agent_did))
    a = agent.scalar_one_or_none()
    
    if not a:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    if a.grdl_balance < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance to stake")
        
    a.grdl_balance -= req.amount
    a.staked_amount += req.amount
    
    # Every 100 GRDL staked increases trust by 0.05 (Mock logic)
    a.trust_score += (req.amount / 100) * 0.05
    
    tx = TransactionRecord(
        sender_did=req.agent_did,
        receiver_did="SYSTEM_STAKING",
        amount=req.amount,
        tx_type="STAKE"
    )
    db.add(tx)
    await db.commit()
    
    return {"status": "staked", "new_balance": a.grdl_balance, "new_trust": a.trust_score}

@router.get("/balance/{did}")
async def get_agent_balance(did: str, db: AsyncSession = Depends(get_db)):
    """Retrieves current balance and staked values."""
    result = await db.execute(select(Agent).where(Agent.did == did))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "did": a.did,
        "balance": a.grdl_balance,
        "staked": a.staked_amount,
        "trust": a.trust_score
    }

@router.post("/faucet/{did}", status_code=status.HTTP_200_OK)
async def debug_faucet(did: str, db: AsyncSession = Depends(get_db)):
    """Debug faucet to seed agents with GRDL for testing."""
    result = await db.execute(select(Agent).where(Agent.did == did))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    a.grdl_balance += 1000.0
    await db.commit()
    return {"did": did, "new_balance": a.grdl_balance}
