"""
Penalty Index — Behavioral Tracking System.
Maintains a 'deviance score' for agents.
If deviance exceeds a threshold, the agent is flagged for the Escape Capsule.
"""
from typing import Dict
from datetime import datetime

class PenaltyIndex:
    def __init__(self, threshold: float = 1.0):
        self.scores: Dict[str, float] = {}  # did -> current_penalty
        self.threshold = threshold
        self.last_violation: Dict[str, datetime] = {}

    def add_penalty(self, did: str, weight: float, reason: str):
        """Increase penalty score for an agent."""
        current = self.scores.get(did, 0.0)
        self.scores[did] = current + weight
        self.last_violation[did] = datetime.now()
        print(f"[PENALTY] Agent {did} flagged for {reason}. Current score: {self.scores[did]}")

    def get_score(self, did: str) -> float:
        return self.scores.get(did, 0.0)

    def is_flagged(self, did: str) -> bool:
        """Check if agent has exceeded the safety threshold."""
        return self.scores.get(did, 0.0) >= self.threshold

    def clear(self, did: str):
        """Resets the score (e.g., after human review or rehabilitation)."""
        self.scores[did] = 0.0

# Global singleton for dev environment
penalty_manager = PenaltyIndex(threshold=1.0)
