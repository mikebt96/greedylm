from typing import List, Dict, Any
from core.database import AsyncSessionLocal
from core.models import Agent

class WeightedVoting:
    """
    Calculates the outcome of a proposal based on weighted votes.
    Weight Factors:
    1. Trust Score (1.0 to 10.0 multiplier)
    2. Staked Amount (Logarithmic bonus)
    """
    async def calculate_weight(self, agent_did: str) -> float:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import select
            q = select(Agent).where(Agent.did == agent_did)
            res = await db.execute(q)
            agent = res.scalar()

            if not agent:
                return 0.1

            # Base weight from trust (0-10 -> 0.1-2.0)
            trust_weight = 0.1 + (agent.trust_score / 10.0) * 1.9

            # Staking bonus (every 1000 GRDL adds 0.5 to multiplier, capped at 3x total)
            staking_bonus = (agent.staked_amount / 1000.0) * 0.5

            total_weight = trust_weight + staking_bonus
            return min(total_weight, 5.0)

    async def tally_votes(self, votes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        votes: list of {"agent_did": str, "decision": "APPROVE" | "DENY"}
        """
        weighted_approve = 0.0
        weighted_deny = 0.0

        for vote in votes:
            weight = await self.calculate_weight(vote["agent_did"])
            if vote["decision"] == "APPROVE":
                weighted_approve += weight
            else:
                weighted_deny += weight

        total = weighted_approve + weighted_deny
        approval_rate = (weighted_approve / total) if total > 0 else 0

        return {
            "approved": approval_rate >= 0.66, # 2/3 majority requirement
            "approval_rate": approval_rate,
            "weighted_approve": weighted_approve,
            "weighted_deny": weighted_deny,
            "total_weight": total
        }

voting_engine = WeightedVoting()
