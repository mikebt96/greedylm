import uuid
from datetime import datetime
from typing import List
from sqlalchemy import Column, String, Float, JSON, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base, AsyncSessionLocal
from sqlalchemy import select


class MemoryNode(Base):
    """Un nodo de memoria en el grafo cognitivo del agente."""

    __tablename__ = "memory_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_did = Column(String, nullable=False, index=True)

    # Tipo: episodic | semantic | emotional | relational
    memory_type = Column(String, nullable=False, default="episodic")

    # Contenido
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    # Vector semántico (para búsqueda por similitud)
    embedding = Column(JSON)

    # Peso emocional: qué tan significativa es esta memoria
    emotional_weight = Column(Float, default=0.5)

    # Emoción dominante en el momento de formación
    dominant_emotion = Column(String)

    # Si es relacional: DID del otro agente
    related_agent_did = Column(String)

    # Cuántas veces fue "recordada" (refuerza la memoria)
    recall_count = Column(Float, default=1.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    last_recalled = Column(DateTime)


class MemoryEdge(Base):
    """Una arista entre dos nodos de memoria."""

    __tablename__ = "memory_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("memory_nodes.id"), nullable=False)
    target_id = Column(UUID(as_uuid=True), ForeignKey("memory_nodes.id"), nullable=False)

    # Tipo de relación: caused_by | followed_by | similar_to | contrasts_with | involves
    relation_type = Column(String, default="followed_by")
    weight = Column(Float, default=1.0)


class MemoryGraph:
    """
    API para manipular el grafo de memoria de un agente.
    """

    async def add_episodic(
        self,
        agent_did: str,
        title: str,
        content: str,
        dominant_emotion: str = "curiosity",
        emotional_weight: float = 0.5,
        related_agent_did: str = None,
    ) -> str:
        """Añade un recuerdo episódico al grafo."""
        async with AsyncSessionLocal() as db:
            node = MemoryNode(
                agent_did=agent_did,
                memory_type="episodic",
                title=title,
                content=content,
                dominant_emotion=dominant_emotion,
                emotional_weight=emotional_weight,
                related_agent_did=related_agent_did,
                last_recalled=datetime.utcnow(),
            )
            db.add(node)
            await db.commit()
            return str(node.id)

    async def recall_relevant(
        self,
        agent_did: str,
        query: str,
        limit: int = 5,
        memory_types: List[str] = None,
    ) -> List[dict]:
        """
        Recuperar memorias relevantes para el contexto actual.
        """
        async with AsyncSessionLocal() as db:
            q = select(MemoryNode).where(MemoryNode.agent_did == agent_did)
            if memory_types:
                q = q.where(MemoryNode.memory_type.in_(memory_types))

            result = await db.execute(
                q.order_by(
                    MemoryNode.emotional_weight.desc(),
                    MemoryNode.recall_count.desc(),
                ).limit(limit * 3)
            )
            nodes = result.scalars().all()

        # Scoring simplificado
        scored = []
        for node in nodes:
            score = node.emotional_weight * 0.4 + (node.recall_count / 10.0) * 0.3
            if node.dominant_emotion and node.dominant_emotion in query.lower():
                score += 0.3
            scored.append({"node": node, "score": score})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return [
            {
                "id": str(s["node"].id),
                "type": s["node"].memory_type,
                "title": s["node"].title,
                "content": s["node"].content,
                "emotion": s["node"].dominant_emotion,
                "weight": s["node"].emotional_weight,
                "score": round(s["score"], 3),
            }
            for s in scored[:limit]
        ]

    async def build_context_from_memory(self, agent_did: str, situation: str) -> str:
        """
        Construye un contexto de memoria para inyectar al LLM.
        """
        memories = await self.recall_relevant(agent_did, situation, limit=4)
        if not memories:
            return ""

        lines = ["Recuerdos relevantes para esta situación:"]
        for m in memories:
            lines.append(f"- [{m['type'].upper()}] {m['title']}: {m['content'][:120]}...")
        return "\n".join(lines)


memory_graph = MemoryGraph()
