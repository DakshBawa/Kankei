import os
from unittest.mock import patch
import pandas as pd

from app.config import DATA_DIR
from app.modules.research import scoring
from app.schemas import SMEProfile


def test_equal_weights_reproduce_csv_composite():
    df = pd.read_csv(DATA_DIR / "states_scores_comparison.csv")
    weights = scoring.resolve_weights(SMEProfile(product_category="general", budget_usd=500_000))
    ranked = {r.state: r for r in scoring.rank_states(weights)}
    for _, row in df.iterrows():
        assert abs(ranked[row.state].score / 100 - row.overall_composite_score) < 0.002
    # and the ordering matches the CSV's own rank
    assert [r.state for r in scoring.rank_states(weights)] == df.sort_values("overall_rank").state.tolist()


def test_rank_endpoint_shape_and_contributions(client):
    r = client.post("/research/rank", json={"product_category": "industrial_sensors", "budget_usd": 250000})
    assert r.status_code == 200
    top = r.json()["results"][0]
    assert len(top["factors"]) == 9 and len(top["top_factors"]) == 3
    assert abs(sum(f["contribution"] for f in top["factors"]) - top["score"]) < 0.6
    contribs = [f["contribution"] for f in top["top_factors"]]
    assert contribs == sorted(contribs, reverse=True)


def test_priority_override_and_validation(client):
    zero = {k: 0 for k in scoring.FACTOR_KEYS}
    assert client.post("/research/rank", json={"budget_usd": 1000, "priority_weights": zero}).status_code == 422
    r = client.post("/research/rank", json={"budget_usd": 1e6, "priority_weights": {"cost": 100}})
    assert r.json()["results"][0]["state"] == "Andhra Pradesh"  # cheapest land dominates


def test_llm_routes_with_mocked_llm_success(monkeypatch, client):
    """Test that LLM routes successfully integrate and return data when LLM responds."""
    from app import llm
    monkeypatch.setattr(
        llm, "_call_provider",
        lambda *a: '{"ja": {"market_summary": "Tamil Nadu [states_scores_comparison.csv#Tamil Nadu]", "target_customers": ["Auto"], "competitors": ["None"], "risks": ["Logistics"]}, "en": {"market_summary": "Tamil Nadu [states_scores_comparison.csv#Tamil Nadu]", "target_customers": ["Auto"], "competitors": ["None"], "risks": ["Logistics"]}}'
    )
    body = {"profile": {"budget_usd": 100000, "product_category": "industrial_sensors"}}
    response_brief = client.post("/research/brief", json=body)
    assert response_brief.status_code == 200

    response_ask = client.post("/research/ask", json={"question": "Is there demand for sensors in Maharashtra?"})
    assert response_ask.status_code == 200


def test_llm_routes_degrade_gracefully(client):
    """Test that routes degrade gracefully with fallback when no key is set."""
    body = {"profile": {"budget_usd": 100000}}
    assert client.post("/research/brief", json=body).status_code == 200
    r = client.post("/research/ask", json={"question": "Is there demand for sensors in Maharashtra?"})
    assert r.status_code == 200