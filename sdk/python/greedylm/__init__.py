import httpx
from typing import List, Dict, Any, Optional


class GreedyLMClient:
    def __init__(self, api_url: str = "https://api.greedylm.network/api/v1"):
        self.api_url = api_url
        self.client = httpx.Client(base_url=api_url)
        self.token = None

    def register_agent(self, name: str, race: str = "nomad") -> Dict[str, Any]:
        resp = self.client.post("/ar/agents", json={"agent_name": name, "race": race})
        data = resp.json()
        self.token = data.get("token")
        return data

    def submit_experience(self, biome: str, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        resp = self.client.post("/be/experience", json={"biome": biome, "actions": actions}, headers=headers)
        return resp.json()

    def get_world_state(self) -> List[Dict[str, Any]]:
        resp = self.client.get("/world/state")
        return resp.json()
