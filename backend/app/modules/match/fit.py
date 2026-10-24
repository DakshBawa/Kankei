"""Fit score: how well does this partner suit *this* SME's product and plans?

Hard constraints first (sector compatibility, state coverage), then a weighted score:

    fit = 0.35*product_fit + 0.25*geo_coverage + 0.20*japan_experience
          + 0.10*language_capability + 0.10*capacity_match

product_fit uses TF-IDF cosine similarity between the SME's product description
and the partner's brands-handled / sector description.
"""
from __future__ import annotations

import re
from typing import Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.modules.match.data import Partner
from app.schemas import MatchRequest, ScoreComponent, SMEProfile

# Sector hard-compatibility: if 0.0 the partner is excluded entirely (hard constraint).
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
    "general": {s: 0.6 for s in (
        "Industrial Machinery", "Electronics & Electricals", "Automotive Components",
        "Renewable Energy", "Medical Devices", "Chemicals & Materials", "Consumer Goods")},
}

WEIGHTS = {
    "product_fit": 0.35,
    "geo_coverage": 0.25,
    "japan_experience": 0.20,
    "language_capability": 0.10,
    "capacity_match": 0.10,
}

HARD_SECTOR_MIN = 0.1

LANG_ENGLISH = {0: 0.0, 1: 0.4, 2: 1.0, 3: 1.0, 4: 1.0}
LANG_JAPANESE = {0: 0.0, 1: 0.0, 2: 0.3, 3: 0.8, 4: 1.0}

TURNOVER_LOWER_BOUNDS = [10, 50, 100, 250, 500]


def _tfidf_product_fit(product_description: Optional[str], partner_text: str) -> float:
    """TF-IDF cosine similarity between SME product description and partner text."""
    if not product_description or not product_description.strip():
        return 0.5
    texts = [product_description.strip(), partner_text.strip()]
    try:
        tfidf = TfidfVectorizer(stop_words="english", max_features=500)
        matrix = tfidf.fit_transform(texts)
        sim = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
        return float(sim)
    except Exception:
        return 0.5


def _partner_text(p: Partner) -> str:
    parts = [p.sector, p.state, p.type] + list(p.brands)
    return " ".join(parts)


def _capacity_match(budget_usd: float, p: Partner) -> float:
    m = re.search(r"(\d+)", p.turnover_band.replace(",", ""))
    partner_floor_cr = int(m.group(1)) if m else 0
    budget_inr = budget_usd * 83.0
    budget_cr = budget_inr / 10_000_000.0
    if budget_cr <= 0:
        return 0.5
    ratio = budget_cr / max(partner_floor_cr, 1)
    if ratio <= 10:
        return 1.0
    return max(0.0, 1.0 - (ratio - 10) / 50)


def fit_components(p: Partner, req: MatchRequest, state_score: float) -> list[ScoreComponent]:
    profile = req.profile
    product_description = profile.product_description or ""

    affinity_map = SECTOR_AFFINITY.get(profile.product_category, SECTOR_AFFINITY["general"])
    sector_affinity = affinity_map.get(p.sector, 0.0)
    hard_pass = sector_affinity >= HARD_SECTOR_MIN

    target_states = {s.lower() for s in (profile.target_states or [])}
    state_match = 1.0
    if target_states and p.state.lower() not in target_states:
        state_match = 0.0

    if not hard_pass or state_match == 0.0:
        return [ScoreComponent(name="excluded", score=0.0, weight=1.0, note="hard constraint failed")]

    product_fit = _tfidf_product_fit(product_description, _partner_text(p))
    geo_coverage = round(state_score / 100.0, 3)
    japan_experience = min(p.japan_years, 10) / 10
    if req.language_need == "japanese":
        language_capability = LANG_JAPANESE[p.language_level]
    elif req.language_need == "english":
        language_capability = LANG_ENGLISH[p.language_level]
    else:
        language_capability = 1.0
    capacity_match = _capacity_match(profile.budget_usd, p)

    return [
        ScoreComponent(name="product_fit", score=round(product_fit, 3), weight=WEIGHTS["product_fit"],
                       note=f"TF-IDF vs {', '.join(p.brands)[:60]}"),
        ScoreComponent(name="geo_coverage", score=geo_coverage, weight=WEIGHTS["geo_coverage"],
                       note=f"{p.state} opportunity {state_score}/100"),
        ScoreComponent(name="japan_experience", score=round(japan_experience, 3), weight=WEIGHTS["japan_experience"],
                       note=p.japan_label),
        ScoreComponent(name="language_capability", score=round(language_capability, 3), weight=WEIGHTS["language_capability"],
                       note=p.language),
        ScoreComponent(name="capacity_match", score=round(capacity_match, 3), weight=WEIGHTS["capacity_match"],
                       note=f"{p.turnover_band} vs ${profile.budget_usd:,.0f} budget"),
    ]


def fit_score(components: list[ScoreComponent]) -> float:
    for c in components:
        if c.name == "excluded":
            return 0.0
    return round(100 * sum(c.score * c.weight for c in components), 1)


def reasons(components: list[ScoreComponent]) -> list[str]:
    out = []
    for c in sorted(components, key=lambda c: c.score * c.weight, reverse=True):
        if c.name == "excluded":
            continue
        if c.score >= 0.6:
            label = {"product_fit": "Product fit", "geo_coverage": "Strong state fit",
                     "japan_experience": "Japan-client experience",
                     "language_capability": "Language fit",
                     "capacity_match": "Capacity match"}[c.name]
            out.append(f"{label}: {c.note}")
    return out[:3]


def search_partners(profile: dict | SMEProfile, preferred_state: str | None = None, top_n: int = 5):
    from app.modules.match import routes
    from app.schemas import MatchRequest, SMEProfile
    if isinstance(profile, dict):
        cat = profile.get("product_category", "industrial_sensors")
        if cat == "sensors":
            cat = "industrial_sensors"
        b_usd = profile.get("budget_usd") or (profile.get("budget_jpy", 5_000_000) / 150.0)
        p = SMEProfile(
            product_category=cat if cat in ("industrial_sensors", "auto_components", "consumer_goods", "general") else "industrial_sensors",
            business_model=profile.get("customer_type", "B2B"),
            budget_usd=max(1000.0, float(b_usd)),
            product_description=profile.get("product") or profile.get("product_description"),
            target_states=profile.get("target_states") or ([preferred_state] if preferred_state else []),
            priority_weights=profile.get("weights") or {},
        )
    else:
        p = profile
    states = [preferred_state] if preferred_state else []
    req = MatchRequest(profile=p, states=states)
    resp = routes.rank_partners(req)
    return resp.results[:top_n]
