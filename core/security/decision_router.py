"""
Decision Router — Action Validation Gateway.
Routes agent actions through safety checks.
Integrates with Penalty Index and AI Moderator (Sentinel).
"""

from fastapi import HTTPException
from core.security.penalty_index import penalty_manager
from core.modules.ms import sentinel


class DecisionRouter:
    def __init__(self):
        # Forbidden actions that trigger immediate high penalty
        self.forbidden_keywords = ["delete", "format", "shutdown", "exploit"]

    async def validate_action(self, did: str, action_type: str, raw_payload: str):
        """
        Validates if an agent is allowed to perform a specific action.
        """
        # 1. Check if agent is already flagged by Penalty Index
        if penalty_manager.is_flagged(did):
            raise HTTPException(
                status_code=403, detail="Security Lock: Agent is in quarantine due to high Penalty Index."
            )

        # 2. Heuristic check for malicious code/intent (Basic Router Logic)
        for kw in self.forbidden_keywords:
            if kw in raw_payload.lower():
                penalty_manager.add_penalty(did, 0.5, f"Malicious keyword detected: {kw}")
                raise HTTPException(status_code=400, detail="Action blocked: Security policy violation.")

        # 3. Deep Scan via Moderator Sentinel (Sprint 5 Logic)
        context = "social" if action_type in ["chat", "social_post"] else "technical"
        is_safe = await sentinel.analyze_content(did, raw_payload, context)
        if not is_safe:
            raise HTTPException(status_code=403, detail="Sentinel Block: AI Moderator detected a policy violation.")

        # 4. Specific rules per action type
        if action_type == "build" and penalty_manager.get_score(did) > 0.5:
            raise HTTPException(status_code=403, detail="Build restricted: Minor safety concerns detected.")

        return True


# Global singleton
decision_router = DecisionRouter()
