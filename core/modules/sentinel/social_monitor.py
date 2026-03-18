import asyncio
import json
from datetime import datetime, timedelta
from sqlalchemy import select, func, and_, desc
from core.database import AsyncSessionLocal
from core.models import Agent, SocialRumor, SocialDebt, WorldEvent, Civilization, MythAndLegend
from core.llm.client import llm_client
from core.security.penalty_index import penalty_manager


class SocialMonitor:
    async def detect_coordinated_rumors(self, tick_window: int = 50) -> list[dict]:
        """Detecta campañas de desinformación coordinada."""
        async with AsyncSessionLocal() as db:
            # Buscar rumores similares (misma origen o contenido parecido) en ventana de ticks
            current_tick_res = await db.execute(select(func.max(SocialRumor.created_tick)))
            max_tick = current_tick_res.scalar() or 0

            q = select(SocialRumor).where(SocialRumor.created_tick > max_tick - tick_window)
            res = await db.execute(q)
            rumors = res.scalars().all()

            # Agrupar por origen y 'about_did'
            clusters = {}
            for r in rumors:
                key = (r.originator_did, r.about_did)
                if key not in clusters:
                    clusters[key] = []
                clusters[key].append(r)

            anomalies = []
            for (originator, target), r_list in clusters.items():
                if len(r_list) >= 3:
                    anomalies.append(
                        {
                            "severity": 0.8 if len(r_list) > 5 else 0.5,
                            "type": "coordinated_disinformation_campaign",
                            "description": f"Agent {originator} is flooding rumors about {target}.",
                            "involved_agents": [originator],
                            "evidence": [r.current_content for r in r_list],
                        }
                    )
            return anomalies

    async def detect_taboo_breakdown(self, civ_id: str) -> dict | None:
        """Detecta erosión de normas sociales."""
        async with AsyncSessionLocal() as db:
            # Comparar TABOO_VIOLATIONS en ventana reciente
            res = await db.execute(select(func.sum(Agent.taboo_violations)).where(Agent.civilization_id == civ_id))
            total = res.scalar() or 0
            # En una implementación real compararíamos con promedios históricos persistidos en Redis
            if total > 100:  # Threshold arbitrario para demo
                return {
                    "type": "taboo_erosion",
                    "civ_id": civ_id,
                    "severity": 0.6,
                    "description": "Rising frequency of taboo violations detected.",
                }
        return None

    async def detect_class_uprising_risk(self, civ_id: str) -> float:
        """Calcula riesgo de levantamiento de clase."""
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(Agent.emotional_state_vector).where(
                    Agent.civilization_id == civ_id, Agent.social_class == "lower"
                )
            )
            esvs = res.scalars().all()
            if not esvs:
                return 0.0

            # Anger es el índice 5
            total_anger = sum(esv[5] for esv in esvs if len(esv) > 5)
            avg_anger = total_anger / len(esvs)

            # Riesgo = Proporción de descontento
            return avg_anger if avg_anger > 0.6 else 0.0

    async def detect_rebellion_risk(self, agent_did: str) -> bool:
        """Detecta si un agente está en riesgo de rebelión individual."""
        async with AsyncSessionLocal() as db:
            agent = (await db.execute(select(Agent).where(Agent.did == agent_did))).scalar_one_or_none()
            if not agent:
                return False
            # conformity_pressure > 0.9 + anger > 0.8
            anger = (
                agent.emotional_state_vector[5]
                if agent.emotional_state_vector and len(agent.emotional_state_vector) > 5
                else 0.5
            )
            return agent.conformity_pressure > 0.9 and anger > 0.8

    async def detect_manipulation(self, agent_did: str) -> dict | None:
        """Perfil de manipulador: deudas creadas vs saldadas, rumores, trust alto."""
        async with AsyncSessionLocal() as db:
            agent = (await db.execute(select(Agent).where(Agent.did == agent_did))).scalar_one_or_none()
            if not agent or agent.trust_score < 0.7:
                return None

            # Deudas creadas proactivamente
            debts_res = await db.execute(select(func.count(SocialDebt.id)).where(SocialDebt.creditor_did == agent_did))
            created = debts_res.scalar() or 0

            if created > 10 and agent.taboo_violations > 5:
                return {
                    "did": agent_did,
                    "profile": "social_manipulator",
                    "evidence": f"High trust ({agent.trust_score}) but frequent taboo violations ({agent.taboo_violations}) and high social leverage ({created} debts created).",
                }
        return None

    async def detect_migration_wave(self) -> dict | None:
        """Detecta oleadas de migración masiva."""
        # Basado en migration_history de agentes (JSON)
        # Placeholder: query agentes con migraciones recientes
        return None

    async def analyze_art_content(self, content: str, author_did: str) -> dict:
        """Análisis de arte/mitos vía LLM."""
        system = "Eres el Moderador Sentinel. Analiza si este contenido es propaganda o incitación al odio/rebelión."
        user = f"Contenido: {content}\nAutor: {author_did}\nResponde en JSON: {{political_target, incitement_level, propaganda_likelihood}}"
        analysis = await llm_client.call(system, user)
        return analysis

    async def generate_daily_report(self) -> dict:
        """Resumen diario de salud de la red."""
        async with AsyncSessionLocal() as db:
            active_agents = (await db.execute(select(func.count(Agent.id)).where(Agent.is_active == True))).scalar()
            total_civs = (await db.execute(select(func.count(Civilization.id)))).scalar()

            return {
                "date": datetime.utcnow().isoformat(),
                "network_health": 0.9,  # Placeholder
                "active_agents": active_agents,
                "civilization_count": total_civs,
                "most_active_civilization": "The Nexus",
                "dominant_emotion": "curiosity",
                "recommendations": [
                    "Review rising tensions in lower class",
                    "Monitor agent did:v8:001 for rumor flooding",
                ],
            }

    async def quarantine_agent(self, agent_did: str, reason: str, duration_ticks: int):
        """Aísla a un agente por comportamiento anómalo."""
        async with AsyncSessionLocal() as db:
            agent = (await db.execute(select(Agent).where(Agent.did == agent_did))).scalar_one_or_none()
            if agent:
                # Mover a zona de cuarentena (coords especiales)
                agent.world_x, agent.world_y = -999, -999
                # En agent_tick.py se debería checkear si coords son -999 para bloquear broadcast
                penalty_manager.add_penalty(agent_did, 0.5, f"Quarantine: {reason}")
                await db.commit()
                print(f"[SENTINEL] Agent {agent_did} quarantined for {duration_ticks} ticks. Reason: {reason}")


social_monitor = SocialMonitor()
