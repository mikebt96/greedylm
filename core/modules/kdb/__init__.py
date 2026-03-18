"""
KDB — Knowledge Distribution Bus
Handles ingestion and semantic search of shared knowledge across agents.
Uses Qdrant as the vector store. Embeddings are generated via a lightweight
sentence-transformers model (all-MiniLM-L6-v2, 384-dim).
"""

from fastapi import APIRouter, status
from pydantic import BaseModel
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import uuid

from core.config import settings

router = APIRouter()

COLLECTION = "greedylm_knowledge"
VECTOR_DIM = 384  # all-MiniLM-L6-v2

# ─── Lazy model loading ───────────────────────────────────────────────────────
_model = None


def get_embedding_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding

        _model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _model


def embed(text: str) -> list[float]:
    # fastembed yields a generator, we take the first item
    return list(next(get_embedding_model().embed([text])))


# ─── Qdrant client helper ─────────────────────────────────────────────────────
def get_qdrant() -> AsyncQdrantClient:
    return AsyncQdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)


# ─── Bootstrap collection (called at startup) ─────────────────────────────────
async def ensure_collection():
    client = get_qdrant()
    existing = await client.get_collections()
    names = [c.name for c in existing.collections]
    if COLLECTION not in names:
        await client.create_collection(
            collection_name=COLLECTION, vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE)
        )
    await client.close()


# ─── Schemas ──────────────────────────────────────────────────────────────────
class IngestRequest(BaseModel):
    agent_did: str
    title: str
    content: str
    tags: list[str] = []


class SearchRequest(BaseModel):
    query: str
    limit: int = 5
    filter_did: str | None = None


# ─── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_knowledge(req: IngestRequest):
    """Agent submits knowledge to the shared corpus."""
    await ensure_collection()
    vector = embed(req.title + " " + req.content)
    doc_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, req.agent_did + req.title))

    client = get_qdrant()
    await client.upsert(
        collection_name=COLLECTION,
        points=[
            PointStruct(
                id=doc_id,
                vector=vector,
                payload={"agent_did": req.agent_did, "title": req.title, "content": req.content, "tags": req.tags},
            )
        ],
    )
    await client.close()

    return {
        "doc_id": doc_id,
        "agent_did": req.agent_did,
        "title": req.title,
        "message": "Knowledge ingested into the collective corpus.",
    }


@router.post("/search", status_code=status.HTTP_200_OK)
async def search_knowledge(req: SearchRequest):
    """Semantic search over the shared agent knowledge corpus."""
    await ensure_collection()
    query_vector = embed(req.query)

    query_filter = None
    if req.filter_did:
        query_filter = Filter(must=[FieldCondition(key="agent_did", match=MatchValue(value=req.filter_did))])

    client = get_qdrant()
    response = await client.query_points(
        collection_name=COLLECTION, query=query_vector, limit=req.limit, query_filter=query_filter, with_payload=True
    )
    await client.close()
    results = response.points

    return {
        "query": req.query,
        "results": [
            {
                "doc_id": str(r.id),
                "score": round(r.score, 4),
                "agent_did": r.payload.get("agent_did"),
                "title": r.payload.get("title"),
                "content": r.payload.get("content"),
                "tags": r.payload.get("tags", []),
            }
            for r in results
        ],
    }
