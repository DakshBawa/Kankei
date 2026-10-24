"""Trust score: how reliable is this partner on paper? (compliance, legal, longevity).
Weights and thresholds are heuristics - tune with real due-diligence outcomes."""
import re

from app.modules.match.data import Partner
from app.schemas import ScoreComponent, TrustReport

WEIGHTS = {"gst": 0.30, "litigation": 0.25, "adverse_media": 0.15,
           "longevity": 0.15, "scale": 0.05, "insolvency": 0.10}
TIER_A, TIER_B = 85, 70

HARD_DIRECTOR_RE = re.compile(r"struck off|disqualif|fraud|wilful default", re.I)


def _clip(x: float) -> float:
    return max(0.0, min(1.0, x))


def trust_report(p: Partner) -> TrustReport:
    comps = {
        # 70% filing regularity or worse scores 0; 100% scores 1
        "gst": (_clip((p.gst_pct - 70) / 30), f"{p.gst_pct:.0f}% GST filing regularity"),
        "litigation": (_clip(1 - p.litigation_count / 5), f"{p.litigation_count} litigation case(s)"),
        "adverse_media": (0.0 if p.adverse_media else 1.0, p.adverse_media or "none found"),
        "longevity": (_clip(p.years_in_business / 20), f"{p.years_in_business} years in business"),
        "scale": (p.turnover_rank / 4, p.turnover_band),
        "insolvency": (0.0 if p.insolvency else 1.0, "insolvency flag" if p.insolvency else "no insolvency flag"),
    }
    score = round(100 * sum(WEIGHTS[k] * v for k, (v, _) in comps.items()), 1)

    flags: list[str] = []
    hard = False
    if p.insolvency:
        flags.append("Insolvency flag raised")
        hard = True
    if HARD_DIRECTOR_RE.search(p.directors_raw):
        flags.append(f"Director red flag: {p.directors_raw}")
        hard = True
    if p.adverse_media:
        flags.append(f"Adverse media: {p.adverse_media}")
    if p.gst_pct < 90:
        flags.append(f"Irregular GST filing ({p.gst_pct:.0f}%)")
    if p.litigation_count >= 3:
        flags.append(f"High litigation count ({p.litigation_count})")

    tier = "High risk" if hard else ("A" if score >= TIER_A else "B" if score >= TIER_B else "C")
    return TrustReport(
        partner_id=p.id, score=score, tier=tier, flags=flags,
        components=[ScoreComponent(name=k, score=round(v, 3), weight=WEIGHTS[k], note=n)
                    for k, (v, n) in comps.items()],
    )
