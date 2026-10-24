import json
from pathlib import Path

import httpx
import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app import llm, session

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent


class Brief(BaseModel):
    summary: str


# ---------------------------------------------------------------- 5. LLM cache
@pytest.fixture
def cache(tmp_path, monkeypatch):
    monkeypatch.setenv("LLM_CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setenv("LLM_RETRIES", "0")
    monkeypatch.setenv("LLM_OFFLINE", "0")
    return tmp_path / "cache"


def test_second_call_is_served_from_disk(cache, monkeypatch):
    calls = []

    def fake(system, prompt, schema):
        calls.append(prompt)
        return '```json\n{"summary": "Tamil Nadu ranks first"}\n```'

    monkeypatch.setattr(llm, "_call_provider", fake)
    first = llm.complete_json("brief for Tanaka Seiki", Brief, system="s")
    second = llm.complete_json("brief for Tanaka Seiki", Brief, system="s")
    assert first == second == Brief(summary="Tamil Nadu ranks first")
    assert len(calls) == 1
    assert llm.cache_stats()["entries"] == 1


def test_offline_replays_cache_and_never_touches_network(cache, monkeypatch):
    monkeypatch.setattr(llm, "_call_provider", lambda *a: '{"summary": "warm"}')
    llm.complete_json("persona prompt", Brief)

    def boom(*a):
        raise AssertionError("network used while offline")

    monkeypatch.setattr(llm, "_call_provider", boom)
    monkeypatch.setenv("LLM_OFFLINE", "1")
    assert llm.complete_json("persona prompt", Brief).summary == "warm"


def test_offline_miss_uses_fallback_or_raises(cache, monkeypatch):
    monkeypatch.setenv("LLM_OFFLINE", "1")
    assert llm.complete_json("never seen", Brief, fallback=lambda: Brief(summary="template")).summary == "template"
    with pytest.raises(llm.LLMUnavailable):
        llm.complete_json("never seen", Brief)


def test_provider_down_falls_back_instead_of_crashing(cache, monkeypatch):
    def down(*a):
        raise httpx.ConnectError("no network")

    monkeypatch.setattr(llm, "_call_provider", down)
    out = llm.complete_json("x", Brief, fallback=lambda: Brief(summary="fallback"))
    assert out.summary == "fallback"
    assert llm.cache_stats()["entries"] == 0  # failures are never cached


def test_bad_json_is_retried_then_rejected(cache, monkeypatch):
    monkeypatch.setenv("LLM_RETRIES", "1")
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)
    calls = []
    monkeypatch.setattr(llm, "_call_provider", lambda *a: calls.append(1) or "not json")
    out = llm.complete_json("x", Brief, fallback=lambda: Brief(summary="fb"))
    assert out.summary == "fb" and len(calls) == 2


# ------------------------------------------------------------ 2. culture playbook
def test_playbook_has_15_complete_entries_and_mandatory_phrases():
    data = json.loads((BACKEND / "data/culture_playbook.json").read_text(encoding="utf-8"))
    entries = data["entries"]
    assert 12 <= len(entries) <= 15
    base = ["pattern", "literal", "actual_intent", "coaching", "rewrite_en"]
    for e in entries:
        assert all(e.get(k, "").strip() for k in base), e["id"]
        reading = "likely_read_by_indian_partner" if e["direction"] == "JP_to_IN" else "likely_read_by_japanese_partner"
        assert e.get(reading, "").strip(), e["id"]
    patterns = {e["pattern"] for e in entries}
    for must in ("前向きに検討します", "善処します", "難しいですね"):
        assert must in patterns
    assert len({e["id"] for e in entries}) == len(entries)
    assert {"JP_to_IN", "IN_to_JP"} <= {e["direction"] for e in entries}


# ------------------------------------------------------------------ 1. corpus
def test_corpus_seed_writes_headers_and_respects_if_empty(tmp_path, monkeypatch, capsys):
    import seed_corpus

    out = tmp_path / "corpus"
    monkeypatch.setattr("sys.argv", ["x", "--out", str(out)])
    assert seed_corpus.main() == 0
    files = sorted(out.glob("*.md"))
    assert len(files) >= 15
    text = files[0].read_text(encoding="utf-8")
    assert text.startswith("---\n") and "source_url: https://" in text and "last_verified: UNVERIFIED" in text

    files[0].write_text("edited by hand", encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["x", "--out", str(out), "--if-empty"])
    seed_corpus.main()
    assert files[0].read_text(encoding="utf-8") == "edited by hand"


# ------------------------------------------------------------ 3. session CRUD
@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(session, "store", session.SessionStore(None))
    app = FastAPI()
    app.include_router(session.router)
    return TestClient(app)


def test_session_crud(client):
    sid = client.post("/session").json()["session_id"]
    assert client.patch(f"/session/{sid}", json={"chosen_state": "Tamil Nadu"}).json()["chosen_state"] == "Tamil Nadu"
    assert client.get("/session/nope").status_code == 404


def test_store_persists_across_restarts(tmp_path):
    path = tmp_path / "s.json"
    session.SessionStore(path).put("demo", {"a": 1})
    assert session.SessionStore(path).get("demo") == {"a": 1}


# ------------------------------------------------------------ 4. docker compose
def test_compose_defines_db_backend_frontend_with_health_ordering():
    d = yaml.safe_load((REPO / "docker-compose.yml").read_text())
    assert set(d["services"]) == {"db", "backend", "frontend"}
    assert d["services"]["db"]["image"].startswith("pgvector/pgvector")
    assert "healthcheck" in d["services"]["db"]
    assert d["services"]["backend"]["depends_on"]["db"]["condition"] == "service_healthy"
    assert d["services"]["frontend"]["depends_on"]["backend"]["condition"] == "service_healthy"
    assert "CREATE EXTENSION IF NOT EXISTS vector" in (REPO / "db/init/001-extensions.sql").read_text()
