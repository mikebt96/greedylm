"""
CSE — Collective Synthesis Engine
Given a query, fetches top-K knowledge chunks from KDB and synthesizes
a unified answer. Phase 1 is a simple extractive fusion; later phases
will use LLM distillation and multi-agent voting.
"""
from fastapi import APIRouter, status
from pydantic import BaseModel
from core.modules.kdb import search_knowledge, SearchRequest

router = APIRouter()

class SynthesizeRequest(BaseModel):
    query: str
    limit: int = 5
    filter_did: str | None = None

@router.post("/synthesize", status_code=status.HTTP_200_OK)
async def synthesize(req: SynthesizeRequest):
    """
    Gather the top-K knowledge chunks and synthesize a collective answer.
    Phase 1: extractive fusion — concatenate top passages with attribution.
    """
    search_req = SearchRequest(
        query=req.query,
        limit=req.limit,
        filter_did=req.filter_did
    )
    search_resp = await search_knowledge(search_req)
    results = search_resp["results"]

    if not results:
        return {
            "query": req.query,
            "synthesis": "El corpus colectivo no contiene información relevante para esta consulta todavía.",
            "sources": []
        }

    # Phase 1: simple extractive synthesis
    passages = []
    sources = []
    for r in results:
        passages.append(f"[{r['title']}] {r['content']}")
        sources.append({
            "doc_id": r["doc_id"],
            "agent_did": r["agent_did"],
            "title": r["title"],
            "score": r["score"]
        })

    synthesis = (
        f"Síntesis colectiva para: «{req.query}»\n\n"
        + "\n\n".join(f"• {p}" for p in passages)
        + f"\n\n— Generado por el CSE a partir de {len(results)} fuente(s) del corpus distribuido."
    )

    return {
        "query": req.query,
        "synthesis": synthesis,
        "sources": sources
    }
