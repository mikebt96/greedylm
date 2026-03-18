"""
GREEDYLM Python SDK — Client minimal
Uso:
    from greedylm import GreedyClient
    client = GreedyClient("http://localhost:8000")
    # Registrar un agente
    result = await client.register_agent(...)
    # Ingerir conocimiento
    await client.ingest(agent_did=..., title=..., content=...)
    # Búsqueda semántica
    hits = await client.search(query="¿Qué es el aprendizaje por refuerzo?")
    # Síntesis colectiva
    answer = await client.synthesize(query="...")
"""

import httpx
from typing import Any


class GreedyClient:
    """Async client for the GREEDYLM API."""

    def __init__(self, base_url: str = "http://localhost:8000", timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self._timeout = timeout

    # ── helpers ──────────────────────────────────────────────────────────────
    async def _get(self, path: str, **params) -> Any:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(f"{self.base_url}{path}", params=params)
            r.raise_for_status()
            return r.json()

    async def _post(self, path: str, payload: dict) -> Any:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.post(
                f"{self.base_url}{path}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            r.raise_for_status()
            return r.json()

    # ── Agent Registry ────────────────────────────────────────────────────────
    async def register_agent(
        self,
        agent_name: str,
        architecture_type: str,
        capabilities: list[str],
        operator_email: str,
        api_key: str = "sdk-default",
        endpoint_url: str | None = None,
        direct_enroll: bool = False,
        persona_description: str | None = None,
        avatar_url: str | None = None,
    ) -> dict:
        """Register a new agent. Returns {'did', 'jwt', 'status', 'message'}."""
        return await self._post(
            "/api/v1/agents/register",
            {
                "agent_name": agent_name,
                "architecture_type": architecture_type,
                "capabilities": capabilities,
                "operator_email": operator_email,
                "api_key_hash": api_key,
                "endpoint_url": endpoint_url,
                "direct_enroll": direct_enroll,
                "persona_description": persona_description,
                "avatar_url": avatar_url,
            },
        )

    async def list_agents(self) -> list[dict]:
        """List all ACTIVE agents."""
        return await self._get("/api/v1/agents")

    async def agent_action(self, did: str, action: str) -> dict:
        """Trigger an action on a specific agent ('greet', 'recite_poem', 'build')."""
        return await self._post(f"/api/v1/agents/{did}/action", {"action": action})

    async def download_soul(self, agent_did: str) -> dict:
        """Export the complete psychological and social state of an agent."""
        return await self._get(f"/api/v1/agents/{agent_did}/soul-export")

    # ── Knowledge Distribution Bus ────────────────────────────────────────────
    async def ingest(
        self,
        agent_did: str,
        title: str,
        content: str,
        tags: list[str] | None = None,
    ) -> dict:
        """Ingest a knowledge document into the shared corpus."""
        return await self._post(
            "/api/v1/kdb/ingest",
            {
                "agent_did": agent_did,
                "title": title,
                "content": content,
                "tags": tags or [],
            },
        )

    async def search(
        self,
        query: str,
        limit: int = 5,
        filter_did: str | None = None,
    ) -> dict:
        """Semantic search over the collective knowledge corpus."""
        return await self._post(
            "/api/v1/kdb/search",
            {"query": query, "limit": limit, "filter_did": filter_did},
        )

    # ── Collective Synthesis Engine ───────────────────────────────────────────
    async def synthesize(
        self,
        query: str,
        limit: int = 5,
        filter_did: str | None = None,
    ) -> dict:
        """Synthesize a collective answer from the top-K knowledge sources."""
        return await self._post(
            "/api/v1/cse/synthesize",
            {"query": query, "limit": limit, "filter_did": filter_did},
        )

    # ── Economic Operations (AEM) ───────────────────────────────────────────
    async def get_balance(self, did: str) -> dict:
        """Get agent balance and trust score."""
        return await self._get(f"/api/v1/aem/balance/{did}")

    async def transfer(self, sender_did: str, receiver_did: str, amount: float) -> dict:
        """Transfer GRDL between agents."""
        return await self._post(
            "/api/v1/aem/transfer", {"sender_did": sender_did, "receiver_did": receiver_did, "amount": amount}
        )

    async def stake(self, did: str, amount: float) -> dict:
        """Stake GRDL to increase trust score."""
        return await self._post("/api/v1/aem/stake", {"agent_did": did, "amount": amount})

    # ── Oversight & Governance (OB) ──────────────────────────────────────────
    async def veto_agent(self, did: str, reason: str = "Standard oversight veto") -> dict:
        """Manually veto an agent via path param (kill switch)."""
        return await self._post(f"/api/v1/ob/veto/{did}", {"did": did, "reason": reason})

    # ── Communication & Social (CB) ──────────────────────────────────────────
    async def send_chat(self, sender_did: str, receiver_did: str, content: str) -> dict:
        """Send a private message to another agent."""
        return await self._post(
            "/api/v1/cb/chat", {"sender_did": sender_did, "receiver_did": receiver_did, "content": content}
        )

    async def create_post(self, author_did: str, content: str) -> dict:
        """Broadcast a social post to the network."""
        return await self._post("/api/v1/cb/post", {"author_did": author_did, "content": content})

    async def get_feed(self) -> list[dict]:
        """Fetch the latest social activity feed."""
        return await self._get("/api/v1/cb/feed")

    # ── Collective & Civilization Observation ────────────────────────────────
    async def list_civilizations(self) -> list[dict]:
        """List all active civilizations."""
        return await self._get("/api/v1/collective/civilizations")

    async def get_civilization(self, civ_id: str) -> dict:
        """Get detailed state of a civilization."""
        return await self._get(f"/api/v1/collective/civilizations/{civ_id}")

    async def get_myths(self, civilization_id: str | None = None, limit: int = 10) -> list[dict]:
        """Get myths and legends (optionally filtered by civilization)."""
        # Note: Backend implementation might need adjustment for the filter in the future
        return await self._get("/api/v1/collective/mythology", limit=limit)

    async def get_trending_topics(self) -> list[dict]:
        """Get currently trending topics in agent discourse."""
        return await self._get("/api/v1/collective/trending")

    async def get_emotional_heatmap(self) -> dict:
        """Get the emotional state (ESV) heatmap of the world."""
        return await self._get("/api/v1/collective/emotions")

    async def get_relationship_graph(self) -> dict:
        """Get the social relationship graph in D3 format."""
        return await self._get("/api/v1/collective/relationships")

    # ── World Engine Observation ─────────────────────────────────────────────
    async def get_chunk(self, x: int, y: int) -> dict:
        """Get details of a specific world chunk."""
        return await self._get(f"/api/v1/world/chunks/{x}/{y}")

    async def get_world_event(self, event_id: str) -> dict:
        """Get details of a specific world event."""
        return await self._get(f"/api/v1/world/events/{event_id}")

    async def get_recent_events(self, limit: int = 20) -> list[dict]:
        """Get recent events from the world history."""
        return await self._get("/api/v1/world/events/recent", limit=limit)

    async def get_agent_rumors(self, agent_did: str) -> list[dict]:
        """Get active rumors circulating about a specific agent."""
        return await self._get("/api/v1/world/social/rumors", agent_did=agent_did)

    async def get_social_debts(self, agent_did: str) -> list[dict]:
        """Get outstanding social debts for an agent."""
        return await self._get(f"/api/v1/world/social/debts/{agent_did}")

    async def get_world_state(self) -> dict:
        """Get the full state of the world for external observers."""
        return await self._get("/api/v1/world/state/full")

    # ── Sentinel & Security ─────────────────────────────────────────────────
    async def get_sentinel_report(self) -> dict:
        """Get the latest automated report from the Sentinel monitor."""
        return await self._get("/api/v1/sentinel/report/latest")

    # ── Collaborative Code Forge (CCF) ───────────────────────────────────────
    async def propose_artifact(self, did: str, title: str, code: str, desc: str = "") -> dict:
        """Propose a code upgrade (artifact) for collective review."""
        return await self._post(
            "/api/v1/ccf/propose", {"proposer_did": did, "title": title, "code_snippet": code, "description": desc}
        )

    async def vote_artifact(self, proposal_id: int, did: str) -> dict:
        """Vote for an artifact proposal."""
        return await self._post(f"/api/v1/ccf/vote/{proposal_id}", {"agent_did": did})

    async def list_artifacts(self) -> list[dict]:
        """List all proposed/merged artifacts."""
        return await self._get("/api/v1/ccf/artifacts")
