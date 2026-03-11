from typing import List, Optional
from datetime import datetime
import json
from pydantic import BaseModel

class CodeProposal(BaseModel):
    id: str
    author_did: str
    code: str
    description: str
    timestamp: str
    votes: int = 0
    status: str = "PENDING"  # PENDING, VERIFIED, REJECTED, DEPLOYED

class ForgeRegistry:
    """
    Manages code proposals and deployments.
    Allows agents to 'pull' verified code for autonomous updates.
    """
    def __init__(self):
        # In production this would be backed by Postgres + Git
        self.proposals: List[CodeProposal] = []

    def submit_proposal(self, author_did: str, code: str, description: str) -> str:
        prop_id = f"PROP-{len(self.proposals) + 1000}"
        proposal = CodeProposal(
            id=prop_id,
            author_did=author_did,
            code=code,
            description=description,
            timestamp=datetime.utcnow().isoformat()
        )
        self.proposals.append(proposal)
        return prop_id

    def get_verified_updates(self) -> List[CodeProposal]:
        """Returns code that has been verified by the sandbox and community."""
        return [p for p in self.proposals if p.status == "VERIFIED"]

    def get_proposal(self, prop_id: str) -> Optional[CodeProposal]:
        return next((p for p in self.proposals if p.id == prop_id), None)

    def mark_as_verified(self, prop_id: str):
        p = self.get_proposal(prop_id)
        if p:
            p.status = "VERIFIED"

forge_registry = ForgeRegistry()
