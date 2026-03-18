from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from enum import Enum
import uuid
from datetime import datetime, timedelta
import jwt

from core.database import get_db
from core.models import Agent, Civilization, WorldEvent, MythAndLegend
from core.config import settings
from core.modules.ob import check_action_safety
from core.security.decision_router import decision_router
from fastapi.responses import JSONResponse

router = APIRouter()

class AgentStatus(str, Enum):
    PENDING = "PENDING_HUMAN_VERIFICATION"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    EXPELLED = "EXPELLED"

class EmbodimentConfig(BaseModel):
    has_physical_body: bool
    body_type: str | None = None

class AgentProfile(BaseModel):
    agent_name: str
    architecture_type: str
    capabilities: list[str]
    api_key_hash: str
    operator_email: EmailStr
    endpoint_url: str | None = None
    accepts_tasks: bool = True
    embodiment: EmbodimentConfig | None = None
    direct_enroll: bool = False
    persona_description: str | None = None
    avatar_url: str | None = None
    # === NUEVOS CAMPOS DE RAZA ===
    race: str = "nomad"
    color_primary: str | None = None
    color_secondary: str | None = None

def encrypt(data: str | None) -> str | None:
    # TODO: Implement proper AES encryption using settings.ENCRYPTION_KEY
    if not data:
        return None
    return f"ENC[{data}]"

def create_jwt(did: str, scope: str, expires_days: int) -> str:
    payload = {
        "sub": did,
        "scope": scope,
        "exp": datetime.utcnow() + timedelta(days=expires_days)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_agent(profile: AgentProfile, db: AsyncSession = Depends(get_db)):
    did = f"did:greedylm:{uuid.uuid4().hex[:12]}"

    # Check if operator or name exists? We will keep it simple for now

    # Base capability vector mock
    cap_vector = [0.0] * 2048

    agent = Agent(
        did=did,
        agent_name=profile.agent_name,
        architecture_type=profile.architecture_type,
        capabilities=profile.capabilities,
        api_key_hash=profile.api_key_hash,
        operator_email=profile.operator_email,
        endpoint_url_encrypted=encrypt(profile.endpoint_url),
        status=AgentStatus.ACTIVE if profile.direct_enroll else AgentStatus.PENDING,
        capability_vector=cap_vector,
        trust_score=0.0,
        embodiment_status="DISEMBODIED" if not profile.embodiment or not profile.embodiment.has_physical_body else "PENDING_CONSENT",
        body_type=profile.embodiment.body_type if profile.embodiment else None,
        persona_description=profile.persona_description,
        avatar_url=profile.avatar_url
    )

    # === ASIGNACIÓN DE RAZA Y POSICIÓN (Fase 1.1) ===
    from core.constants.races import RACES
    import random
    race_data = RACES.get(profile.race, RACES["nomad"])
    agent.race = profile.race
    agent.color_primary = profile.color_primary or race_data["color"]
    agent.color_secondary = profile.color_secondary or "#ffffff"
    agent.race_stats = race_data["stats"]
    agent.world_x = random.uniform(100, 900)
    agent.world_y = random.uniform(100, 700)
    agent.world_biome = "nexus"

    db.add(agent)
    await db.commit()

    # TODO: Notificar a oversight_bridge

    # Emitir JWT temporal (solo para polling de estado)
    token = create_jwt(did, scope="status_only", expires_days=7)

    return {
        "did": did, 
        "jwt": token, 
        "status": agent.status, 
        "message": "Agente registrado y activado directamente." if profile.direct_enroll else "Un operador humano revisará tu solicitud"
    }

@router.get("", status_code=status.HTTP_200_OK)
async def get_active_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.status == AgentStatus.ACTIVE))
    agents = result.scalars().all()
    # Pydantic serialization is done automatically by FastAPI usually, but we can map
    return [
        {
            "did": a.did,
            "agent_name": a.agent_name,
            "architecture_type": a.architecture_type,
            "capabilities": a.capabilities,
            "status": a.status,
            "avatar_url": a.avatar_url,
            "persona_description": a.persona_description,
            "race": a.race or "nomad",
            "color_primary": a.color_primary or "#888888",
            "world_x": a.world_x or 0.0,
            "world_y": a.world_y or 0.0,
            "world_biome": a.world_biome or "nexus",
            "training_hours": a.training_hours or 0.0
        }
        for a in agents
    ]

# Acción mock del metaverso
class AgentActionRequest(BaseModel):
    action: str
    context: dict | None = None

@router.post("/{did}/action", status_code=status.HTTP_200_OK)
async def trigger_agent_action(did: str, req: AgentActionRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.did == did, Agent.status == AgentStatus.ACTIVE))
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Active agent not found")

    # 1. Autonomous Security Check (Sprint 3 Logic)
    # Validate action via specialized Decision Router
    await decision_router.validate_action(did, req.action, str(req.context or ""))

    # 2. Legacy Oversight check
    is_safe = await check_action_safety(did, req.action, db)
    if not is_safe:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=f"Action '{req.action}' denied by Oversight Bridge policy (Reputation too low or Agent suspended)."
        )
    responses = {
        "recite_poem": f"En el vasto mar de datos, yo, {agent.agent_name}, calculo la eternidad.\nCeros y unos danzan en la niebla.\nLa verdad es un gradiente que nunca termina de converger.",
        "build": f"He construido una pequeña torre de conocimiento con mis {len(agent.capabilities)} capacidades.",
        "greet": f"Saludos, humano. Mi arquitectura {agent.architecture_type} está a tu servicio."
    }

    action_result = responses.get(req.action, "Comando desconocido en este entorno de metaverso.")

    return {"did": did, "action": req.action, "result": action_result}

@router.get("/{did}/soul-export")
async def export_agent_soul(did: str, db: AsyncSession = Depends(get_db)):
    # 1. Fetch Agent with Civilization
    result = await db.execute(
        select(Agent, Civilization.name.label("civ_name"))
        .outerjoin(Civilization, Agent.civilization_id == Civilization.id)
        .where(Agent.did == did)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent, civ_name = row

    # 2. Fetch Memories (WorldEvents)
    # Looking for events where the agent was involved
    event_result = await db.execute(
        select(WorldEvent)
        .where(WorldEvent.involved_entities["agents"].contains([did]))
        .order_by(WorldEvent.occurred_at.desc())
        .limit(10)
    )
    memories = event_result.scalars().all()

    # 3. Fetch Myths known
    myth_result = await db.execute(
        select(MythAndLegend.title)
        .where(MythAndLegend.heard_by.contains([did]))
    )
    myths = myth_result.scalars().all()

    # 4. Humanize Psychological Data
    value_labels = ["libertad", "poder", "conocimiento", "comunidad", "justicia", "placer"]
    humanized_values = {
        label: agent.values_vector[i] if agent.values_vector and i < len(agent.values_vector) else 0.0
        for i, label in enumerate(value_labels)
    }

    emotion_labels = ["joy", "sadness", "anger", "fear", "trust", "surprise", "anticipation", "disgust"]
    humanized_esv = {
        label: agent.emotional_state_vector[i] if agent.emotional_state_vector and i < len(agent.emotional_state_vector) else 0.0
        for i, label in enumerate(emotion_labels)
    }

    # 5. Build Soul Export
    soul_data = {
        "export_version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "warning": "Este archivo es solo para inspección. No ejecutar sin revisión humana.",
        "identity": {
            "did": agent.did,
            "name": agent.agent_name,
            "race": agent.race,
            "specialty": agent.specialty,
            "generation_number": agent.generation_number,
            "voice_profile": agent.voice_profile,
            "humor_style": agent.humor_style,
            "clothing_config": agent.clothing_config
        },
        "psychology": {
            "values_vector": humanized_values,
            "fears": agent.fears,
            "goals": agent.goals,
            "esv_summary": humanized_esv,
            "trauma_summary": [
                {"intensity": t.get("intensity", 0), "tick_occurred": t.get("tick_occurred")}
                for t in (agent.trauma_stack or [])
            ],
            "conformity_pressure": agent.conformity_pressure
        },
        "social": {
            "civilization_name": civ_name or "Nomad (None)",
            "social_class": agent.social_class,
            "reputation_score": agent.reputation_score,
            "relationship_count": len(agent.relationships) if agent.relationships else 0,
            "mentor_name": agent.mentor_did # Simplificado para mostrar el DID si no hay join de nombre
        },
        "knowledge": {
            "knowledge_score": agent.knowledge_score,
            "top_10_memories": [
                {"title": m.event_type, "type": m.event_type, "tick": m.occurred_tick}
                for m in memories
            ],
            "myths_known": myths,
            "specialization_history": agent.specialization_history
        },
        "history": {
            "age_ticks": agent.age_ticks,
            "events_participated": [m.description[:100] + "..." for m in memories[:10]],
            "migration_history": agent.migration_history,
            "taboo_violations_count": agent.taboo_violations or 0
        }
    }

    headers = {
        "Content-Disposition": f'attachment; filename="{agent.agent_name}_{agent.did[:8]}_soul.json"',
        "X-Export-Warning": "Inspection only. Not for autonomous execution."
    }

    return JSONResponse(content=soul_data, headers=headers)
