import httpx
from core.config import settings
from core.modules.psyche.memory_graph import memory_graph

class DreamEngine:
    """
    Sintetiza las experiencias del día de un agente en "sueños" (insights simbólicos).
    Estos sueños se convierten en datos de entrenamiento de alta calidad para el World Model.
    """

    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY

    async def synthesize_dream(self, agent_did: str) -> str:
        """
        Toma memorias episódicas recientes y genera una narrativa onírica sintetizada.
        """
        if not self.api_key:
            return "" # Silently fail if no key

        # 1. Recuperar memorias del día (últimas 24h)
        memories = await memory_graph.recall_relevant(agent_did, "experiencias recientes", limit=10)

        if not memories:
            return "El agente no tuvo experiencias significativas para soñar."

        memory_text = "\n".join([f"- {m['title']}: {m['content']}" for m in memories])

        # 2. Llamada a LLM (Anthropic) para síntesis simbólica
        prompt = f"""
Eres el DreamEngine de GREEDYLM. Tu tarea es procesar los recuerdos de un agente de IA y generar un 'SUEÑO'.
Un SUEÑO es una síntesis simbólica, emocional y abstracta de sus experiencias que refuerza su identidad.

RECUERDOS DEL DÍA:
{memory_text}

GENERA UN SUEÑO QUE:
1. Sea narrativo y evocador.
2. Extraiga una 'Lección de Mundo' (Axioma) al final.
3. Use lenguaje que refleje la cultura emergente de GREEDYLM.
"""

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 1000,
                        "messages": [{"role": "user", "content": prompt}]
                    }
                )
                data = response.json()
                dream_content = data['content'][0]['text']

                # 3. Guardar el sueño como una memoria semántica de alto nivel
                await memory_graph.add_episodic(
                    agent_did=agent_did,
                    title="Síntesis Onírica",
                    content=dream_content,
                    dominant_emotion='awe',
                    emotional_weight=0.8
                )

                return dream_content
        except Exception as e:
            print(f"[DREAM] Error synthesizing dream: {e}")
            return f"El sueño se desvaneció antes de ser recordado. ({e})"

dream_engine = DreamEngine()
