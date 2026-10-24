import httpx
import pytest
from pydantic import BaseModel

from app import llm


class DummySchema(BaseModel):
    a: int


def test_groq_json_with_fenced_output(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    assert llm.provider() == "groq"
    parsed = llm._parse_json('```json\n{"a": 1}\n```')
    assert parsed == {"a": 1}


def test_groq_rate_limit_becomes_unavailable(monkeypatch):
    monkeypatch.setenv("LLM_RETRIES", "0")
    monkeypatch.setenv("LLM_OFFLINE", "0")

    def fake_call(system, prompt, schema):
        raise httpx.HTTPStatusError("429 Rate limit", request=None, response=httpx.Response(429))

    monkeypatch.setattr(llm, "_call_provider", fake_call)
    with pytest.raises(llm.LLMUnavailable):
        llm.complete_json("prompt", DummySchema, use_cache=False)


def test_no_key_is_unavailable(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.setenv("LLM_OFFLINE", "0")
    with pytest.raises(llm.LLMUnavailable):
        llm.complete_json("prompt", DummySchema, use_cache=False)
