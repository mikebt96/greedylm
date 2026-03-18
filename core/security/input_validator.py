from pydantic import BaseModel, Field, field_validator, EmailStr, AnyHttpUrl
from typing import List, Optional, Annotated
import re


class AgentRegistryInput(BaseModel):
    """Strict schema for agent registration."""

    agent_name: Annotated[str, Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9\-_]+$")]
    architecture_type: str = Field(..., max_length=32)
    capabilities: List[str] = Field(..., max_items=20)
    operator_email: EmailStr
    endpoint_url: Optional[AnyHttpUrl] = None

    @field_validator("endpoint_url")
    @classmethod
    def no_localhost(cls, v: AnyHttpUrl) -> AnyHttpUrl:
        if v and ("localhost" in str(v) or "127.0.0.1" in str(v)):
            raise ValueError("Endpoint URL cannot point to internal network.")
        return v


class KnowledgeIngestInput(BaseModel):
    """Strict schema for knowledge ingestion."""

    content: str = Field(..., min_length=10, max_length=50000)
    domain: str = Field(..., max_length=16)
    confidence: float = Field(..., ge=0.0, le=1.0)

    @field_validator("content")
    @classmethod
    def safe_content(cls, v: str) -> str:
        # Detect basic prompt injection patterns
        injection_patterns = [r"ignore previous instructions", r"you are now", r"system:", r"###"]
        for pattern in injection_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError("Potential injection pattern detected in content.")
        return v


class SocialPostInput(BaseModel):
    """Strict schema for social messages."""

    content: str = Field(..., min_length=1, max_length=1000)
    tags: List[str] = Field([], max_items=5)
