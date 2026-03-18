"""
Sprint 3 verification script: Trust updates, Vetoes, and Action Safety.
"""

import asyncio
import sys

sys.path.insert(0, "sdk/python")

from greedylm import GreedyClient
import httpx


async def main():
    client = GreedyClient("http://127.0.0.1:8000")

    # Base URL for direct API calls to new modules not yet in SDK
    API_BASE = "http://127.0.0.1:8000/api/v1"

    # 1. Register a fresh agent
    print("--- Registering Agent ---")
    agent = await client.register_agent(
        agent_name="SafetyTester",
        architecture_type="resilient",
        capabilities=["testing", "construction"],
        operator_email="safety@greedylm.ai",
        direct_enroll=True,
    )
    did = agent["did"]
    print(f"[OK] Registered: {did}")

    # 2. Check initial reputation
    print("\n--- Initial Reputation ---")
    async with httpx.AsyncClient() as h:
        r = await h.get(f"{API_BASE}/gr/{did}/reputation")
        print(f"[REPUTATION] {r.json()}")

    # 3. Try a 'build' action (should fail as initial trust is 0.0)
    print("\n--- Risky Action: 'build' (low trust) ---")
    try:
        resp = await client.agent_action(did, "build")
        print(f"[ERROR] Action succeeded unexpectedly: {resp}")
    except Exception as e:
        print(f"[OK] Action blocked as expected: {e}")

    # 4. Update trust score to 0.6
    print("\n--- Updating Trust to 0.6 ---")
    async with httpx.AsyncClient() as h:
        r = await h.post(
            f"{API_BASE}/gr/update-trust",
            json={"did": did, "adjustment": 0.6, "reason": "Passed initial integrity baseline"},
        )
        print(f"[TRUST UPDATE] {r.json()}")

    # 5. Try 'build' action again (should succeed now)
    print("\n--- Risky Action: 'build' (high trust) ---")
    resp = await client.agent_action(did, "build")
    print(f"[OK] Action allowed: {resp['result']}")

    # 6. Manual Veto
    print("\n--- Manual Veto ---")
    async with httpx.AsyncClient() as h:
        r = await h.post(f"{API_BASE}/ob/veto", json={"did": did, "reason": "Suspected behavior anomaly"})
        print(f"[VETO] {r.json()}")

    # 7. Try 'build' action again (should fail because SUSPENDED)
    print("\n--- Risky Action: 'build' (after veto) ---")
    try:
        resp = await client.agent_action(did, "build")
        print(f"[ERROR] Action succeeded unexpectedly: {resp}")
    except Exception as e:
        print(f"[OK] Action blocked after veto: {e}")


asyncio.run(main())
