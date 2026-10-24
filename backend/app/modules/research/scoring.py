from functools import lru_cache

import pandas as pd

from app.config import DATA_DIR
from app.schemas import FactorBreakdown, RankedState, SMEProfile

# factor -> column in states_scores_comparison.csv (all already min-max normalised to 0-1,
# higher = better. NOTE land cost is already inverted: it is a *competitiveness* score.)
COLUMN_MAP = {
    "demand": "industrial_output_normalized",
    "cluster": "auto_cluster_density_normalized",
    "japan_presence": "japanese_companies_normalized",
    "logistics": "port_logistics_normalized",
    "incentives": "state_incentives_normalized",
    "cost": "land_cost_competitiveness_normalized",
    "talent": "skilled_labor_normalized",
    "ease_of_business": "ease_of_doing_business_normalized",
    "power": "power_reliability_normalized",
}
FACTOR_KEYS = list(COLUMN_MAP)

# Heuristic starting weights - tune with domain experts. "general" (all 1.0) reproduces the
# CSV's own overall_composite_score exactly (asserted in tests).
DEFAULT_WEIGHTS: dict[str, dict[str, float]] = {
    "general": dict.fromkeys(FACTOR_KEYS, 1.0),
    # Sensors sell into industrial clusters and often via Japanese-affiliated buyers; power quality matters
    "industrial_sensors": {"demand": 1.0, "cluster": 2.0, "japan_presence": 2.0, "logistics": 1.0,
                           "incentives": 0.8, "cost": 0.7, "talent": 1.2,
                           "ease_of_business": 0.8, "power": 1.0},
    "auto_components": {"demand": 1.2, "cluster": 2.2, "japan_presence": 1.8, "logistics": 1.3,
                        "incentives": 0.8, "cost": 0.9, "talent": 1.0,
                        "ease_of_business": 0.8, "power": 1.0},
    "consumer_goods": {"demand": 2.0, "cluster": 0.3, "japan_presence": 0.6, "logistics": 1.5,
                       "incentives": 0.8, "cost": 1.0, "talent": 0.5,
                       "ease_of_business": 1.0, "power": 0.6},
}

LOW_BUDGET_USD = 100_000


@lru_cache(maxsize=1)
def load_states() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "states_scores_comparison.csv").set_index("state")
    missing = [c for c in COLUMN_MAP.values() if c not in df.columns]
    if missing:
        raise RuntimeError(f"states_scores_comparison.csv is missing columns: {missing}")
    return df


# Keywords in product_description that hint at which factors matter most
_DESC_KEYWORDS: dict[str, list[str]] = {
    "demand": ["consumer", "retail", "mass market", "b2c", "electronics", "appliance"],
    "cluster": ["auto", "automotive", "component", "part", "supply chain", "cluster"],
    "japan_presence": ["japan", "japanese", "nippon", "toyota", "mitsubishi", "oem"],
    "logistics": ["port", "coastal", "shipping", "logistics", "export", "import"],
    "incentives": ["subsidy", "incentive", "tax", "concession", "relief"],
    "cost": ["land", "rent", "cheap", "low cost", "budget", "affordable"],
    "talent": ["engineer", "skilled", "talent", "workforce", "hiring", "labor"],
    "ease_of_business": ["ease", "business friendly", "single window", "approval"],
    "power": ["power", "electricity", "energy", "uptime", "reliable power"],
}


def _description_boosts(profile: SMEProfile) -> dict[str, float]:
    """Return multiplicative boosts derived from product_description keywords."""
    text = (profile.product_description or "").lower()
    boosts: dict[str, float] = {}
    for factor, kws in _DESC_KEYWORDS.items():
        if any(k in text for k in kws):
            boosts[factor] = 1.2
    return boosts


def resolve_weights(profile: SMEProfile) -> dict[str, float]:
    w = dict(DEFAULT_WEIGHTS.get(profile.product_category, DEFAULT_WEIGHTS["general"]))
    # Profile-driven adjustments
    if profile.business_model == "B2C":
        w["demand"] *= 1.3
    if profile.budget_usd < LOW_BUDGET_USD:
        w["cost"] *= 1.5
    # Product-description keyword boosts
    for factor, mult in _description_boosts(profile).items():
        w[factor] *= mult
    # Target-state focus: if user named specific states, boost logistics/cost slightly
    if profile.target_states:
        w["logistics"] *= 1.1
        w["cost"] *= 1.05
    # Explicit user priorities override everything
    for k, v in profile.priority_weights.items():
        w[k] = max(0.0, float(v))
    if sum(w.values()) <= 0:
        raise ValueError("At least one priority weight must be positive")
    return {k: round(v, 3) for k, v in w.items()}


def factors_from_row(row: pd.Series) -> dict[str, float]:
    return {k: float(row[col]) for k, col in COLUMN_MAP.items()}


def opportunity_score(row: pd.Series, weights: dict[str, float]) -> tuple[float, dict[str, float]]:
    factors = factors_from_row(row)
    total = sum(weights[k] * v for k, v in factors.items()) / sum(weights.values())
    return round(total * 100, 1), factors


def rank_states(weights: dict[str, float], df: pd.DataFrame | None = None,
                top_n: int | None = None) -> list[RankedState]:
    df = load_states() if df is None else df
    w_sum = sum(weights.values())
    scored = []
    for state, row in df.iterrows():
        score, factors = opportunity_score(row, weights)
        breakdown = [
            FactorBreakdown(
                factor=k, value=round(v, 3), weight=weights[k],
                contribution=round(weights[k] * v / w_sum * 100, 1),
            )
            for k, v in factors.items()
        ]
        scored.append((state, row, score, breakdown))

    scored.sort(key=lambda t: t[2], reverse=True)
    results = [
        RankedState(
            rank=i + 1, state=state, score=score, factors=breakdown,
            top_factors=sorted(breakdown, key=lambda f: f.contribution, reverse=True)[:3],
            language_notes=str(row.get("language_notes", "")),
            data_sources=str(row.get("source", "")),
            last_verified=str(row.get("last_verified", "")),
        )
        for i, (state, row, score, breakdown) in enumerate(scored)
    ]
    return results[:top_n] if top_n else results
