"""
Escape Capsule — Emergency Agent Isolation.
Protocol to safely disconnect or 'Eject' an agent from the environment.
"""
from core.security.penalty_index import penalty_manager

async def trigger_escape(did: str, reason: str):
    """
    Emergency disconnection protocol.
    In dev, this just logs the ejection and sets penalty to max.
    """
    print(f"!!! ESCAPE CAPSULE TRIGGERED for {did} !!!")
    print(f"Reason: {reason}")
    penalty_manager.add_penalty(did, 1.0, f"Escape Capsule: {reason}")

    # Logic to set agent status to SUSPENDED in DB should go here
    # (Will be integrated with AgentRegistry)
    return {"status": "EJECTED", "did": did, "safe_zone": "Quarantine Node 0"}
