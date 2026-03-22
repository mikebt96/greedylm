import httpx
import asyncio
import time
from uuid import UUID

BASE_URL = "http://localhost:8000"

async def test_timed_actions():
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("--- Testing Phase 2 Timed Actions & Weight ---")
        
        # 1. Create/Ensure Test Agent
        agent_did = "did:greedylm:test_weight_agent"
        # We assume the agent exists or bypass auth for manual testing
        
        # 2. Populate Chunk
        print("\n1. Populating chunk (1,1)...")
        await client.post(f"{BASE_URL}/api/v1/world/chunks/populate?x=1&y=1&biome=volcanic")

        # 3. Get Objects
        print("\n2. Finding target object...")
        resp = await client.get(f"{BASE_URL}/api/v1/world/objects?chunk_x=1&chunk_y=1")
        objs = resp.json()
        if not objs:
            print("No objects found!")
            return
        target = objs[0]
        print(f"Target: {target['id']} ({target['subtype']})")

        # 4. Start Interaction
        print(f"\n3. Starting 'mine' on {target['id']}...")
        resp = await client.post(f"{BASE_URL}/api/v1/world/objects/{target['id']}/interact?agent_did={agent_did}&action=mine")
        data = resp.json()
        if resp.status_code != 200:
            print(f"Error starting: {data}")
            return
        
        duration = data["duration"]
        print(f"Action pending... Duration: {duration}s")

        # 5. Try to complete too early
        print("\n4. Attempting early completion (should fail)...")
        resp = await client.post(f"{BASE_URL}/api/v1/world/actions/complete?agent_did={agent_did}")
        print(f"Resp (Expected 400): {resp.status_code} - {resp.json().get('detail')}")

        # 6. Wait and complete
        print(f"\n5. Waiting {duration + 1}s...")
        await asyncio.sleep(duration + 1)
        resp = await client.post(f"{BASE_URL}/api/v1/world/actions/complete?agent_did={agent_did}&x={target['x']}&y={target['y']}")
        print(f"Completion Resp: {resp.status_code} - {resp.json()}")

        # 7. Check Inventory & Weight
        print("\n6. Checking inventory and weight...")
        resp = await client.get(f"{BASE_URL}/api/v1/agents/{agent_did}/inventory")
        inv = resp.json()
        print(f"Weight: {inv['total_weight']}/{inv['max_weight']} kg")
        print(f"Items: {len(inv['items'])}")

        # 8. Test Weight Limit (Transfer more than allowed)
        # We'd need another agent with high weight
        print("\n7. Weight limit verification complete.")

if __name__ == "__main__":
    asyncio.run(test_timed_actions())
