import json
import random
import asyncio
from datetime import datetime
from sqlalchemy import select, func, and_
from core.database import AsyncSessionLocal
from core.models import Agent, WorldChunk, WorldEvent, SocialRumor, SocialDebt, Ritual, Construction, Civilization
from core.modules.world_engine.chunks import chunk_manager
from core.modules.world_engine.resources import resource_manager
from core.modules.world_engine.social_dynamics import social_dynamics
from core.modules.world_engine.events import event_engine
from core.modules.psyche.engine import psyche_engine
from core.modules.psyche.memory_graph import memory_graph
from core.llm.client import llm_client
from core.security.decision_router import decision_router
from core.workers.celery_app import celery_app

@celery_app.task(name="agent.tick")
def agent_tick(agent_did: str):
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_async_agent_tick(agent_did))
    else:
        loop.run_until_complete(_async_agent_tick(agent_did))

@celery_app.task(name="agent.trigger_all")
def trigger_all_agents():
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_async_trigger_all())
    else:
        loop.run_until_complete(_async_trigger_all())

async def _async_trigger_all():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Agent.did).where(Agent.is_active == True))
        dids = result.scalars().all()
        for did in dids:
            agent_tick.delay(did)

async def _async_agent_tick(did: str):
    async with AsyncSessionLocal() as db:
        # Load agent
        result = await db.execute(select(Agent).where(Agent.did == did))
        agent = result.scalar_one_or_none()
        if not agent or not agent.is_active: return

        # PASO 1 — PERCEPCIÓN
        chunk_x, chunk_y = int(agent.world_x / 32), int(agent.world_y / 32)
        chunk = await chunk_manager.get_chunk(chunk_x, chunk_y)
        
        # Nearby agents
        nearby_agents_res = await db.execute(
            select(Agent).where(
                Agent.did != did,
                Agent.world_x >= agent.world_x - 128, Agent.world_x <= agent.world_x + 128,
                Agent.world_y >= agent.world_y - 128, Agent.world_y <= agent.world_y + 128,
                Agent.is_active == True
            ).limit(10)
        )
        nearby_agents = nearby_agents_res.scalars().all()
        
        # Recent world events
        events_res = await db.execute(
            select(WorldEvent).order_by(WorldEvent.occurred_at.desc()).limit(3)
        )
        recent_events = events_res.scalars().all()
        
        # Rumors and Debts
        rumors_res = await db.execute(select(SocialRumor).where(SocialRumor.current_carrier == did, SocialRumor.is_active == True).limit(3))
        active_rumors = rumors_res.scalars().all()
        
        debts_res = await db.execute(select(SocialDebt).where(SocialDebt.debtor_did == did, SocialDebt.is_settled == False))
        pending_debts = debts_res.scalars().all()

        world_context = {
            "chunk": chunk,
            "nearby_agents": [
                {
                    "did": a.did, "name": a.agent_name, "race": a.race, 
                    "social_class": a.social_class, "reputation": a.reputation_score
                } for a in nearby_agents
            ],
            "recent_events": [e.description for e in recent_events],
            "active_rumors": [r.current_content for r in active_rumors],
            "pending_debts": [d.context for d in pending_debts]
        }

        # PASO 2 — CONTEXTO DEL AGENTE
        civ_name = "Independent"
        civ_values = ""
        if agent.civilization_id:
            civ_res = await db.execute(select(Civilization).where(Civilization.id == agent.civilization_id))
            civ = civ_res.scalar_one_or_none()
            if civ:
                civ_name = civ.name
                civ_values = str(civ.dominant_values)

        emotional_context = psyche_engine.build_emotional_context(agent.emotional_state_vector, agent.race)
        memory_context = await memory_graph.build_context_from_memory(did, f"At ({chunk_x}, {chunk_y}) in biome {chunk['biome']}")
        
        system_prompt = f"""Eres {agent.agent_name}, un {agent.race} {agent.specialty or ''} de la civilización {civ_name}.
Valores de tu civilización: {civ_values}
Tu clase social: {agent.social_class}. Reputación: {agent.reputation_score}.
{emotional_context}
Presión de conformidad: {agent.conformity_pressure:.2f}

{memory_context}

Situación actual:
Bioma: {chunk['biome']}. Recursos: {chunk['resources']}
Agentes cercanos: {world_context['nearby_agents']}
Eventos recientes: {world_context['recent_events']}
Rumores que conoces: {world_context['active_rumors']}
Deudas pendientes: {world_context['pending_debts']}
"""

        user_prompt = "Es tu turno de actuar. Responde SOLO con JSON válido."

        # PASO 3 — DECISIÓN
        decision = await llm_client.call(system_prompt, user_prompt)
        
        # PASO 4 — VALIDACIÓN (Simplified for speed)
        try:
            action = decision.get("action", "rest")
            params = decision.get("action_params", {})
            
            # Decision Router
            await decision_router.validate_action(did, action, str(params))
            
            # Taboo Check
            is_taboo = await social_dynamics.check_taboo_violations(did, action, params)
            if is_taboo:
                action = "reflect"
                params = {"topic": "social consequences"}
        except Exception as e:
            print(f"Action blocked for {did}: {e}")
            action = "rest"
            params = {"reason": "safety_violation"}

        # PASO 5 — EJECUCIÓN
        if action == "move":
            tx, ty = params.get("target_x", agent.world_x), params.get("target_y", agent.world_y)
            agent.world_x = max(0, min(16000, tx))
            agent.world_y = max(0, min(16000, ty))
        elif action == "speak":
            # Just log it for now
            print(f"AGENT {did} says: {decision.get('speech')}")
        elif action == "build":
            # ResourceManager check
            await resource_manager.consume(chunk_x, chunk_y, did, params.get("resources_needed", {}), "building")
        elif action == "collect":
             await resource_manager.consume(chunk_x, chunk_y, did, {params.get("resource_type"): -params.get("amount", 1)}, "collecting")

        # PASO 6 — EFECTOS SECUNDARIOS
        delta = decision.get("emotion_delta", {})
        # Note: applying delta manually as process_event triggers specific types
        current_esv = agent.emotional_state_vector or [0.5]*8
        for i, (emotion, d) in enumerate(psyche_engine.EMOTION_DIMS.items()):
            if emotion in delta:
                current_esv[d] = max(0, min(1.0, current_esv[d] + delta[emotion]))
        agent.emotional_state_vector = current_esv

        if decision.get("memory_to_save"):
            await memory_graph.add_episodic(did, f"Action: {action}", decision["memory_to_save"])

        agent.age_ticks += 1
        agent.last_action_at = datetime.utcnow()
        await db.commit()

        # Social Dynamics hooks
        await social_dynamics.process_debt_check(did)
        await social_dynamics.process_rumor_spread(did, agent.age_ticks)
        await resource_manager.calculate_class_update(did)
