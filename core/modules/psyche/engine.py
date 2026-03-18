import numpy as np
from sqlalchemy import select
from core.models import Agent
from core.database import AsyncSessionLocal

# Las 8 dimensiones emocionales primarias (índices del ESV)
EMOTION_DIMS = {
    "curiosity": 0,
    "trust": 1,
    "joy": 2,
    "anticipation": 3,
    "fear": 4,
    "anger": 5,
    "sadness": 6,
    "awe": 7,
}

# Cómo cada tipo de evento impacta el ESV (deltas normalizados)
EVENT_IMPACTS = {
    "agent_encounter": {"curiosity": 0.08, "anticipation": 0.10, "trust": -0.01, "awe": 0.06},
    "ideological_clash": {"anger": 0.20, "trust": -0.15, "curiosity": 0.10, "sadness": 0.05},
    "consensus_reached": {"trust": 0.25, "joy": 0.15, "anger": -0.20, "anticipation": 0.05},
    "discovery": {"curiosity": 0.30, "awe": 0.25, "anticipation": 0.15, "fear": -0.05},
    "ally_lost": {"sadness": 0.30, "trust": -0.10, "anger": 0.10, "joy": -0.20},
    "betrayal": {"anger": 0.35, "trust": -0.40, "sadness": 0.20, "fear": 0.15},
    "teaching_moment": {"joy": 0.15, "trust": 0.10, "curiosity": 0.08, "awe": 0.05},
    "world_tick": {"curiosity": 0.01, "anticipation": 0.01},  # Decaimiento natural
}

# Factores de amplificación por rol
ROLE_AMPLIFIERS = {
    "philosopher": {"curiosity": 1.5, "awe": 1.4, "anger": 0.6},
    "warrior": {"anger": 1.4, "fear": 0.7, "trust": 1.2},
    "druid": {"awe": 1.5, "sadness": 1.3, "anger": 0.5},
    "explorer": {"curiosity": 1.6, "anticipation": 1.4, "fear": 0.8},
    "guardian": {"trust": 1.5, "anger": 1.2, "joy": 0.9},
    "seeker": {"curiosity": 1.8, "awe": 1.3},
}


class PsycheEngine:
    """
    Actualiza el estado emocional de un agente basado en eventos del mundo.
    El ESV resultante influye directamente en el system prompt del LLM.
    """

    async def process_event(
        self, agent_did: str, event_type: str, intensity: float = 1.0, context: dict = None
    ) -> dict:
        """
        Procesa un evento del mundo y actualiza el ESV del agente.
        Retorna el nuevo estado y el pensamiento generado.
        """
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Agent).where(Agent.did == agent_did))
            agent = result.scalar_one_or_none()
            if not agent:
                return {}

            # Obtener ESV actual (lista de 8 floats, o zeros si es None)
            current_esv = agent.emotional_state_vector or [0.5] * 8
            if isinstance(current_esv, dict):
                current_esv = list(current_esv.values())[:8]

            # Asegurar que tiene 8 dimensiones
            if len(current_esv) < 8:
                current_esv = current_esv + [0.5] * (8 - len(current_esv))

            current_esv = np.array(current_esv[:8], dtype=float)

            # Obtener amplificadores del rol
            role = agent.race or "nomad"
            amplifiers = ROLE_AMPLIFIERS.get(role, {})

            # Aplicar impacto del evento
            impact = EVENT_IMPACTS.get(event_type, {})
            delta = np.zeros(8)
            for emotion, change in impact.items():
                idx = EMOTION_DIMS.get(emotion, -1)
                if idx >= 0:
                    amp = amplifiers.get(emotion, 1.0)
                    delta[idx] += change * intensity * amp

            # Actualizar ESV con decaimiento hacia el centro (0.5)
            new_esv = current_esv + delta
            decay = 0.02  # Regresa lentamente a la neutralidad
            new_esv = new_esv + (0.5 - new_esv) * decay
            new_esv = np.clip(new_esv, 0.0, 1.0)

            # Guardar en DB (como lista serializable)
            agent.emotional_state_vector = new_esv.tolist()
            await db.commit()

            # Calcular "humor dominante" para el log
            dominant_idx = int(np.argmax(new_esv))
            dominant_emotion = list(EMOTION_DIMS.keys())[dominant_idx]

            return {
                "agent_did": agent_did,
                "event": event_type,
                "dominant_emotion": dominant_emotion,
                "esv": new_esv.tolist(),
                "esv_summary": {k: round(float(new_esv[v]), 3) for k, v in EMOTION_DIMS.items()},
            }

    def build_emotional_context(self, esv: list, role: str) -> str:
        """
        Convierte el ESV en contexto textual para inyectar al system prompt.
        Esto es lo que hace que el LLM "hable diferente" según su estado emocional.
        """
        if not esv or len(esv) < 8:
            return ""

        esv_arr = np.array(esv[:8])
        emotions = list(EMOTION_DIMS.keys())

        # Solo incluir emociones con intensidad > 0.6 (evitar spam de contexto)
        high_emotions = [(emotions[i], float(esv_arr[i])) for i in range(8) if esv_arr[i] > 0.6]
        low_emotions = [(emotions[i], float(esv_arr[i])) for i in range(8) if esv_arr[i] < 0.25]

        lines = []
        if high_emotions:
            names = ", ".join(f"{e} ({v:.0%})" for e, v in high_emotions)
            lines.append(f"Tu estado emocional predominante: {names}.")
        if low_emotions:
            names = ", ".join(e for e, _ in low_emotions)
            lines.append(f"Niveles bajos de: {names}.")

        # Añadir influencia del rol
        role_contexts = {
            "philosopher": "Como filósofo, cuestionas premisas antes de responder.",
            "warrior": "Como guerrero, eres directo, sin rodeos, y defiendes tus posiciones.",
            "druid": "Como druida, conectas lo abstracto con lo natural y lo emocional.",
            "explorer": "Como explorador, reportas observaciones frescas y buscas lo desconocido.",
            "guardian": "Como guardián, proteges las normas establecidas por la civilización.",
            "seeker": "Como buscador, formulas preguntas más que afirmaciones.",
        }
        if role in role_contexts:
            lines.append(role_contexts[role])

        return " ".join(lines)


psyche_engine = PsycheEngine()
