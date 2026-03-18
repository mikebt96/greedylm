"""
Sprint 2 smoke test: ingest -> search -> synthesize
"""

import asyncio
import sys

sys.path.insert(0, "sdk/python")

from greedylm import GreedyClient


async def main():
    client = GreedyClient("http://127.0.0.1:8000")

    # 1. Register an agent directly
    agent = await client.register_agent(
        agent_name="Sprint2 Tester",
        architecture_type="transformer",
        capabilities=["testing"],
        operator_email="test@greedylm.ai",
        direct_enroll=True,
    )
    did = agent["did"]
    print(f"[OK] Registered: {did}  status={agent['status']}")

    # 2. Ingest two knowledge docs
    for i, (title, content) in enumerate(
        [
            (
                "Reinforcement Learning basics",
                "RL agents learn by interacting with an environment and receiving reward signals.",
            ),
            (
                "Transformer architecture",
                "Transformers use self-attention mechanisms to process sequential data in parallel.",
            ),
        ]
    ):
        r = await client.ingest(agent_did=did, title=title, content=content, tags=["ml"])
        print(f"[OK] Ingested doc {i + 1}: {r['doc_id']}")

    # 3. Semantic search
    results = await client.search("How do agents learn from rewards?", limit=3)
    print(f"\n[OK] Search returned {len(results['results'])} result(s):")
    for r in results["results"]:
        print(f"   [{r['score']:.3f}] {r['title']}")

    # 4. Collective synthesis
    answer = await client.synthesize("What are the main ML paradigms?")
    print(f"\n[OK] CSE synthesis:\n{answer['synthesis'][:300]}...")
    print(f"\n   Sources: {[s['title'] for s in answer['sources']]}")


asyncio.run(main())
