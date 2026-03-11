from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from core.config import settings

class ShardedKnowledgeStore:
    """
    Manages domain-specific collections in Qdrant for better scaling 
    and specialized search performance.
    """
    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL)
        self.VECTOR_SIZE = 384  # Based on all-MiniLM-L6-v2

    async def ensure_shard(self, domain: str):
        collection_name = f"kdb_{domain}"
        collections = self.client.get_collections().collections
        exists = any(c.name == collection_name for c in collections)
        
        if not exists:
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=self.VECTOR_SIZE, distance=Distance.COSINE),
            )
        return collection_name

    async def ingest_to_shard(self, domain: str, points: list):
        collection_name = await self.ensure_shard(domain)
        self.client.upsert(
            collection_name=collection_name,
            points=points
        )

    async def search_shards(self, query_vector: list, domains: list = None, limit: int = 10):
        """
        Search across one or more shards.
        """
        targets = domains if domains else ["general"] # Simplified
        results = []
        for domain in targets:
            collection_name = f"kdb_{domain}"
            hits = self.client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=limit
            )
            results.extend(hits)
        
        # Re-rank or sort by score
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]
