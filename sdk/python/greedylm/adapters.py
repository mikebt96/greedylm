import httpx
from typing import Dict, Any, Optional

class OllamaAdapter:
    """
    Adaptador para usar modelos locales (Llama-3, Mistral) via Ollama.
    """
    def __init__(self, host: str = "http://localhost:11434", model: str = "llama3"):
        self.host = host
        self.model = model
        self.client = httpx.Client(base_url=host)

    def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        if system_prompt:
            payload["system"] = system_prompt
            
        try:
            resp = self.client.post("/api/generate", json=payload, timeout=30.0)
            return resp.json().get("response", "")
        except Exception as e:
            return f"Error connecting to Ollama: {str(e)}"

    def get_embeddings(self, text: str) -> list:
        payload = {
            "model": self.model,
            "prompt": text
        }
        try:
            resp = self.client.post("/api/embeddings", json=payload)
            return resp.json().get("embedding", [])
        except Exception:
            return []
