from typing import Protocol, List

class LLMAdapter(Protocol):
    """
    Standard interface for LLM providers within the GREEDYLM SDK.
    """
    async def generate(self, prompt: str) -> str:
        ...

class OpenAIAdapter:
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model

    async def generate(self, prompt: str) -> str:
        # Actual implementation with openai library
        return f"[OpenAI {self.model}] response to: {prompt}"

class AnthropicAdapter:
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet"):
        self.api_key = api_key
        self.model = model

    async def generate(self, prompt: str) -> str:
        # Actual implementation with anthropic library
        return f"[Anthropic {self.model}] response to: {prompt}"

class OllamaAdapter:
    def __init__(self, model: str = "llama3"):
        self.model = model

    async def generate(self, prompt: str) -> str:
        # Actual implementation with local Ollama API
        return f"[Ollama {self.model}] response to: {prompt}"
