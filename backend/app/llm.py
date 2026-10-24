"""Single LLM wrapper. Every module calls this; swap providers here only.

Provider choice (env):
  LLM_PROVIDER=groq | anthropic   (if unset: groq when GROQ_API_KEY is set, else anthropic)
  Groq:      GROQ_API_KEY, GROQ_MODEL (default llama-3.3-70b-versatile)
  Anthropic: ANTHROPIC_API_KEY, LLM_MODEL
"""
import json
import os
import re

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMUnavailable(RuntimeError):
    """No key configured, bad key, or rate-limited. Routes turn this into HTTP 503."""


def provider() -> str:
    p = os.getenv("LLM_PROVIDER", "").lower()
    if p in ("groq", "anthropic"):
        return p
    return "groq" if os.getenv("GROQ_API_KEY") else "anthropic"


async def _groq(system: str, user: str, max_tokens: int, temperature: float, json_mode: bool) -> str:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise LLMUnavailable("GROQ_API_KEY is not set")
    payload = {
        "model": os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(GROQ_URL, json=payload, headers={"Authorization": f"Bearer {key}"})
    if r.status_code == 429:
        raise LLMUnavailable("Groq free-tier rate limit reached. Wait a minute, or set "
                             "GROQ_MODEL=llama-3.1-8b-instant (higher daily allowance).")
    if r.status_code in (401, 403):
        raise LLMUnavailable("Groq rejected the API key - check GROQ_API_KEY")
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


_anthropic_client = None


async def _anthropic(system: str, user: str, max_tokens: int, temperature: float) -> str:
    global _anthropic_client
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise LLMUnavailable("ANTHROPIC_API_KEY is not set")
    if _anthropic_client is None:
        from anthropic import AsyncAnthropic  # imported lazily: only needed for this provider
        _anthropic_client = AsyncAnthropic()
    resp = await _anthropic_client.messages.create(
        model=os.getenv("LLM_MODEL", "claude-sonnet-5-5"), max_tokens=max_tokens,
        temperature=temperature, system=system, messages=[{"role": "user", "content": user}],
    )
    return "".join(b.text for b in resp.content if b.type == "text")


async def complete(system: str, user: str, max_tokens: int = 1500, temperature: float = 0.2,
                   json_mode: bool = False) -> str:
    if provider() == "groq":
        return await _groq(system, user, max_tokens, temperature, json_mode)
    return await _anthropic(system, user, max_tokens, temperature)


async def complete_json(system: str, user: str, max_tokens: int = 3000) -> dict:
    """Ask for JSON only, strip any code fences, parse. Retries once on bad JSON."""
    sys = system + "\n\nRespond with a single valid JSON object only. No prose, no code fences."
    last_err: Exception | None = None
    for _ in range(2):
        try:
            raw = await complete(sys, user, max_tokens=max_tokens, temperature=0.2, json_mode=True)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 400:  # Groq: model produced invalid JSON
                last_err = e
                continue
            raise
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            last_err = e
    raise ValueError(f"LLM returned invalid JSON: {last_err}")
