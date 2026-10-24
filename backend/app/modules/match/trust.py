"""Trust score: how reliable is this partner on paper? (compliance, legal, longevity).

Transparent 0-100 score with rule-generated red flags. Facts come from code;
wording comes from the LLM (no hallucination risk).

Components (weights sum to 100):
  Corporate standing        25  age, director history, filings regularity
  Tax/GST regularity        20  % of on-time filings
  Litigation and insolvency 20  case count, insolvency flags
  Adverse media             15  LLM scan flag (on synthetic news snippets)
  Japanese-peer references  10  references from other Japanese firms
  Financial health proxy    10  turnover band stability
"""
from __future__ import annotations

import re
from typing import Optional

from app.modules.match.data import Partner
from app.schemas import RedFlag, ScoreComponent, TrustReport

TIER_A, TIER_B = 85, 70

HARD_DIRECTOR_RE = re.compile(r"struck off|disqualif|fraud|wilful default", re.I)

# Component weights (must sum to 1.0)
WEIGHTS = {
    "corporate_standing": 0.25,
    "gst_regularity": 0.20,
    "litigation_insolvency": 0.20,
    "adverse_media": 0.15,
    "japanese_peer_refs": 0.10,
    "financial_health": 0.10,
}


def _clip(x: float) -> float:
    return max(0.0, min(1.0, x))


def _director_red_flags(p: Partner) -> list[RedFlag]:
    """Rule-generated director-related red flags."""
    flags: list[RedFlag] = []
    if HARD_DIRECTOR_RE.search(p.directors_raw):
        flags.append(RedFlag(
            code="director_linked_to_struck_off",
            detail=f"Director named in disqualified/struck-off/fraud context: {p.directors_raw[:120]}",
        ))
    return flags


def trust_report(p: Partner) -> TrustReport:
    # ---- Component scores (0-1 each) ----

    # Corporate standing: age (years in business / 25 capped) + director history
    age_score = _clip(p.years_in_business / 25.0)
    dir_flags = _director_red_flags(p)
    director_score = 0.0 if dir_flags else 1.0
    corporate_standing = round((age_score * 0.6 + director_score * 0.4), 3)

    # Tax/GST regularity: % on-time filings
    gst_regularity = round(_clip((p.gst_pct - 70) / 30), 3)

    # Litigation and insolvency: case count + insolvency flag
    litigation_score = round(_clip(1 - p.litigation_count / 5), 3)
    insolvency_score = 0.0 if p.insolvency else 1.0
    litigation_insolvency = round((litigation_score * 0.6 + insolvency_score * 0.4), 3)

    # Adverse media: LLM scan flag on synthetic news snippets
    adverse_media = 0.0 if p.adverse_media else 1.0

    # Japanese-peer references: Japan-client experience years / 10 capped
    japanese_peer_refs = round(min(p.japan_years, 10) / 10.0, 3)

    # Financial health proxy: turnover band stability (rank / 4)
    financial_health = round(p.turnover_rank / 4.0, 3)

    comps = {
        "corporate_standing": (corporate_standing, f"{p.years_in_business} yrs, directors clean={not bool(dir_flags)}"),
        "gst_regularity": (gst_regularity, f"{p.gst_pct:.0f}% GST filing regularity"),
        "litigation_insolvency": (litigation_insolvency,
                                   f"{p.litigation_count} litigation case(s), insolvency={p.insolvency}"),
        "adverse_media": (adverse_media, p.adverse_media or "none found"),
        "japanese_peer_refs": (japanese_peer_refs, f"{p.japan_years:.0f} years Japan-client experience"),
        "financial_health": (financial_health, f"turnover band {p.turnover_band}"),
    }

    score = round(100 * sum(WEIGHTS[k] * v for k, (v, _) in comps.items()), 1)

    # ---- Rule-generated red flags ----
    red_flags: list[RedFlag] = []
    red_flags.extend(dir_flags)

    if p.insolvency:
        red_flags.append(RedFlag(
            code="insolvency_flag_raised",
            detail="Insolvency flag is set for this partner",
        ))
    if p.adverse_media:
        red_flags.append(RedFlag(
            code="adverse_media_detected",
            detail=p.adverse_media[:120],
        ))
    if p.gst_pct < 90:
        red_flags.append(RedFlag(
            code="irregular_gst_filing",
            detail=f"GST filing regularity {p.gst_pct:.0f}% (below 90% threshold)",
        ))
    if p.litigation_count >= 3:
        red_flags.append(RedFlag(
            code="high_litigation_count",
            detail=f"{p.litigation_count} litigation cases (>= 3 threshold)",
        ))

    # Human-readable flags (LLM will re-phrase these from red_flags)
    flags: list[str] = []
    for rf in red_flags:
        flags.append(rf.detail)

    severe = bool(dir_flags) or p.insolvency
    tier = "High risk" if severe else ("A" if score >= TIER_A else "B" if score >= TIER_B else "C")

    return TrustReport(
        partner_id=p.id,
        score=score,
        tier=tier,
        flags=flags,
        red_flags=red_flags,
        components=[ScoreComponent(name=k, score=round(v, 3), weight=WEIGHTS[k], note=n)
                    for k, (v, n) in comps.items()],
    )
