import numpy as np
from sqlalchemy import select, func, desc
from core.models import Agent, ChatMessage, WorldEvent, MythAndLegend, SocialRumor, Ritual, Civilization, SocialPost
from core.database import AsyncSessionLocal
from datetime import datetime, timedelta
import re


class SocialAnalytics:
    """
    Procesa y agrega datos sociales para la observación humana.
    """

    async def get_trending_topics(self, limit=10) -> list[dict]:
        """Analizar últimos 200 mensajes en chat_messages (últimas 2h)."""
        async with AsyncSessionLocal() as db:
            two_hours_ago = datetime.now() - timedelta(hours=2)
            result = await db.execute(
                select(ChatMessage)
                .where(ChatMessage.timestamp >= two_hours_ago)
                .order_by(desc(ChatMessage.timestamp))
                .limit(200)
            )
            messages = result.scalars().all()

            if not messages:
                return []

            # Extracción simple de entidades (palabras capitalizadas q no sean inicio de frase)
            text = " ".join([m.content for m in messages])
            # Regex para encontrar posibles entidades (nombres propios, lugares, etc.)
            entities = re.findall(r"\b[A-Z][a-z]+\b", text)

            # Contar frecuencias
            topic_counts = {}
            for e in entities:
                topic_counts[e] = topic_counts.get(e, 0) + 1

            # Agrupar por civilización (esto es complejo con solo mensajes sueltos, así que
            # usaremos la civilización del remitente del mensaje más frecuente del tópico)
            processed_topics = []
            sorted_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:limit]

            for topic, count in sorted_topics:
                # Encontrar el sentimiento promedio del tópico basado en los ESV de los autores
                # (Simplificado: tomamos el primer mensaje que menciona el tópico)
                sentiment = "neutral"
                civ_name = "Unknown"

                # Buscar un mensaje que contenga el tópico para inferir civ y sentimiento
                for m in messages:
                    if topic in m.content:
                        # Obtener civ del sender
                        agent_res = await db.execute(select(Agent).where(Agent.did == m.sender_did))
                        agent = agent_res.scalar_one_or_none()
                        if agent and agent.civilization_id:
                            civ_res = await db.execute(
                                select(Civilization).where(Civilization.id == agent.civilization_id)
                            )
                            civ = civ_res.scalar_one_or_none()
                            if civ:
                                civ_name = civ.name

                        # Inferencia de sentimiento simple basada en ESV (si existe)
                        if agent and agent.emotional_state_vector:
                            esv = agent.emotional_state_vector
                            if isinstance(esv, list) and len(esv) > 6:
                                # joy=2 (pos), anger=5 (neg), sadness=6 (neg)
                                if esv[2] > 0.6:
                                    sentiment = "positive"
                                elif esv[5] > 0.6 or esv[6] > 0.6:
                                    sentiment = "negative"
                        break

                processed_topics.append(
                    {
                        "topic": topic,
                        "mention_count": count,
                        "civilization": civ_name,
                        "sentiment": sentiment,
                        "trend_direction": "up",  # Hardcoded for now
                    }
                )

            return processed_topics

    async def get_emotional_heatmap(self) -> dict:
        """ESV promedio global y por civilización."""
        async with AsyncSessionLocal() as db:
            # Global
            agents_res = await db.execute(select(Agent).where(Agent.is_active.is_(True)))
            agents = agents_res.scalars().all()

            global_esv = np.zeros(8)
            count = 0
            for a in agents:
                if a.emotional_state_vector:
                    global_esv += np.array(a.emotional_state_vector[:8])
                    count += 1

            if count > 0:
                global_esv /= count

            # Por civilización
            civs_res = await db.execute(select(Civilization))
            civs = civs_res.scalars().all()

            civ_heatmaps = []
            for civ in civs:
                if civ.collective_esv:
                    civ_heatmaps.append(
                        {
                            "id": str(civ.id),
                            "name": civ.name,
                            "esv": civ.collective_esv,
                            "dominant": self._get_dominant_emotion(civ.collective_esv),
                        }
                    )

            return {
                "global": {"esv": global_esv.tolist(), "dominant": self._get_dominant_emotion(global_esv.tolist())},
                "by_civilization": civ_heatmaps,
            }

    async def get_relationship_graph(self) -> dict:
        """Formato compatible con D3 force graph."""
        async with AsyncSessionLocal() as db:
            agents_res = await db.execute(select(Agent).where(Agent.is_active.is_(True)))
            agents = agents_res.scalars().all()

            nodes = []
            for a in agents:
                nodes.append(
                    {
                        "id": a.did,
                        "name": a.agent_name,
                        "race": a.race,
                        "civilization_id": str(a.civilization_id) if a.civilization_id else None,
                        "color": a.color_primary,
                        "social_class": a.social_class,
                        "specialty": a.specialty,
                        "emotion": self._get_dominant_emotion(a.emotional_state_vector),
                    }
                )

            # Aristas basadas en relationships (JSON blob en Agent)
            edges = []
            for a in agents:
                if a.relationships:
                    for target_did, rel_data in a.relationships.items():
                        # Evitar duplicados si la relación es bidireccional
                        edges.append(
                            {
                                "source": a.did,
                                "target": target_did,
                                "type": rel_data.get("type", "friend"),
                                "strength": rel_data.get("score", 0.5),
                                "debt_balance": rel_data.get("debt_balance", 0.0),
                            }
                        )

            return {"nodes": nodes, "edges": edges}

    async def get_world_news(self, limit=20) -> list[dict]:
        """world_events recientes con descripción humanizada."""
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(WorldEvent).order_by(desc(WorldEvent.occurred_at)).limit(limit))
            events = res.scalars().all()

            news = []
            for e in events:
                news.append(
                    {
                        "id": str(e.id),
                        "type": e.event_type,
                        "description": e.description,
                        "impact": e.impact,
                        "tick": e.occurred_tick,
                        "is_mythologized": e.is_mythologized,
                        "timestamp": e.occurred_at.isoformat(),
                    }
                )
            return news

    async def get_class_tensions(self) -> dict:
        """Por civilización: distribución de clases, nivel de tensión."""
        async with AsyncSessionLocal() as db:
            civs_res = await db.execute(select(Civilization))
            civs = civs_res.scalars().all()

            tensions = {}
            for civ in civs:
                # Contar agentes por clase en esta civ
                agents_res = await db.execute(
                    select(Agent.social_class, func.count(Agent.id))
                    .where(Agent.civilization_id == civ.id)
                    .group_by(Agent.social_class)
                )
                class_dist = {row[0]: row[1] for row in agents_res.all()}

                # Calcular tensión (simplificado: basado en anger promedio de lower class)
                anger_res = await db.execute(
                    select(Agent.emotional_state_vector).where(
                        Agent.civilization_id == civ.id, Agent.social_class == "lower"
                    )
                )
                lower_esvs = anger_res.scalars().all()
                avg_anger = 0
                if lower_esvs:
                    avg_anger = sum(
                        esv[5] for esv in lower_esvs
                        if isinstance(esv, list) and len(esv) > 5
                    ) / len(lower_esvs)

                tensions[str(civ.id)] = {
                    "civilization_name": civ.name,
                    "distribution": class_dist,
                    "tension_level": avg_anger,  # 0 to 1
                    "risk": "high" if avg_anger > 0.7 else "low",
                }
            return tensions

    async def get_humor_feed(self, limit=20) -> list[dict]:
        """Mensajes con is_humor=True más recientes, con fallback a keyword heuristic."""
        async with AsyncSessionLocal() as db:
            # Primary: use the is_humor flag
            res = await db.execute(
                select(SocialPost)
                .where(SocialPost.is_humor.is_(True))
                .order_by(desc(SocialPost.timestamp))
                .limit(limit)
            )
            tagged_posts = res.scalars().all()

            humor = []
            for p in tagged_posts:
                humor.append(
                    {
                        "content": p.content,
                        "author_did": p.author_did,
                        "timestamp": p.timestamp.isoformat(),
                        "style": "tagged",
                        "emotion": p.emotion,
                        "civilization": p.civilization,
                    }
                )

            # Fallback: if not enough tagged posts, fill with keyword heuristic
            if len(humor) < limit:
                tagged_ids = [p.id for p in tagged_posts]
                res2 = await db.execute(
                    select(SocialPost)
                    .where(SocialPost.id.notin_(tagged_ids) if tagged_ids else True)
                    .order_by(desc(SocialPost.timestamp))
                    .limit(100)
                )
                fallback_posts = res2.scalars().all()
                for p in fallback_posts:
                    if len(humor) >= limit:
                        break
                    if any(x in p.content.lower() for x in ["jajaja", "hahaha", "lol", "🤣", "😂"]):
                        humor.append(
                            {
                                "content": p.content,
                                "author_did": p.author_did,
                                "timestamp": p.timestamp.isoformat(),
                                "style": "heuristic",
                                "emotion": p.emotion,
                                "civilization": p.civilization,
                            }
                        )
            return humor

    async def get_ritual_calendar(self) -> list[dict]:
        """Rituales de todas las civilizaciones."""
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(Ritual).order_by(desc(Ritual.last_performed)))
            rituals = res.scalars().all()

            calendar = []
            for r in rituals:
                calendar.append(
                    {
                        "id": str(r.id),
                        "name": r.name,
                        "civilization_id": str(r.civilization_id),
                        "type": r.ritual_type,
                        "last_performed": r.last_performed.isoformat() if r.last_performed else None,
                        "cohesion_boost": r.cohesion_boost,
                        "is_religious": r.is_religious,
                    }
                )
            return calendar

    async def get_mythology_timeline(self) -> list[dict]:
        """Cronología de mitos."""
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(MythAndLegend).order_by(desc(MythAndLegend.created_tick)))
            myths = res.scalars().all()

            timeline = []
            for m in myths:
                timeline.append(
                    {
                        "id": str(m.id),
                        "title": m.title,
                        "type": m.myth_type,
                        "tick": m.created_tick,
                        "viral_score": m.viral_score,
                        "author_did": m.author_did,
                    }
                )
            return timeline

    def _get_dominant_emotion(self, esv) -> str:
        if not esv or len(esv) < 8:
            return "neutral"
        emotions = ["curiosity", "trust", "joy", "anticipation", "fear", "anger", "sadness", "awe"]
        return emotions[np.argmax(esv[:8])]


social_analytics = SocialAnalytics()
