"""Session state + the one-call demo seed.

Endpoints
  POST /session/seed-demo   load the Tanaka Seiki persona and run every stage
  POST /session             create an empty session
  GET  /session/{id}        read the full state
  PATCH /session/{id}       shallow-merge keys into the state

`seed-demo` runs each stage independently: a failing stage is reported in
`stages` and the others still fill in, so the demo degrades instead of dying.
Because the LLM-backed stages go through app.llm, ONE online call to
seed-demo also warms the on-disk LLM cache for offline demos.

Wire it up in main.py:
    from app import session
    app.include_router(session.router)

ADAPT: the imports inside the `_stage_*` functions use the module layout from
the checklist. Rename them to your real function names; nothing else changes.
"""
from __future__ import annotations

import json
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/session", tags=["session"])

DEMO_SESSION_ID = "demo"

# Illustrative demo persona. Label it "Demo data" in the UI.
DEMO_PERSONA: Dict[str, Any] = {
    "demo": True,
    "company": "Tanaka Seiki",
    "hq": "Osaka, Japan",
    "employees": 45,
    "product": "Industrial temperature and pressure sensors",
    "product_category": "sensors",
    "customer_type": "B2B",
    "target_customers": ["Auto OEMs", "Tier-1 suppliers"],
    "budget_jpy": 5_000_000,
    "route": "import",
    "ownership_intent": "distributor_first",
    "weights": None,  # None = use the module's default preset for this category
}


# ---------------------------------------------------------------------- the store
class SessionStore:
    """Thread-safe in-memory store with optional JSON persistence so a
    backend restart (or `docker compose restart backend`) keeps the demo state."""

    def __init__(self, path: Optional[Path] = None) -> None:
        self._lock = threading.Lock()
        self._path = path
        self._data: Dict[str, Dict[str, Any]] = {}
        if path and path.exists():
            try:
                self._data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                self._data = {}

    def _flush(self) -> None:
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self._path)

    def get(self, sid: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return json.loads(json.dumps(self._data[sid])) if sid in self._data else None

    def put(self, sid: str, state: Dict[str, Any]) -> None:
        with self._lock:
            self._data[sid] = state
            self._flush()

    def merge(self, sid: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            if sid not in self._data:
                raise KeyError(sid)
            self._data[sid].update(patch)
            self._flush()
            return json.loads(json.dumps(self._data[sid]))


store = SessionStore(Path(os.getenv("SESSION_FILE", "data/sessions.json")))


# ------------------------------------------------------------------------ stages
# Each stage takes the state-so-far and returns the value stored under its name.
def _stage_research(state: dict):
    from app.modules.research.scoring import rank_states  # ADAPT
    return rank_states(state["profile"])


def _stage_brief(state: dict):
    from app.modules.research.routes import build_brief  # ADAPT (LLM, cached)
    return build_brief(state["profile"], state["research"])


def _stage_match(state: dict):
    from app.modules.match.fit import search_partners  # ADAPT
    top_state = state["research"][0]["state"] if state.get("research") else None
    return search_partners(state["profile"], preferred_state=top_state, top_n=5)


def _stage_comply(state: dict):
    from app.modules.comply.engine import build_roadmap  # ADAPT
    return build_roadmap(state["profile"])


def _stage_gtm(state: dict):
    from app.modules.gtm.waterfall import compute_waterfall  # ADAPT
    from app.modules.gtm.model_recommender import recommend_model  # ADAPT
    return {
        "waterfall": compute_waterfall(state["profile"]),
        "recommendation": recommend_model(state["profile"]),
    }


def _stage_culture(state: dict):
    from app.modules.culture.coach import coach  # ADAPT (LLM, cached)
    samples = [
        {"text": "前向きに検討します。", "direction": "JP_to_IN"},
        {"text": "Yes, no problem, it will be done.", "direction": "IN_to_JP"},
    ]
    return [coach(**s) for s in samples]


STAGES: "list[tuple[str, Callable[[dict], Any]]]" = [
    ("research", _stage_research),
    ("brief", _stage_brief),
    ("match", _stage_match),
    ("comply", _stage_comply),
    ("gtm", _stage_gtm),
    ("culture", _stage_culture),
]


def _jsonable(value: Any) -> Any:
    """Pydantic models / dataclasses -> plain JSON-safe data."""
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    return value


def run_seed(session_id: str = DEMO_SESSION_ID, persona: Optional[dict] = None) -> dict:
    state: Dict[str, Any] = {"session_id": session_id, "profile": dict(persona or DEMO_PERSONA)}
    report: Dict[str, Dict[str, Any]] = {}

    for name, fn in STAGES:
        started = time.perf_counter()
        try:
            state[name] = _jsonable(fn(state))
            report[name] = {"ok": True, "ms": round((time.perf_counter() - started) * 1000)}
        except Exception as exc:  # noqa: BLE001 - a demo stage must never take the others down
            state[name] = None
            report[name] = {
                "ok": False,
                "ms": round((time.perf_counter() - started) * 1000),
                "error": f"{type(exc).__name__}: {exc}",
            }

    state["stages"] = report
    store.put(session_id, state)
    return state


# --------------------------------------------------------------------- endpoints
@router.post("/seed-demo")
def seed_demo(session_id: str = DEMO_SESSION_ID):
    """One call: persona in, every stage out. Idempotent for the same session_id."""
    state = run_seed(session_id)
    if not any(s["ok"] for s in state["stages"].values()):
        raise HTTPException(status_code=500, detail={"code": "seed_failed", "stages": state["stages"]})
    return state


@router.post("")
def create_session():
    sid = uuid.uuid4().hex[:12]
    state = {"session_id": sid, "profile": None}
    store.put(sid, state)
    return state


@router.get("/{session_id}")
def read_session(session_id: str):
    state = store.get(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail={"code": "session_not_found"})
    return state


@router.patch("/{session_id}")
def patch_session(session_id: str, patch: Dict[str, Any]):
    try:
        return store.merge(session_id, patch)
    except KeyError:
        raise HTTPException(status_code=404, detail={"code": "session_not_found"})
