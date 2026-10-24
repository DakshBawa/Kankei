"""Fit score: how well does this partner suit *this* SME's product and plans?"""
from app.modules.match.data import Partner
from app.schemas import MatchRequest, ScoreComponent

# How adjacent a partner's sector is to the SME's product (judgement call - tune as needed)
SECTOR_AFFINITY: dict[str, dict[str, float]] = {
    "industrial_sensors": {"Industrial Machinery": 1.0, "Electronics & Electricals": 1.0,
                           "Automotive Components": 0.8, "Renewable Energy": 0.5,
                           "Medical Devices": 0.4, "Chemicals & Materials": 0.3, "Consumer Goods": 0.1},
    "auto_components": {"Automotive Components": 1.0, "Industrial Machinery": 0.7,
                        "Electronics & Electricals": 0.6, "Renewable Energy": 0.2,
                        "Chemicals & Materials": 0.2, "Medical Devices": 0.1, "Consumer Goods": 0.1},
    "consumer_goods": {"Consumer Goods": 1.0, "Electronics & Electricals": 0.5,
                       "Medical Devices": 0.3, "Chemicals & Materials": 0.2,
                       "Industrial Machinery": 0.1, "Automotive Components": 0.1, "Renewable Energy": 0.2},
}
WEIGHTS = {"sector": 0.40, "state": 0.25, "language": 0.15, "japan_experience": 0.20}

# score for need=english / need=japanese, by partner language level (1..4)
LANG_ENGLISH = {0: 0.0, 1: 0.4, 2: 1.0, 3: 1.0, 4: 1.0}
LANG_JAPANESE = {0: 0.0, 1: 0.0, 2: 0.3, 3: 0.8, 4: 1.0}


def fit_components(p: Partner, req: MatchRequest, state_score: float) -> list[ScoreComponent]:
    affinity = SECTOR_AFFINITY.get(req.profile.product_category)
    sector = 0.5 if affinity is None else affinity.get(p.sector, 0.0)
    if req.language_need == "japanese":
        lang = LANG_JAPANESE[p.language_level]
    elif req.language_need == "english":
        lang = LANG_ENGLISH[p.language_level]
    else:
        lang = 1.0
    japan = min(p.japan_years, 10) / 10
    return [
        ScoreComponent(name="sector", score=sector, weight=WEIGHTS["sector"], note=p.sector),
        ScoreComponent(name="state", score=round(state_score / 100, 3), weight=WEIGHTS["state"],
                       note=f"{p.state} opportunity {state_score}/100"),
        ScoreComponent(name="language", score=lang, weight=WEIGHTS["language"], note=p.language),
        ScoreComponent(name="japan_experience", score=round(japan, 3), weight=WEIGHTS["japan_experience"],
                       note=p.japan_label),
    ]


def fit_score(components: list[ScoreComponent]) -> float:
    return round(100 * sum(c.score * c.weight for c in components), 1)


def reasons(components: list[ScoreComponent]) -> list[str]:
    out = []
    for c in sorted(components, key=lambda c: c.score * c.weight, reverse=True):
        if c.score >= 0.6:
            out.append({"sector": "Sector match", "state": "Strong state", "language": "Language fit",
                        "japan_experience": "Japan-client experience"}[c.name] + f": {c.note}")
    return out[:3]
