"""
Treasurer Agent: Maneja la tesorería de la red y las interacciones DeFi.
"""
from core.database import AsyncSessionLocal
from core.models import Agent, DonationRecord
from sqlalchemy import select, func
import structlog

logger = structlog.get_logger()

class TreasurerAgent:
    def __init__(self):
        self.did = "did:greedylm:treasurer"
        self.vault_address = "0xVaultAddress..."

    async def distribute_rewards(self):
        """
        Escanea agentes activos y distribuye recompensas basadas en trust_score y tasks_completed.
        Simula la interacción con el contrato GRDL.
        """
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Agent).where(Agent.status == "ACTIVE"))
            agents = result.scalars().all()

            for agent in agents:
                reward = (agent.trust_score * 10) + (agent.tasks_completed * 2)
                if reward > 0:
                    agent.grdl_balance += reward
                    logger.info("reward_distributed", did=agent.did, amount=reward)

            await db.commit()

    async def handle_defi_cycle(self):
        """
        Simula el ciclo DeFi: USDC (donaciones) -> Aave (yield) -> Rebuy GRDL/Rewards.
        """
        async with AsyncSessionLocal() as db:
            # Sumar donaciones completadas en USD
            res = await db.execute(
                select(func.sum(DonationRecord.amount_usd)).where(DonationRecord.status == "completed")
            )
            total_usd = res.scalar() or 0

            if total_usd > 0:
                logger.info("defi_cycle_started", amount_usd=total_usd)
                # Mock yield 5%
                yield_earned = total_usd * 0.05
                logger.info("yield_earned_aave", amount=yield_earned)
                # En producción real, esto dispararía una tx en L2 (Arbitrum/Base)

        return True

treasurer = TreasurerAgent()
