"""Session state backed by PostgreSQL (with file / in-memory fallback).

Endpoints
  POST /session             create an empty session
  GET  /session/{id}        read the full state
  PATCH /session/{id}       shallow-merge keys into the state

The submitted company profile is persisted in the `sessions` table so that every
pipeline stage (research → match → comply → gtm) can read it by session id.
There is no demo / seed-demo mode: only data entered through the onboarding
form is stored.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException

from sqlalchemy import Column, DateTime, String, create_engine, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker

router = APIRouter(prefix="/session", tags=["session"])

Base = declarative_base()


class SessionRow(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True)
    state = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------- the store
class SessionStore:
    """Thread-safe session store.

    Prefers PostgreSQL (DATABASE_URL) so submitted profiles survive restarts and
    are shared across the pipeline stages. Falls back to a JSON file
    (SESSION_FILE) and finally to a pure in-memory dict when no database is
    configured (e.g. local dev / tests without Postgres).
    """

    def __init__(
        self,
        path: Optional[Path] = None,
        database_url: Optional[str] = None,
    ) -> None:
        self._lock = threading.Lock()
        self._path = path
        self._data: Dict[str, Dict[str, Any]] = {}
        self._engine = None
        self._Session = None
        self._SessionRow = SessionRow

        if database_url:
            try:
                self._engine = create_engine(database_url, pool_pre_ping=True)
                self._Session = sessionmaker(bind=self._engine, autoflush=False)
                Base.metadata.create_all(self._engine)
            except Exception:  # noqa: BLE001 - DB optional in local dev
                self._engine = None
                self._Session = None

        if self._engine is None and path and path.exists():
            try:
                self._data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                self._data = {}

    # -- internal helpers ------------------------------------------------
    def _flush_file(self) -> None:
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self._path)

    # -- public API ------------------------------------------------------
    def get(self, sid: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            if self._Session is not None:
                db = self._Session()
                try:
                    row = db.get(self._SessionRow, sid)
                    return dict(row.state) if row is not None else None
                finally:
                    db.close()
            return json.loads(json.dumps(self._data[sid])) if sid in self._data else None

    def put(self, sid: str, state: Dict[str, Any]) -> None:
        with self._lock:
            if self._Session is not None:
                db = self._Session()
                try:
                    row = db.get(self._SessionRow, sid)
                    if row is None:
                        row = self._SessionRow(id=sid, state=state)
                        db.add(row)
                    else:
                        row.state = state
                    db.commit()
                    return
                finally:
                    db.close()
            self._data[sid] = state
            self._flush_file()

    def merge(self, sid: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            if self._Session is not None:
                db = self._Session()
                try:
                    row = db.get(self._SessionRow, sid)
                    if row is None:
                        raise KeyError(sid)
                    merged = {**dict(row.state), **patch}
                    row.state = merged
                    db.commit()
                    return merged
                finally:
                    db.close()
            if sid not in self._data:
                raise KeyError(sid)
            self._data[sid].update(patch)
            self._flush_file()
            return json.loads(json.dumps(self._data[sid]))


# Choose the database URL from env; fall back to file / in-memory store.
_DB_URL = os.getenv("DATABASE_URL")
_SESSION_PATH = Path(os.getenv("SESSION_FILE", "data/sessions.json"))

store = SessionStore(database_url=_DB_URL, path=_SESSION_PATH)


# --------------------------------------------------------------------- endpoints
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
