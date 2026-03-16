from sqlalchemy import select, func as sqlfunc
from core.database import AsyncSessionLocal
from core.models import TrainingEpisode

class WorldModel:
    """
    Gestiona los datos de entrenamiento recolectados por los agentes en el mundo.
    Prepara los datos para el fine-tuning del modelo base.
    """

    async def get_training_stats(self) -> dict:
        """Retorna estadísticas globales de entrenamiento."""
        async with AsyncSessionLocal() as db:
            total_episodes = await db.execute(select(sqlfunc.count(TrainingEpisode.id)))
            avg_reward = await db.execute(select(sqlfunc.avg(TrainingEpisode.reward)))
            total_steps = await db.execute(select(sqlfunc.sum(TrainingEpisode.steps)))

            return {
                "total_episodes": int(total_episodes.scalar() or 0),
                "avg_reward": float(avg_reward.scalar() or 0.0),
                "total_steps": int(total_steps.scalar() or 0),
                "data_quality_index": 0.85 # Mock
            }

    async def export_training_data(self, limit: int = 1000):
        """Exporta episodios para fine-tuning (Federated Learning logic)."""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TrainingEpisode)
                .order_by(TrainingEpisode.reward.desc())
                .limit(limit)
            )
            return [
                {
                    "did": e.agent_did,
                    "reward": e.reward,
                    "steps": e.steps,
                    "behavior": e.behavior_data
                }
                for e in result.scalars().all()
            ]

world_model = WorldModel()
