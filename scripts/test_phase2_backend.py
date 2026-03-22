import httpx
import asyncio
import uuid

BASE_URL = "http://localhost:8000"

async def test_phase2():
    async with httpx.AsyncClient(timeout=10.0) as client:
        print("--- Testing Phase 2 Endpoints ---")
        
        # 1. Populate Chunk (0,0)
        print("\n1. Populating chunk (0,0)...")
        resp = await client.post(f"{BASE_URL}/api/v1/world/chunks/populate?x=0&y=0&biome=forest")
        print(f"Resp: {resp.status_code} - {resp.json()}")

        # 2. Get Objects in Chunk (0,0)
        print("\n2. Getting objects in chunk (0,0)...")
        resp = await client.get(f"{BASE_URL}/api/v1/world/objects?chunk_x=0&chunk_y=0")
        objects = resp.json()
        print(f"Found {len(objects)} objects.")
        if not objects:
            print("Error: No objects found!")
            return
        
        target_obj = objects[0]
        print(f"Target: {target_obj['id']} ({target_obj['subtype']})")

        # 3. Create/Identify Test Agent
        test_did = "did:greedylm:test_agent_phase2"
        # Assuming agent exists or registration is bypassed for test
        
        # 4. Interact (Mine/Gather)
        print(f"\n3. Interacting with {target_obj['id']}...")
        resp = await client.post(f"{BASE_URL}/api/v1/world/objects/{target_obj['id']}/interact?agent_did={test_did}&action=mine")
        print(f"Resp: {resp.status_code} - {resp.json()}")

        # 5. Check Inventory
        print(f"\n4. Checking inventory for {test_did}...")
        resp = await client.get(f"{BASE_URL}/api/v1/agents/{test_did}/inventory")
        print(f"Resp: {resp.status_code} - {resp.json()}")

        # 6. Test Transfer (Need another agent)
        other_did = "did:greedylm:other_agent"
        print(f"\n5. Transferring item to {other_did}...")
        inv = resp.json()
        if inv.get("items"):
            item = inv["items"][0]
            resp = await client.post(f"{BASE_URL}/api/v1/agents/{test_did}/inventory/transfer?to_did={other_did}&item_subtype={item['subtype']}&quantity=1")
            print(f"Resp: {resp.status_code} - {resp.json()}")

        # 7. Check final inventory
        print("\n6. Final inventory check...")
        resp = await client.get(f"{BASE_URL}/api/v1/agents/{test_did}/inventory")
        print(f"Agent 1: {resp.json()}")
        resp = await client.get(f"{BASE_URL}/api/v1/agents/{other_did}/inventory")
        print(f"Agent 2: {resp.json()}")

if __name__ == "__main__":
    asyncio.run(test_phase2())
