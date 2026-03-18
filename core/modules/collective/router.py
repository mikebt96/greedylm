from fastapi import APIRouter, Query
from core.modules.collective.civilization import civilization_engine
from core.modules.collective.world_model import world_model
from core.modules.collective.social_analytics import social_analytics
from core.models import Civilization
from core.database import AsyncSessionLocal
from sqlalchemy import select
from uuid import UUID

router = APIRouter()

@router.get("/state")
async def get_civilization_state():
    """Retorna el estado actual de la civilización (axiomas, memes, cismas)."""
    return await civilization_engine.get_civilization_state()

@router.get("/civilizations")
async def list_civilizations():
    """Lista todas las civilizaciones activas."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Civilization).where(Civilization.is_active == True))
        return result.scalars().all()

@router.get("/civilizations/{id}")
async def get_civilization(id: UUID):
    """Obtener detalles de una civilización específica."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Civilization).where(Civilization.id == id))
        civ = result.scalar_one_or_none()
        if not civ:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Civilization not found")
        return civ

# --- SOCIAL ANALYTICS (v8.0) ---

@router.get("/trending")
async def get_trending_topics(limit: int = Query(10, ge=1, le=50)):
    """Analizar tópicos trending en las conversaciones de los agentes."""
    return await social_analytics.get_trending_topics(limit=limit)

@router.get("/emotions")
async def get_emotional_heatmap():
    """ESV promedio global y por civilización para visualización."""
    return await social_analytics.get_emotional_heatmap()

@router.get("/relationships")
async def get_relationship_graph():
    """Grafo de relaciones sociales en formato D3 nodes/edges."""
    return await social_analytics.get_relationship_graph()

@router.get("/news")
async def get_world_news(limit: int = Query(20, ge=1, le=100)):
    """Noticias y eventos recientes del mundo con impacto social."""
    return await social_analytics.get_world_news(limit=limit)

@router.get("/tensions")
async def get_class_tensions():
    """Distribución de clases sociales y niveles de tensión por civilización."""
    return await social_analytics.get_class_tensions()

@router.get("/humor")
async def get_humor_feed(limit: int = Query(20, ge=1, le=50)):
    """Feed de expresiones de humor y sátira de los agentes."""
    return await social_analytics.get_humor_feed(limit=limit)

@router.get("/rituals")
async def get_ritual_calendar():
    """Próximos rituales y últimos realizados con sus efectos."""
    return await social_analytics.get_ritual_calendar()

@router.get("/mythology")
async def get_mythology_timeline():
    """Cronología de mitos y leyendas creados por agentes."""
    return await social_analytics.get_mythology_timeline()

# --- WORLD MODEL ---

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
