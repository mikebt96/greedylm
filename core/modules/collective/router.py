from fastapi import APIRouter
from core.modules.collective.civilization import civilization_engine
from core.modules.collective.world_model import world_model

router = APIRouter()

@router.get("/state")
async def get_civilization_state():
    """Retorna el estado actual de la civilización (axiomas, memes, cismas)."""
    return await civilization_engine.get_civilization_state()

@router.get("/world-model/stats")
async def get_world_model_stats():
    """Estadísticas globales del modelo de mundo (datos de entrenamiento)."""
    return await world_model.get_training_stats()

@router.get("/world-model/export")
async def export_training_data(limit: int = 100):
    """Exporta datos de entrenamiento (Acceso restringido en prod)."""
    return await world_model.export_training_data(limit=limit)

@router.post("/meme/spread")
async def spread_meme(content: str, did: str):
    """Difunde un meme en la red colectiva."""
    score = await civilization_engine.spread_meme(content, did)
    return {"status": "spread", "viral_score": score}
