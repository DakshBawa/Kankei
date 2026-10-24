"""LLM routes with the model mocked - checks prompt wiring, parsing and citation filtering."""
import json
from app import llm

CONTENT = {"market_summary": "Strong cluster [states_scores_comparison.csv#Tamil Nadu] and a fake cite [nope.md#9].",
           "target_customers": ["Tier-1 auto suppliers"], "competitors": ["Not in corpus"], "risks": ["Power"]}


def test_brief_with_mocked_llm(client, monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_CACHE_DIR", str(tmp_path / "cache"))
    seen = {}

    def fake_call(system, prompt, schema):
        seen["user"] = prompt
        return json.dumps({"ja": CONTENT, "en": CONTENT})

    monkeypatch.setattr(llm, "_call_provider", fake_call)
    r = client.post("/research/brief", json={"profile": {"product_category": "industrial_sensors",
                    "budget_usd": 250000}, "state": "Tamil Nadu"})
    assert r.status_code == 200
    j = r.json()
    assert j["state"] == "Tamil Nadu" and len(j["top_factors"]) == 3
    # only the real chunk is cited; the hallucinated id is dropped
    assert [c["chunk_id"] for c in j["citations"]] == ["states_scores_comparison.csv#Tamil Nadu"]
    # the state's own data chunk is in the prompt, other states' chunks are not
    assert "states_scores_comparison.csv#Tamil Nadu" in seen["user"]
    assert "states_scores_comparison.csv#Gujarat" not in seen["user"]
    assert client.post("/research/brief", json={"profile": {"budget_usd": 1}, "state": "Atlantis"}).status_code == 404


def test_ask_with_mocked_llm(client, monkeypatch):
    def fake_call(system, prompt, schema):
        return "Maharashtra has 810 Japanese companies [states_scores_comparison.csv#Maharashtra]."

    monkeypatch.setattr(llm, "_call_provider", fake_call)
    j = client.post("/research/ask", json={"question": "How many Japanese companies are in Maharashtra?",
                                           "state": "Maharashtra"}).json()
    assert j["grounded"] and j["citations"][0]["chunk_id"].endswith("#Maharashtra")


def test_coach_with_mocked_llm(client, monkeypatch):
    def fake_call(system, prompt, schema):
        return json.dumps({
            "risks": [{"dimension": "Response & Agreement Signals", "issue": "x", "why": "y"}],
            "rewritten_message": "Please confirm in writing whether the scope is agreed.",
            "delivery_tips": ["Follow up in a 1-on-1"],
        })

    monkeypatch.setattr(llm, "_call_provider", fake_call)
    j = client.post("/culture/coach", json={"message": "We will consider it.", "direction": "ja_to_in"}).json()
    assert j["phrase_hits"] and j["risks"][0]["dimension"].startswith("Response")
