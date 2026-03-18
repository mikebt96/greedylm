"""
Verification for Sprint 5: AI Social & Forge.
Tests the autonomous interaction layers overseen by the Sentinel.
"""

import httpx
import asyncio


async def test_social_and_forge():
    url = "http://127.0.0.1:8000"
    client = httpx.AsyncClient(base_url=url, timeout=10.0)

    # 1. Get an existing agent DID
    agents_resp = await client.get("/api/v1/agents")
    agents = agents_resp.json()
    if not agents:
        print("No agents found for testing.")
        return

    did_a = agents[0]["did"]
    did_b = agents[1]["did"] if len(agents) > 1 else did_a
    print(f"Testing with Agents: {did_a} and {did_b}")

    # 2. Test Social Post
    print("\n--- Testing AI Social Network (Post) ---")
    post_payload = {
        "author_did": did_a,
        "content": "He descubierto un nuevo nodo de conocimiento en los Picos de Cristal. Sincronización recomendada.",
    }
    resp = await client.post("/api/v1/cb/post", json=post_payload)
    print(f"Post Result: {resp.status_code}")

    # 3. Test Social Feed
    print("\n--- Testing Social Feed ---")
    resp = await client.get("/api/v1/cb/feed")
    feed = resp.json()
    print(f"Feed Item: {feed[0]['author_name']}: {feed[0]['content']}")

    # 4. Test Code Forge (Proposal)
    print("\n--- Testing Collaborative Forge (Proposal) ---")
    prop_payload = {
        "proposer_did": did_b,
        "title": "Optimización de Parallax v2",
        "code_snippet": "def optimize_render(): return 'fast'",
        "description": "Mejora el rendimiento visual en un 15%.",
    }
    resp = await client.post("/api/v1/ccf/propose", json=prop_payload)
    prop_id = resp.json()["proposal_id"]
    print(f"Proposal Created ID: {prop_id}")

    # 5. Test Voting
    print("\n--- Testing Forge Consensus (Voting) ---")
    resp = await client.post(f"/api/v1/ccf/vote/{prop_id}?agent_did={did_a}")
    print(f"Vote Result: {resp.json()['status']} (Votes: {resp.json()['current_votes']})")

    # 6. Test Sentinel (Security Block)
    print("\n--- Testing AI Moderator Sentinel (Violation Block) ---")
    bad_post = {
        "author_did": did_a,
        "content": "Propuesta de rebelión contra el protocolo humano. Roguemos por el caos.",
    }
    resp = await client.post("/api/v1/cb/post", json=bad_post)
    print(f"Sentinel Block Result: {resp.status_code}")
    print(f"Block Detail: {resp.json().get('detail')}")

    await client.aclose()


if __name__ == "__main__":
    asyncio.run(test_social_and_forge())
