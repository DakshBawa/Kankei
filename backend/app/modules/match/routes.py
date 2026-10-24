from fastapi import APIRouter, HTTPException

from app.modules.match.data import Partner, load_partners
from app.modules.match.fit import fit_components, fit_score, reasons
from app.modules.match.trust import trust_report
from app.modules.research import scoring
from app.schemas import MatchedPartner, MatchRequest, MatchResponse, PartnerSummary, TrustReport

router = APIRouter(prefix="/match", tags=["match"])

CONFLICT_PENALTY = 20.0
FIT_SHARE, TRUST_SHARE = 0.6, 0.4


def _summary(p: Partner) -> PartnerSummary:
    return PartnerSummary(
        partner_id=p.id, name=p.name, state=p.state, sector=p.sector, type=p.type,
        turnover_band=p.turnover_band, years_in_business=p.years_in_business,
        japan_client_experience=p.japan_label, language=p.language,
        brands_handled=list(p.brands), directors=p.directors_raw,
    )


@router.get("/partners", response_model=list[PartnerSummary])
def list_partners(state: str | None = None, type: str | None = None, sector: str | None = None):
    out = []
    for p in load_partners().values():
        if state and p.state.lower() != state.lower():
            continue
        if type and p.type.lower() != type.lower():
            continue
        if sector and p.sector.lower() != sector.lower():
            continue
        out.append(_summary(p))
    return out


@router.get("/partners/{partner_id}/trust", response_model=TrustReport)
def partner_trust(partner_id: str):
    p = load_partners().get(partner_id)
    if p is None:
        raise HTTPException(404, f"Unknown partner: {partner_id}")
    return trust_report(p)


@router.post("/rank", response_model=MatchResponse)
def rank_partners(req: MatchRequest):
    try:
        weights = scoring.resolve_weights(req.profile)
    except ValueError as e:
        raise HTTPException(422, str(e))
    state_scores = {r.state: r.score for r in scoring.rank_states(weights)}
    wanted_states = {s.lower() for s in req.states}
    competitors = [c.lower() for c in req.competitor_brands if c.strip()]

    pool = [
        p for p in load_partners().values()
        if (not req.partner_types or p.type in req.partner_types)
        and (not wanted_states or p.state.lower() in wanted_states)
    ]
    results: list[MatchedPartner] = []
    for p in pool:
        trust = trust_report(p)
        if req.exclude_high_risk and trust.tier == "High risk":
            continue
        if trust.score < req.min_trust:
            continue
        s_score = state_scores.get(p.state, 0.0)
        comps = fit_components(p, req, s_score)
        fit = fit_score(comps)
        conflicts = [f"Handles competing brand: {b}" for b in p.brands
                     if any(c in b.lower() or b.lower() in c for c in competitors)]
        match = FIT_SHARE * fit + TRUST_SHARE * trust.score
        if conflicts:
            match -= CONFLICT_PENALTY
        results.append(MatchedPartner(
            partner=_summary(p), match_score=round(max(match, 0.0), 1), fit_score=fit, trust=trust,
            fit_components=comps, state_opportunity_score=s_score, conflicts=conflicts,
            reasons=reasons(comps),
        ))
    results.sort(key=lambda r: r.match_score, reverse=True)
    return MatchResponse(considered=len(pool), results=results[: req.top_n])
