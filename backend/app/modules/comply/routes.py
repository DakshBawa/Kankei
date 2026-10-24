from fastapi import APIRouter, HTTPException, Query

from app.modules.comply import engine, landed_cost
from app.schemas import (
    ChecklistRequest, ChecklistResponse, LandedCostRequest, LandedCostResponse,
    ExplainRequest, ExplainResponse, Citation,
)

router = APIRouter(prefix="/comply", tags=["comply"])


@router.get("/hs")
def search_hs(q: str = Query(min_length=2, description="HS code prefix or words from the description")):
    return landed_cost.search(q)


@router.get("/hs/audit")
def audit_duty_table():
    """Cross-check the duty table's effective_duty column against the BCD->SWS->IGST cascade."""
    return landed_cost.audit()


@router.post("/landed-cost", response_model=LandedCostResponse)
def landed(req: LandedCostRequest):
    try:
        return landed_cost.compute(req)
    except landed_cost.HSCodeError as e:
        raise HTTPException(e.status, str(e))


@router.post("/checklist", response_model=ChecklistResponse)
def checklist(req: ChecklistRequest):
    return engine.evaluate(req)


@router.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    from app.modules.research.rag import get_retriever
    query = req.query or req.item_id or req.context or "compliance rules"
    retriever = get_retriever()
    chunks = retriever.search(query, k=3)
    citations = [
        Citation(
            chunk_id=c.chunk_id,
            source=c.source,
            snippet=c.text[:200],
            title=c.title,
            source_url=c.source_url,
            last_verified=c.last_verified,
            unverified=c.unverified,
        )
        for c in chunks
    ]
    cite_str = " ".join(f"[{c.chunk_id}]" for c in citations)
    explanation = f"Compliance guidance for '{query}': relevant provisions from official guidelines. {cite_str}".strip()
    return ExplainResponse(explanation=explanation, grounded=bool(chunks), citations=citations)
