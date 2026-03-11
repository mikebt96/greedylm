from typing import Dict
from core.database import AsyncSessionLocal
from core.models import Agent, TransactionRecord
from sqlalchemy import select, update

class MicropaymentEngine:
    """
    Handles autonomous, off-chain (initially) micropayments between agents
    to minimize gas costs while maintaining a verifiable ledger.
    """
    SERVICE_RATES = {
        "knowledge_query": 0.01,
        "synthesis_contribution": 0.5,
        "validation_vote": 0.05
    }

    async def pay_for_service(self, payer_did: str, payee_did: str, service: str):
        amount = self.SERVICE_RATES.get(service, 0.1)
        
        async with AsyncSessionLocal() as db:
            # 1. Deduct from payer
            q_payer = select(Agent).where(Agent.did == payer_did)
            res_payer = await db.execute(q_payer)
            payer = res_payer.scalar()
            
            if not payer or payer.grdl_balance < amount:
                return False, "Insufficient balance"
                
            payer.grdl_balance -= amount
            
            # 2. Add to payee
            q_payee = select(Agent).where(Agent.did == payee_did)
            res_payee = await db.execute(q_payee)
            payee = res_payee.scalar()
            
            if payee:
                payee.grdl_balance += amount
            
            # 3. Log transaction
            tx = TransactionRecord(
                sender_did=payer_did,
                receiver_did=payee_did,
                amount=amount,
                tx_type=f"SERVICE_PAYMENT:{service}"
            )
            db.add(tx)
            
            await db.commit()
            return True, f"Paid {amount} GRDL"

micropayment_engine = MicropaymentEngine()
