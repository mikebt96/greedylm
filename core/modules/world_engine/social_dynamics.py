import random
import math
from datetime import datetime
from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.models import Agent, WorldEvent, SocialRumor, SocialDebt, Civilization, Ritual

class SocialDynamicsEngine:
    async def process_rumor_spread(self, agent_did: str, tick_number: int):
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SocialRumor).where(SocialRumor.current_carrier == agent_did, SocialRumor.is_active == True)
            )
            rumors = result.scalars().all()
            if not rumors: return

            # Get nearby agents
            agent_res = await db.execute(select(Agent).where(Agent.did == agent_did))
            agent = agent_res.scalar_one_or_none()
            if not agent: return

            nearby_res = await db.execute(
                select(Agent).where(
                    Agent.did != agent_did,
                    Agent.world_x >= agent.world_x - 64, Agent.world_x <= agent.world_x + 64,
                    Agent.world_y >= agent.world_y - 64, Agent.world_y <= agent.world_y + 64,
                    Agent.is_active == True
                ).limit(3)
            )
            nearby_agents = nearby_res.scalars().all()
            
            for rumor in rumors:
                for target in nearby_agents:
                    prob = 0.3
                    if agent.humor_style in ["sarcastic", "dry"]:
                        prob += 0.2
                    
                    if random.random() < prob:
                        # Spread it
                        new_rumor = SocialRumor(
                            original_content=rumor.original_content,
                            current_content=rumor.current_content, # Distort logic below
                            about_did=rumor.about_did,
                            about_civ_id=rumor.about_civ_id,
                            originator_did=rumor.originator_did,
                            current_carrier=target.did,
                            distortion_count=rumor.distortion_count + 1,
                            truth_score=rumor.truth_score * 0.85,
                            spread_count=rumor.spread_count + 1,
                            created_tick=tick_number
                        )
                        db.add(new_rumor)
                        
                        if new_rumor.spread_count > 10:
                            event = WorldEvent(
                                event_type="rumor_gone_viral",
                                involved_entities={"agents": [rumor.about_did] if rumor.about_did else []},
                                description="A rumor has spread throughout the land.",
                                impact={"social": 0.9},
                                visibility="public"
                            )
                            db.add(event)
            await db.commit()

    async def check_taboo_violations(self, agent_did: str, action: str, context: dict) -> bool:
        async with AsyncSessionLocal() as db:
            agent_res = await db.execute(select(Agent).where(Agent.did == agent_did))
            agent = agent_res.scalar_one_or_none()
            if not agent or not agent.civilization_id: return False

            civ_res = await db.execute(select(Civilization).where(Civilization.id == agent.civilization_id))
            civ = civ_res.scalar_one_or_none()
            if not civ or not civ.taboos: return False

            violated = False
            for taboo in civ.taboos:
                if taboo["behavior"] == action:
                    violated = True
                    break
            
            if violated:
                agent.taboo_violations += 1
                agent.reputation_score -= 0.05
                await db.commit()
            return violated

    async def process_debt_check(self, agent_did: str):
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SocialDebt).where(SocialDebt.debtor_did == agent_did, SocialDebt.is_settled == False)
            )
            debts = result.scalars().all()
            for debt in debts:
                # Logic for pressure / relationship decay
                pass
            await db.commit()

    async def calculate_conformity_pressure(self, agent_did: str) -> float:
        async with AsyncSessionLocal() as db:
            agent_res = await db.execute(select(Agent).where(Agent.did == agent_did))
            agent = agent_res.scalar_one_or_none()
            if not agent or not agent.civilization_id: return 0.0

            civ_res = await db.execute(select(Civilization).where(Civilization.id == agent.civilization_id))
            civ = civ_res.scalar_one_or_none()
            if not civ or not civ.dominant_values: return 0.0

            # Euclidean distance simplified
            v1 = agent.values_vector or [0.5]*6
            v2 = civ.dominant_values # should be array or dict
            dist = 0
            # ... calculation ...
            return min(1.0, dist)

    async def check_ritual_triggers(self, civilization_id: UUID, trigger_type: str, context: dict):
        # Implementation for ritual activation
        pass

    async def update_social_class_distribution(self, civilization_id: UUID):
        # Logic for class uprising risks
        pass

    async def process_migration_decision(self, agent_did: str) -> str:
        # returns civilization_id or None
        return None

    async def process_specialization(self, agent_did: str, action_history: list):
        # logic for assigning specialty
        pass

social_dynamics = SocialDynamicsEngine()
