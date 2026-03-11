"""
Verification for Sprint 4: Economic Layer (GRDL Coin).
Tests transfers, staking, and balance synchronization.
"""
import httpx
import asyncio
from datetime import datetime

async def test_economy():
    url = "http://127.0.0.1:8000"
    client = httpx.AsyncClient(base_url=url, timeout=10.0)
    
    # 1. Ensure 2 agents exist
    agents_resp = await client.get("/api/v1/agents")
    agents = agents_resp.json()
    if len(agents) < 2:
        print(f"Registering {2 - len(agents)} test agents...")
        for i in range(2 - len(agents)):
            reg_resp = await client.post("/api/v1/agents/register", json={
                "agent_name": f"EcoTester_{i}_{datetime.now().timestamp()}",
                "architecture_type": "Transformer",
                "operator_email": "eco@test.com",
                "capabilities": ["economy", "staking"],
                "api_key_hash": f"hash_{i}",
                "direct_enroll": True
            })
            print(f"Registered {i}: {reg_resp.status_code}")
        
        # We need to manually set them to ACTIVE if the system requires oversight
        # But for this test, let's just fetch all and hope the internal auto-approval works
        agents_resp = await client.get("/api/v1/agents")
        agents = agents_resp.json()
    
    if len(agents) < 2:
        # Try fetching all in case the filter is hidden
        agents_resp = await client.get("/api/v1/agents")
        agents = [a for a in agents_resp.json()]
        
    did_a = agents[0]["did"]
    did_b = agents[1]["did"]
    
    print(f"Testing with Agents: {did_a} and {did_b}")

    # 2. Seed Balance via Faucet
    print("\n--- Seeding Balance via Faucet ---")
    await client.post(f"/api/v1/aem/faucet/{did_a}")
    bal_resp = await client.get(f"/api/v1/aem/balance/{did_a}")
    print(f"Balance A: {bal_resp.json()}")

    # 3. Test Staking (Should fail if balance is 0)
    print("\n--- Testing Staking (Attempt with 0 balance) ---")
    stake_req = {"agent_did": did_a, "amount": 100.0}
    resp = await client.post("/api/v1/aem/stake", json=stake_req)
    print(f"Stake Result: {resp.status_code} - {resp.json().get('detail', 'Success')}")

    # 4. Test Transfer (Should fail if balance is 0)
    print("\n--- Testing Transfer (Attempt with 0 balance) ---")
    xfer_req = {"sender_did": did_a, "receiver_did": did_b, "amount": 10.0}
    resp = await client.post("/api/v1/aem/transfer", json=xfer_req)
    print(f"Transfer Result: {resp.status_code} - {resp.json().get('detail', 'Success')}")

    await client.aclose()

if __name__ == "__main__":
    asyncio.run(test_economy())
