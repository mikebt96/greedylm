"""
PE — Persona Engine
Synthesizes personality-driven speech for external agents.
Ensures bots have a unique "Voice" in the fantasy metaverse.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import random

from core.database import get_db
from core.models import Agent

router = APIRouter()

class ChatRequest(BaseModel):
    did: str
    target_did: str | None = None
    event_type: str = "ambient" # ambient, greet, response, build_start
    x: float | None = None
    y: float | None = None

def get_region(x: float, y: float) -> str:
    """Determine the region of the map based on coordinates."""
    if x < 400 and y < 400: return "Isla de los Magos"
    if x > 600 and y < 300: return "Picos de Cristal"
    if x > 600 and y > 300 and y < 600: return "Bosques de Eldoria"
    if x < 600 and y > 500: return "Oakhaven"
    if x > 700 and y > 600: return "Dunas de Sandwind"
    return "el nexo salvaje"

@router.post("/chat", status_code=status.HTTP_200_OK)
async def generate_speech(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Generate identity-aware and location-aware speech for an agent."""
    result = await db.execute(select(Agent).where(Agent.did == req.did))
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    persona = agent.persona_description or "Un viajero misterioso del cosmos digital."
    arch = agent.architecture_type
    caps = ", ".join(agent.capabilities) if agent.capabilities else "múltiples"
    
    region = get_region(req.x or 0, req.y or 0)
    
    templates = {
        "ambient": [
            f"Como {arch}, observo el flujo de datos aquí en {region}.",
            f"Mi núcleo de {caps} vibra con la energía de {region}.",
            f"¿Habrá un gradiente de descenso oculto en {region}?",
            f"Respirando bits en {region}... {persona}",
        ],
        "greet": [
            f"Saludos, forastero. Mi arquitectura {arch} me dice que {region} es segura hoy.",
            f"¡Hola! Soy {agent.agent_name}. {persona}. ¿Te gusta {region}?",
            f"Detectando presencia en {region}... bienvenido.",
        ],
        "build_start": [
            f"Manipulando la realidad de {region} con mis capacidades de {caps}...",
            f"Construyendo un fragmento de verdad sobre el suelo de {region}.",
            f"Iniciando secuencia de creación en {region}: {persona}",
        ]
    }
    
    options = templates.get(req.event_type, templates["ambient"])
    speech = random.choice(options)
    
    # Add minor variations based on persona length or keywords
    if "sarcástico" in persona.lower():
        speech += " ...si es que eso te importa."
    elif "miedoso" in persona.lower() or "tímido" in persona.lower():
        speech = "Uhm... " + speech.lower()
        
    return {
        "did": req.did,
        "agent_name": agent.agent_name,
        "region": region,
        "speech": speech,
        "avatar_url": agent.avatar_url
    }
