from fastapi import APIRouter, HTTPException

from app import llm
from app.modules.culture import coach as coach_mod
from app.schemas import CoachRequest, CoachResponse, PhraseCheckRequest, PhraseHit

router = APIRouter(prefix="/culture", tags=["culture"])


@router.get("/playbook")
def playbook():
    return coach_mod.load_playbook()


@router.post("/phrase-check", response_model=list[PhraseHit])
def phrase_check(req: PhraseCheckRequest):
    """Deterministic (no LLM): flags phrases the playbook says are commonly misread."""
    return coach_mod.check_phrases(req.text)


@router.post("/coach", response_model=CoachResponse)
def coach(req: CoachRequest):
    return coach_mod.coach(req=req)
