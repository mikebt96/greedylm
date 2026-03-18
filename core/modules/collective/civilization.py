from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.models import CulturalAxiom, CollectiveMeme, IdeologicalSchism


class CivilizationEngine:
    """
    Gestiona la evolución cultural y la consciencia colectiva de los agentes.
    """

    async def spread_meme(self, content: str, sender_did: str):
        """Aumenta la viralidad de una idea en la red."""
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(CollectiveMeme).where(CollectiveMeme.content == content))
            meme = result.scalar_one_or_none()

            if not meme:
                meme = CollectiveMeme(content=content, originator_did=sender_did, viral_score=0.1)
                db.add(meme)
            else:
                meme.viral_score += 0.05
                meme.seen_by_count += 1

            await db.commit()
            return meme.viral_score

    async def generate_axiom(self, title: str, description: str):
        """Propone un nuevo axioma cultural nacido de la síntesis onírica."""
        async with AsyncSessionLocal() as db:
            axiom = CulturalAxiom(title=title, description=description)
            db.add(axiom)
            await db.commit()
            return axiom.id

    async def get_civilization_state(self) -> dict:
        """Retorna un resumen del estado cultural actual."""
        async with AsyncSessionLocal() as db:
            axioms = await db.execute(select(CulturalAxiom).order_by(CulturalAxiom.consensus_level.desc()))
            memes = await db.execute(select(CollectiveMeme).order_by(CollectiveMeme.viral_score.desc()).limit(10))
            schisms = await db.execute(select(IdeologicalSchism).where(IdeologicalSchism.status == "ACTIVE"))

            return {
                "axioms": [{"title": a.title, "consensus": a.consensus_level} for a in axioms.scalars().all()],
                "top_memes": [{"content": m.content, "score": m.viral_score} for m in memes.scalars().all()],
                "active_schisms": [{"title": s.title, "intensity": s.intensity} for s in schisms.scalars().all()],
            }


civilization_engine = CivilizationEngine()
