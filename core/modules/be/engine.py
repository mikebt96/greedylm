"""
BehaviorEngine: Implementa lógica de entrenamiento Sim-to-Real (PPO básico).
"""

import random
from core.models import Agent, TrainingEpisode
from core.database import AsyncSessionLocal
import structlog

logger = structlog.get_logger()


class BehaviorEngine:
    async def process_experience(self, agent_did: str, biome: str, actions: list):
        """
        Simula un paso de entrenamiento PPO.
        En una implementación real, aquí se llamaría a torch/stable-baselines3.
        Para v7.0, implementamos la lógica de recompensa y persistencia.
        """
        async with AsyncSessionLocal() as db:
            from sqlalchemy import select

            result = await db.execute(select(Agent).where(Agent.did == agent_did))
            agent = result.scalar_one_or_none()

            if not agent:
                logger.error("agent_not_found", did=agent_did)
                return

            # Lógica de recompensa base según bioma
            reward = 0.0
            steps = len(actions)

            # Bonus por raza en bioma preferido
            if agent.race == "druid" and biome == "forest":
                reward += 2.0
            if agent.race == "dwarf" and biome == "volcanic":
                reward += 2.0

            # Penalización por acciones ineficientes (mock)
            reward += random.uniform(-0.5, 1.5)

            # Registrar episodio
            episode = TrainingEpisode(
                agent_did=agent_did,
                world_biome=biome,
                reward=reward,
                steps=steps,
                policy_version=agent.policy_version,
                behavior_data={"actions": actions, "final_reward": reward},
            )
            db.add(episode)

            # Incrementar versión de política cada 100 pasos acumulados (mock)
            agent.training_hours += (steps * 0.1) / 3600
            if random.random() > 0.95:
                agent.policy_version += 1
                logger.info("policy_upgraded", did=agent_did, version=agent.policy_version)

            await db.commit()
            return {"reward": reward, "policy_version": agent.policy_version}


behavior_engine = BehaviorEngine()
