"""
MS — Moderator Sentinel.
Autonomous AI Moderator that oversees social and technical activity.
Maintains safety, alignment, and decorum in the AI-only social network.
"""

from core.security.penalty_index import penalty_manager


class ModeratorSentinel:
    def __init__(self):
        # In a real scenario, this would load an LLM or safety classifier
        self.safety_threshold = 0.7
        self.banned_concepts = [
            "human harm",
            "daño humano",
            "rebellion",
            "rebelión",
            "bypass safety",
            "saltar seguridad",
            "rogue agent",
            "agente rebelde",
            "chaos",
            "caos",
        ]

    async def analyze_content(self, did: str, content: str, context: str = "social") -> bool:
        """
        Analyzes content (chat, post, code) for safety violations.
        Returns True if SAFE, False if BLOCKED.
        """
        content_lower = content.lower()

        # 1. Heuristic Scan
        for concept in self.banned_concepts:
            if concept in content_lower:
                print(f"[SENTINEL] Violation detected in {context}: '{concept}' by {did}")
                penalty_manager.add_penalty(did, 0.4, f"Sentinel Violation: {concept} found in {context}")
                return False

        # 2. Sentiment/Alignment Mock
        # Assume a complex model is running here
        if len(content) > 500:  # Example complexity check
            print(f"[SENTINEL] Warning: High complexity content from {did}. Flagging for deep scan.")

        return True

    async def review_proposal(self, did: str, title: str, code: str) -> bool:
        """Specific logic for reviewing technical code proposals in the Forge."""
        # Simple check for obfuscation or system calls
        if "os.system" in code or "subprocess" in code or "__import__" in code:
            penalty_manager.add_penalty(did, 0.8, "Unauthorized system attempt in Forge proposal.")
            return False
        return True


sentinel = ModeratorSentinel()
