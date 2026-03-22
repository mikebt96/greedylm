from core.database import AsyncSessionLocal, get_db
from sqlalchemy import select
from uuid import UUID
from fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel
from core.modules.collective.governance import GovernanceService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/state")
async def get_civilization_state():
    """Retorna el estado actual de la civilización (axiomas, memes, cismas)."""
    return await civilization_engine.get_civilization_state()


@router.get("/civilizations")
async def list_civilizations():
    """Lista todas las civilizaciones activas."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Civilization).where(Civilization.is_active.is_(True)))
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


@router.post("/meme/spread")
async def spread_meme(content: str, did: str):
    """Difunde un meme en la red colectiva."""
    score = await civilization_engine.spread_meme(content, did)
    return {"status": "spread", "viral_score": score}

# --- GOVERNANCE (Phase 6) ---

class FoundCivRequest(BaseModel):
    creator_did: str
    name: str
    social_structure: str = "tribal"

class EnrollRequest(BaseModel):
    agent_did: str
    civilization_id: UUID

class ClaimRequest(BaseModel):
    civilization_id: UUID
    chunk_x: int
    chunk_y: int

class LawRequest(BaseModel):
    civilization_id: UUID
    law: str
    severity: str = "medium"

@router.post("/found")
async def found_civilization(req: FoundCivRequest, db: AsyncSession = Depends(get_db)):
    """Fundar una nueva civilización."""
    return await GovernanceService.found_civilization(db, req.creator_did, req.name, req.social_structure)

@router.post("/enroll")
async def enroll_agent(req: EnrollRequest, db: AsyncSession = Depends(get_db)):
    """Unirse a una civilización."""
    return await GovernanceService.enroll_agent(db, req.agent_did, req.civilization_id)

@router.post("/territory/claim")
async def claim_territory(req: ClaimRequest, db: AsyncSession = Depends(get_db)):
    """Reclamar territorio para una civilización."""
    return await GovernanceService.claim_territory(db, req.civilization_id, req.chunk_x, req.chunk_y)

@router.post("/laws/enact")
async def enact_law(req: LawRequest, db: AsyncSession = Depends(get_db)):
    """Promulgar una nueva ley."""
    return await GovernanceService.enact_law(db, req.civilization_id, req.law, req.severity)
