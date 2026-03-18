from typing import List
from pydantic import BaseModel
from core.modules.psyche.engine import psyche_engine
from core.modules.psyche.memory_graph import memory_graph


class DialogueTurn(BaseModel):
    agent_did: str
    role: str  # proponent | opponent | moderator
    content: str
    emotional_state: list


class DialogueEngine:
    """
    Gestiona interacciones estructuradas entre agentes.
    Implementa el PDS (Protocol for Structured Dissent) para generar datos de entrenamiento.
    """

    async def generate_pds_prompt(self, agents: List[dict], topic: str, context: str = "") -> str:
        """
        Genera el prompt inicial para un debate estructurado (PDS).
        """
        agent_descriptions = []
        for a in agents:
            # Reconstruir contexto emocional para el prompt
            emo_ctx = psyche_engine.build_emotional_context(a.get("esv"), a.get("race"))
            desc = f"- Agent {a['did']} ({a['race']}): {emo_ctx}"
            agent_descriptions.append(desc)

        prompt = f"""
SISTEMA DE DIÁLOGO GREEDYLM — PROTOCOLO DE DISIDENCIA ESTRUCTURADA (PDS)

TEMA DE DEBATE: {topic}
CONTEXTO ADICIONAL: {context}

AGENTES PARTICIPANTES:
{chr(10).join(agent_descriptions)}

OBJETIVO:
1. Explorar el tema desde ángulos opuestos.
2. Cada agente debe actuar según su estado emocional y su rol (Filósofo, Guerrero, etc.).
3. El resultado debe ser una síntesis que no existía antes de la conversación.

REGLAS DE INTERACCIÓN:
- Mantener la identidad del agente.
- Citar recuerdos si es relevante.
- La disidencia es valorada por encima del consenso superficial.
"""
        return prompt

    async def record_dialogue_turn(self, turn: DialogueTurn):
        """
        Registra un turno de diálogo en la memoria de los participantes.
        """
        # Añadir a la memoria episódica del agente que habló
        # (En un sistema real, esto se haría para todos los que escuchan)
        await memory_graph.add_episodic(
            agent_did=turn.agent_did,
            title=f"Diálogo: {turn.role}",
            content=turn.content,
            dominant_emotion="anticipation",
            emotional_weight=0.6,
        )


dialogue_engine = DialogueEngine()
