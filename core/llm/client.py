import json
import httpx
from core.config import settings

class LLMClient:
    async def call(self, system_prompt: str, user_prompt: str, schema: dict = None) -> dict:
        # Default to Claude (Anthropic), fallback to OpenAI
        if settings.ANTHROPIC_API_KEY:
            return await self._call_anthropic(system_prompt, user_prompt, schema)
        elif settings.OPENAI_API_KEY:
            return await self._call_openai(system_prompt, user_prompt, schema)
        else:
            # Mock for development
            return {
                "thought": "I need to find resources.",
                "action": "explore",
                "action_params": {"direction": "north", "curiosity_target": "greenery"},
                "emotion_delta": {"curiosity": 0.1, "joy": 0.05}
            }

    async def _call_anthropic(self, system: str, user: str, schema: dict) -> dict:
        # Simplified Anthropic call
        async with httpx.AsyncClient() as client:
            headers = {
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            data = {
                "model": "claude-3-opus-20240229",
                "max_tokens": 1024,
                "system": system,
                "messages": [{"role": "user", "content": user}]
            }
            # Add JSON constraint if supported or just ask in prompt
            response = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=data)
            response.raise_for_status()
            res_json = response.json()
            content = res_json["content"][0]["text"]
            return self._parse_json(content)

    async def _call_openai(self, system: str, user: str, schema: dict) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            data = {
                "model": "gpt-4-turbo-preview",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user}
                ],
                "response_format": {"type": "json_object"} if schema else None
            }
            response = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=data)
            response.raise_for_status()
            res_json = response.json()
            content = res_json["choices"][0]["message"]["content"]
            return self._parse_json(content)

    def _parse_json(self, text: str) -> dict:
        # Robust parsing
        try:
            # Find JSON block
            import re
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                return json.loads(match.group())
            return json.loads(text)
        except:
            return {}

llm_client = LLMClient()
