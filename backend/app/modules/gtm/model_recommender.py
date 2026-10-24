"""Rule-based entry-model recommender. Attribute scores and budget thresholds are HEURISTICS
chosen to make trade-offs explicit - tune them with domain experts."""
from app.schemas import ModelOption, ModelRecommendRequest, ModelRecommendResponse

# attribute scores 0-1 (higher = better on that dimension)
MODELS = {
    "export_via_distributor": {
        "partner_type": "Distributor", "min_budget": 0,
        "attrs": {"speed": 0.9, "capital_light": 1.0, "control": 0.3, "local_cost": 0.1, "risk_shield": 0.8},
        "tradeoffs": ["Limited control over pricing and customer relationships",
                      "Full import duty burden; no local-cost advantage"],
    },
    "contract_manufacturing": {
        "partner_type": "Contract Manufacturer", "min_budget": 150_000,
        "attrs": {"speed": 0.5, "capital_light": 0.6, "control": 0.5, "local_cost": 0.8, "risk_shield": 0.6},
        "tradeoffs": ["Quality and IP leakage risk needs audits and strong contracts",
                      "Qualification and tooling transfer take time"],
    },
    "joint_venture": {
        "partner_type": "JV Candidate", "min_budget": 400_000,
        "attrs": {"speed": 0.4, "capital_light": 0.4, "control": 0.6, "local_cost": 0.8, "risk_shield": 0.4},
        "tradeoffs": ["Partner dependence and governance deadlock risk",
                      "Slow to set up; exit is complex"],
    },
    "wholly_owned_subsidiary": {
        "partner_type": None, "min_budget": 800_000,
        "attrs": {"speed": 0.2, "capital_light": 0.1, "control": 1.0, "local_cost": 0.9, "risk_shield": 0.3},
        "tradeoffs": ["Highest capital and fixed-cost commitment",
                      "Slowest start; you carry all regulatory and execution risk"],
    },
}
LABELS = {"speed": "Fast to market", "capital_light": "Low capital need", "control": "Control over brand/pricing",
          "local_cost": "Local-cost / duty advantage", "risk_shield": "Limits downside risk"}


def _weights(req: ModelRecommendRequest) -> dict[str, float]:
    b = req.profile.budget_usd
    return {
        "capital_light": 2.0 if b < 150_000 else 1.0 if b < 1_000_000 else 0.3,
        "speed": 2.0 if req.timeline_months <= 6 else 1.0 if req.timeline_months <= 18 else 0.4,
        "risk_shield": {"low": 2.0, "medium": 1.0, "high": 0.4}[req.risk_tolerance],
        "control": {"high": 2.0, "medium": 1.0, "low": 0.3}[req.control_need],
        "local_cost": 2.0 if req.local_manufacturing_required else 0.5,
    }


def recommend(req: ModelRecommendRequest) -> ModelRecommendResponse:
    w = _weights(req)
    total_w = sum(w.values())
    results = []
    for name, m in MODELS.items():
        contrib = {k: w[k] * v for k, v in m["attrs"].items()}
        score = 100 * sum(contrib.values()) / total_w
        budget_ok = req.profile.budget_usd >= m["min_budget"]
        if not budget_ok:
            score *= 0.6
        top = sorted(contrib, key=contrib.get, reverse=True)[:2]
        reasons = [f"{LABELS[k]} (priority weight {w[k]:g})" for k in top]
        tradeoffs = list(m["tradeoffs"])
        if not budget_ok:
            tradeoffs.insert(0, f"Budget is below the indicative ${m['min_budget']:,} for this route")
        results.append(ModelOption(
            model=name, partner_type=m["partner_type"], score=round(score, 1), budget_ok=budget_ok,
            indicative_min_budget_usd=m["min_budget"], reasons=reasons, tradeoffs=tradeoffs,
        ))
    results.sort(key=lambda r: r.score, reverse=True)
    return ModelRecommendResponse(
        weights_used=w, results=results,
        notes=["Scores are heuristic. Budget thresholds are indicative placeholders, not quotes.",
               "Use /match/rank with the suggested partner_type, and /comply/checklist with the chosen entry_model."],
    )


def recommend_model(profile: dict | ModelRecommendRequest) -> ModelRecommendResponse:
    from app.schemas import SMEProfile
    if isinstance(profile, dict):
        cat = profile.get("product_category", "industrial_sensors")
        if cat == "sensors":
            cat = "industrial_sensors"
        b_usd = profile.get("budget_usd") or (profile.get("budget_jpy", 5_000_000) / 150.0)
        sme = SMEProfile(
            product_category=cat if cat in ("industrial_sensors", "auto_components", "consumer_goods", "general") else "industrial_sensors",
            business_model=profile.get("customer_type", "B2B"),
            budget_usd=max(1000.0, float(b_usd)),
            priority_weights=profile.get("weights") or {},
        )
        req = ModelRecommendRequest(profile=sme)
    else:
        req = profile
    return recommend(req)
