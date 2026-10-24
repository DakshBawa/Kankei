import asyncio

import httpx
import pytest

from app import llm


def _fake_post(status, body):
    async def post(self, url, json=None, headers=None):
        assert url.startswith("https://api.groq.com/openai/v1/")
        assert headers["Authorization"] == "Bearer k"
        return httpx.Response(status, json=body, request=httpx.Request("POST", url))
    return post


def test_groq_json_with_fenced_output(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k")
    body = {"choices": [{"message": {"content": '```json\n{"a": 1}\n```'}}]}
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post(200, body))
    assert llm.provider() == "groq"
    assert asyncio.run(llm.complete_json("sys", "user")) == {"a": 1}


def test_groq_rate_limit_becomes_unavailable(monkeypatch, client):
    monkeypatch.setenv("GROQ_API_KEY", "k")
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post(429, {}))
    with pytest.raises(llm.LLMUnavailable):
        asyncio.run(llm.complete("s", "u"))
    r = client.post("/research/brief", json={"profile": {"budget_usd": 100000}})
    assert r.status_code == 503 and "rate limit" in r.json()["detail"]


def test_no_key_is_unavailable():
    with pytest.raises(llm.LLMUnavailable):
        asyncio.run(llm.complete("s", "u"))
