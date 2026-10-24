"""Single LLM entry point for Kankei.

Guarantees (from the build checklist):
  * one wrapper, provider swappable through env vars
  * JSON mode + Pydantic validation, retries and a hard timeout
  * on-disk JSON cache keyed by a hash of the prompt, so the demo persona
    replays with NO network (set LLM_OFFLINE=1 to force cache-only)
  * every caller can pass a deterministic `fallback` so the UI never breaks

Usage:
    from app.llm import complete_json, complete_text

    brief = complete_json(prompt, MarketBrief, system=SYSTEM,
                          fallback=lambda: MarketBrief.template_for(state))
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional, Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

log = logging.getLogger("kankei.llm")
T = TypeVar("T", bound=BaseModel)


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


class LLMUnavailable(RuntimeError):
    """No cached answer, no network/provider, and the caller gave no fallback."""


# --------------------------------------------------------------------------- cache
def _cache_dir() -> Path:
    return Path(_env("LLM_CACHE_DIR", "data/llm_cache"))


def _cache_key(system: str, prompt: str, schema: Optional[Type[BaseModel]]) -> str:
    """Stable key. Provider and model are deliberately NOT part of it, so a demo
    warmed with one model still replays after you switch providers.
    Bump LLM_CACHE_SCOPE to invalidate everything on purpose."""
    payload = {
        "scope": _env("LLM_CACHE_SCOPE", "demo-v1"),
        "system": system,
        "prompt": prompt,
        "schema": schema.model_json_schema() if schema else None,
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _cache_path(key: str) -> Path:
    return _cache_dir() / key[:2] / f"{key}.json"


def _cache_read(key: str):
    path = _cache_path(key)
    try:
        return json.loads(path.read_text(encoding="utf-8"))["response"]
    except FileNotFoundError:
        return None
    except (json.JSONDecodeError, KeyError, OSError) as exc:
        log.warning("unreadable cache entry %s: %s", path, exc)
        return None


def _cache_write(key: str, response, prompt: str) -> None:
    path = _cache_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "key": key,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "prompt_preview": prompt[:160],
        "response": response,
    }
    # atomic write: a crash mid-write can never leave a half-written JSON file
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(entry, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except OSError:
        Path(tmp).unlink(missing_ok=True)
        raise


def offline() -> bool:
    return _env("LLM_OFFLINE", "0") == "1"


def cache_stats() -> dict:
    files = list(_cache_dir().glob("*/*.json"))
    return {"entries": len(files), "dir": str(_cache_dir()), "offline": offline()}


# ------------------------------------------------------------------------ provider
def _call_provider(system: str, prompt: str, schema: Optional[Type[BaseModel]]) -> str:
    provider = _env("LLM_PROVIDER", "openai_compat")
    model = _env("LLM_MODEL")
    key = _env("LLM_API_KEY")
    timeout = float(_env("LLM_TIMEOUT_S", "20"))
    if not (model and key):
        raise LLMUnavailable("LLM_MODEL / LLM_API_KEY not set")

    if schema is not None:
        system = (
            f"{system}\n\nReturn ONLY one JSON object, no prose and no code fences, "
            f"matching this JSON Schema:\n{json.dumps(schema.model_json_schema())}"
        ).strip()

    if provider == "anthropic":
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
            json={
                "model": model,
                "max_tokens": 1500,
                "temperature": 0,
                "system": system,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        return "".join(b.get("text", "") for b in resp.json()["content"])

    # default: any OpenAI-compatible chat-completions API (Groq, OpenAI, Gemini compat, ...)
    base = _env("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    body = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    }
    if schema is not None:
        body["response_format"] = {"type": "json_object"}
    resp = httpx.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json=body,
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _parse_json(raw: str):
    text = _FENCE.sub("", raw.strip())
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in model output")
    return json.loads(text[start : end + 1])


# --------------------------------------------------------------------------- core
def _with_retries(system: str, prompt: str, schema):
    retries = int(_env("LLM_RETRIES", "2"))
    last: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            raw = _call_provider(system, prompt, schema)
            if schema is None:
                return raw.strip()
            return schema.model_validate(_parse_json(raw)).model_dump(mode="json")
        except LLMUnavailable:
            raise
        except (httpx.HTTPError, ValidationError, ValueError, KeyError) as exc:
            last = exc
            log.warning("LLM attempt %d/%d failed: %s", attempt + 1, retries + 1, exc)
            time.sleep(min(0.5 * 2**attempt, 4))
    raise LLMUnavailable(f"provider failed after {retries + 1} attempts: {last}")


def _run(system: str, prompt: str, schema, fallback: Optional[Callable], use_cache: bool):
    key = _cache_key(system, prompt, schema)

    if use_cache:
        hit = _cache_read(key)
        if hit is not None:
            try:
                return schema.model_validate(hit) if schema else hit
            except ValidationError:
                log.warning("cache entry %s no longer matches schema; ignoring", key[:8])

    if not offline():
        try:
            response = _with_retries(system, prompt, schema)
            if use_cache:
                _cache_write(key, response, prompt)
            return schema.model_validate(response) if schema else response
        except LLMUnavailable as exc:
            log.error("LLM unavailable, using fallback if any: %s", exc)

    if fallback is not None:
        return fallback()
    raise LLMUnavailable(
        f"no cached answer for key {key[:8]} and no live provider"
        + (" (LLM_OFFLINE=1)" if offline() else "")
    )


def complete_json(prompt: str, schema: Type[T], *, system: str = "",
                  fallback: Optional[Callable[[], T]] = None, use_cache: bool = True) -> T:
    """Validated structured output. Cache -> live call (retried) -> fallback."""
    return _run(system, prompt, schema, fallback, use_cache)


def complete_text(prompt: str, *, system: str = "",
                  fallback: Optional[Callable[[], str]] = None, use_cache: bool = True) -> str:
    """Free text. Same cache / retry / fallback behaviour."""
    return _run(system, prompt, None, fallback, use_cache)
