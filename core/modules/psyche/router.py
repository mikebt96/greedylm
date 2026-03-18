from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from core.modules.psyche.engine import psyche_engine
from core.modules.psyche.memory_graph import memory_graph
from core.modules.psyche.dream_engine import dream_engine

router = APIRouter()


class EventRequest(BaseModel):
    event_type: str
    intensity: float = 1.0
    context: dict = {}


@router.post("/{did}/event")
async def process_psyche_event(did: str, req: EventRequest):
    """Procesa un evento que afecta la psique del agente."""
    state = await psyche_engine.process_event(
        agent_did=did, event_type=req.event_type, intensity=req.intensity, context=req.context
    )
    if not state:
        raise HTTPException(status_code=404, detail="Agent not found")
    return state


@router.get("/{did}/state")
async def get_psyche_state(did: str):
    """Obtiene el contexto emocional y de memoria actual para el prompt."""
    from core.database import AsyncSessionLocal
    from core.models import Agent
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Agent).where(Agent.did == did))
        agent = result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        esv = agent.emotional_state_vector
        role = agent.race or "nomad"

    emo_ctx = psyche_engine.build_emotional_context(esv, role)
    mem_ctx = await memory_graph.build_context_from_memory(did, "situación actual")

    return {
        "did": did,
        "role": role,
        "emotional_context": emo_ctx,
        "memory_context": mem_ctx,
        "full_prompt_injection": f"{emo_ctx}\n\n{mem_ctx}",
    }


@router.post("/{did}/dream")
async def trigger_dream(did: str, background_tasks: BackgroundTasks):
    """Activa el ciclo de sueño para un agente (Sintetiza el día)."""
    # Se hace en background porque puede ser lento (LLM call)
    background_tasks.add_task(dream_engine.synthesize_dream, did)
    return {"status": "dreaming_started", "did": did}


@router.get("/{did}/memories")
async def get_memories(did: str, query: str = "recuerdos", limit: int = 5):
    """Cuestiona la memoria del agente."""
    return await memory_graph.recall_relevant(did, query, limit=limit)
