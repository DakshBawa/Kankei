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


@patch("groq.Groq")
def test_llm_routes_with_groq_success(mock_groq_client, client):
    """Test that LLM routes successfully integrate and return data when Groq API responds correctly."""
    # Mock Groq chat completion response structure
    mock_completion = type("MockCompletion", (), {
        "choices": [
            type("MockChoice", (), {
                "message": type("MockMessage", (), {"content": "Sample Groq AI generated research brief/answer."})
            })
        ]
    })
    
    mock_instance = mock_groq_client.return_value
    mock_instance.chat.completions.create.return_value = mock_completion

    body = {"profile": {"budget_usd": 100000, "product_category": "industrial_sensors"}}
    
    # Test brief generation with mocked Groq
    response_brief = client.post("/research/brief", json=body)
    assert response_brief.status_code == 200

    # Test Q&A with mocked Groq
    response_ask = client.post("/research/ask", json={"question": "Is there demand for sensors in Maharashtra?"})
    assert response_ask.status_code == 200


def test_llm_routes_degrade_gracefully(client):
    """Test that routes degrade gracefully with 503 if Groq API key is missing or client fails."""
    with patch.dict(os.environ, {"GROQ_API_KEY": ""}, clear=True):
        body = {"profile": {"budget_usd": 100000}}
        assert client.post("/research/brief", json=body).status_code == 503
        
        r = client.post("/research/ask", json={"question": "Is there demand for sensors in Maharashtra?"})
        assert r.status_code in (200, 503)