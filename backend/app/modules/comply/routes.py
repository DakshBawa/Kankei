from fastapi import APIRouter, HTTPException, Query

from app.modules.comply import engine, landed_cost
from app.schemas import ChecklistRequest, ChecklistResponse, LandedCostRequest, LandedCostResponse

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
