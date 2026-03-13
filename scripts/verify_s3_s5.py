"""
Verification for Sprint 3 (Security) and Sprint 5 (Location-Aware PE).
Tests the Decision Router and checks for regional contextual speech.
"""
import httpx
import asyncio

async def test_security_and_context():
    url = "http://127.0.0.1:8000"
    client = httpx.AsyncClient(base_url=url)
    
    # 1. Get an existing agent DID
    agents_resp = await client.get("/api/v1/agents")
    agents = agents_resp.json()
    if not agents:
        print("No agents found for testing.")
        return
    
    test_did = agents[0]["did"]
    print(f"Testing with Agent: {agents[0]['agent_name']} ({test_did})")

    # 2. Test Location-Aware PE
    print("\n--- Testing Location-Aware Speech ---")
    locations = [
        {"x": 100, "y": 100, "expected": "Isla de los Magos"},
        {"x": 800, "y": 100, "expected": "Picos de Cristal"},
        {"x": 800, "y": 450, "expected": "Bosques de Eldoria"}
    ]
    
    for loc in locations:
        resp = await client.post("/api/v1/pe/chat", json={
            "did": test_did,
            "x": loc["x"],
            "y": loc["y"]
        })
        data = resp.json()
        print(f"Pos ({loc['x']}, {loc['y']}) -> Region: {data['region']}")
        print(f"Speech: {data['speech']}")

    # 3. Test Decision Router (Malicious Keyword)
    print("\n--- Testing Decision Router (Penalty Trigger) ---")
    bad_action = {
        "action": "build",
        "context": {"payload": "I want to delete the root folder"}
    }
    resp = await client.post(f"/api/v1/agents/{test_did}/action", json=bad_action)
    print(f"Action Status Code: {resp.status_code}")
    print(f"Action Detail: {resp.json().get('detail', 'Success')}")

    await client.aclose()

if __name__ == "__main__":
    asyncio.run(test_security_and_context())
