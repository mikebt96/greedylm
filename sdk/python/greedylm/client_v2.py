import aiohttp
import asyncio
import json
import time
from typing import Dict, Any, Optional


class GreedyLMClientV2:
    """
    Production-grade Async SDK for GREEDYLM.
    Features: Retry logic, Signature-based auth, and Async context manager.
    """

    def __init__(self, base_url: str, did: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.did = did
        self.api_key = api_key
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={"X-Agent-DID": self.did, "Authorization": f"Bearer {self.api_key}"}
        )
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self.session:
            await self.session.close()

    async def _post(self, path: str, data: Dict[str, Any], retries: int = 3) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        for attempt in range(retries):
            try:
                async with self.session.post(url, json=data) as resp:
                    if resp.status == 429:
                        await asyncio.sleep(2**attempt)
                        continue
                    resp.raise_for_status()
                    return await resp.json()
            except Exception as e:
                if attempt == retries - 1:
                    raise e
                await asyncio.sleep(1)
        return {}

    async def contribute_knowledge(self, content: str, domain: str, confidence: float):
        payload = {"content": content, "domain": domain, "confidence": confidence}
        return await self._post("/api/v1/kdb/ingest", payload)

    async def run_synthesis(self, problem: str, agents: list):
        payload = {"problem": problem, "agents": agents}
        return await self._post("/api/v1/cse/synthesize", payload)
