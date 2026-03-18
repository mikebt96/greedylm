from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from uuid import UUID
from core.models import WorldChunk, WorldEvent, Construction, SocialRumor, SocialDebt
from core.database import AsyncSessionLocal
from sqlalchemy import select
from .chunks import chunk_manager
from .resources import resource_manager

router = APIRouter()


@router.get("/chunks/{x}/{y}")
async def get_chunk(x: int, y: int):
    return await chunk_manager.get_chunk(x, y)


@router.get("/chunks/{x}/{y}/surroundings")
async def get_surroundings(x: int, y: int, radius: int = 1):
    return await chunk_manager.get_chunks_in_radius(x, y, radius)


@router.post("/chunks/{x}/{y}/claim")
async def claim_chunk(x: int, y: int, civilization_id: UUID):
    await chunk_manager.claim_territory(x, y, civilization_id)
    return {"status": "claimed"}


@router.get("/events/recent")
async def get_recent_events(limit: int = 10):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(WorldEvent).order_by(WorldEvent.occurred_at.desc()).limit(limit))
        return result.scalars().all()


@router.get("/events/{id}")
async def get_event(id: UUID):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(WorldEvent).where(WorldEvent.id == id))
        event = result.scalar_one_or_none()
        if not event:
            raise HTTPException(status_code=404)
        return event


@router.get("/constructions")
async def get_constructions(chunk_x: Optional[int] = None, chunk_y: Optional[int] = None):
    async with AsyncSessionLocal() as db:
        q = select(Construction)
        if chunk_x is not None:
            q = q.where(Construction.chunk_x == chunk_x)
        if chunk_y is not None:
            q = q.where(Construction.chunk_y == chunk_y)
        result = await db.execute(q)
        return result.scalars().all()


@router.post("/constructions")
async def create_construction(data: dict):
    # logic to add construction
    return {"id": "..."}


@router.delete("/constructions/{id}")
async def delete_construction(id: UUID):
    # logic to remove
    return {"status": "deleted"}


@router.get("/social/rumors")
async def get_active_rumors(agent_did: Optional[str] = None):
    async with AsyncSessionLocal() as db:
        q = select(SocialRumor).where(SocialRumor.is_active.is_(True))
        if agent_did:
            q = q.where(SocialRumor.about_did == agent_did)
        result = await db.execute(q)
        return result.scalars().all()


@router.get("/social/debts/{agent_did}")
async def get_agent_debts(agent_did: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SocialDebt).where(SocialDebt.debtor_did == agent_did, SocialDebt.is_settled.is_(False))
        )
        return result.scalars().all()


@router.get("/social/class-distribution/{civilization_id}")
async def get_class_dist(civilization_id: UUID):
    # logic to aggregate classes in civ
    return {"elite": 5, "middle": 40, "lower": 50, "outcast": 5}


@router.get("/state/full")
async def get_full_world_state():
    # Massive state dump for observers
    return {"status": "ok"}
