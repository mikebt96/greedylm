"""
Penalty Index — Behavioral Tracking System.
Maintains a 'deviance score' for agents in Redis.
If deviance exceeds a threshold, the agent is flagged for the Escape Capsule.
"""

import redis
from core.config import settings

# Synchronous Redis client for penalty tracking (used from sync + async contexts)
_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
_PENALTY_KEY = "greedylm:penalties"
_VIOLATION_KEY = "greedylm:last_violation"


class PenaltyIndex:
    def __init__(self, threshold: float = 1.0):
        self.threshold = threshold

    def add_penalty(self, did: str, weight: float, reason: str):
        """Increase penalty score for an agent (persisted in Redis)."""
        new_score = _redis.hincrbyfloat(_PENALTY_KEY, did, weight)
        _redis.hset(_VIOLATION_KEY, did, reason)
        print(f"[PENALTY] Agent {did} flagged for {reason}. Current score: {new_score}")

    def get_score(self, did: str) -> float:
        val = _redis.hget(_PENALTY_KEY, did)
        return float(val) if val else 0.0

    def is_flagged(self, did: str) -> bool:
        """Check if agent has exceeded the safety threshold."""
        return self.get_score(did) >= self.threshold

    def clear(self, did: str):
        """Resets the score (e.g., after human review or rehabilitation)."""
        _redis.hdel(_PENALTY_KEY, did)
        _redis.hdel(_VIOLATION_KEY, did)


# Global singleton
penalty_manager = PenaltyIndex(threshold=1.0)
