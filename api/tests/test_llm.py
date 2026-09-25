"""LLM routing: fallback, backoff on 429, retries, caching, and the provider request shapes."""

import pytest

from app.llm.client import LLMClient, LLMUnavailable, TTLCache
from app.llm.providers import (
    GeminiProvider,
    GroqProvider,
    ProviderError,
    RateLimited,
    Request,
)

REQ = Request(system="s", user="u")


class FakeProvider:
    def __init__(self, name, *outcomes):
        self.name, self.model = name, f"{name}-model"
        self.outcomes = list(outcomes)
        self.calls = 0

    def complete(self, request):
        self.calls += 1
        outcome = self.outcomes.pop(0) if self.outcomes else "ok"
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def client(*providers, **kw):
    sleeps = []
    c = LLMClient(providers, sleep=sleeps.append, **kw)
    return c, sleeps


def test_primary_answers_when_healthy():
    groq, gemini = FakeProvider("groq", "hi"), FakeProvider("gemini")
    c, _ = client(groq, gemini)
    result = c.complete(REQ)
    assert (result.text, result.provider) == ("hi", "groq")
    assert gemini.calls == 0


def test_429_backs_off_exponentially_then_falls_back():
    groq = FakeProvider("groq", RateLimited(None), RateLimited(None), RateLimited(None))
    gemini = FakeProvider("gemini", "from gemini")
    c, sleeps = client(groq, gemini)
    assert c.complete(REQ).provider == "gemini"
    assert groq.calls == 3
    assert sleeps == [1.0, 2.0]  # 1s, then 2s, then give up on Groq


def test_backoff_respects_retry_after_but_is_capped():
    groq = FakeProvider("groq", RateLimited(5), RateLimited(60), "ok")
    c, sleeps = client(groq)
    assert c.complete(REQ).text == "ok"
    assert sleeps == [5, 8.0]  # never shorter than asked, never longer than the cap


def test_retryable_errors_are_retried_and_others_fall_back_immediately():
    flaky = FakeProvider("groq", ProviderError("503", retryable=True), "recovered")
    c, sleeps = client(flaky)
    assert c.complete(REQ).text == "recovered"
    assert sleeps == [1.0]

    broken = FakeProvider("groq", ProviderError("401", retryable=False))
    backup = FakeProvider("gemini", "backup")
    c, sleeps = client(broken, backup)
    assert c.complete(REQ).text == "backup"
    assert broken.calls == 1 and sleeps == []


def test_identical_requests_are_cached():
    groq = FakeProvider("groq", "first", "second")
    c, _ = client(groq)
    assert c.complete(REQ).text == "first"
    again = c.complete(REQ)
    assert again.text == "first" and again.cached
    assert groq.calls == 1
    assert c.complete(Request(system="s", user="different")).text == "second"


def test_cache_entries_expire():
    now = [0.0]
    cache = TTLCache(ttl_seconds=10, clock=lambda: now[0])
    groq = FakeProvider("groq", "a", "b")
    c, _ = client(groq, cache=cache)
    c.complete(REQ)
    now[0] = 11
    assert c.complete(REQ).text == "b"


def test_unavailable_when_everything_fails_or_nothing_is_configured():
    c, _ = client(FakeProvider("groq", ProviderError("x", retryable=False)))
    with pytest.raises(LLMUnavailable):
        c.complete(REQ)
    empty, _ = client()
    assert not empty.available
    with pytest.raises(LLMUnavailable):
        empty.complete(REQ)


# --- Provider request shapes (HTTP is faked) ----------------------------------------------


class FakeResponse:
    def __init__(self, status, body=None, headers=None):
        self.status_code, self._body, self.headers, self.text = (
            status,
            body or {},
            headers or {},
            "",
        )

    def json(self):
        return self._body


class FakeSession:
    def __init__(self, response):
        self.response, self.sent = response, None

    def post(self, url, headers, json, timeout):
        self.sent = {"url": url, "headers": headers, "json": json}
        return self.response


def test_groq_request_and_response():
    session = FakeSession(FakeResponse(200, {"choices": [{"message": {"content": "answer"}}]}))
    groq = GroqProvider("key", "openai/gpt-oss-120b", session)
    assert groq.complete(Request(system="sys", user="usr", json_mode=True)) == "answer"
    body = session.sent["json"]
    assert session.sent["headers"]["Authorization"] == "Bearer key"
    assert body["messages"][0] == {"role": "system", "content": "sys"}
    assert body["response_format"] == {"type": "json_object"}
    assert body["include_reasoning"] is False


def test_gemini_request_and_response():
    session = FakeSession(
        FakeResponse(
            200, {"candidates": [{"content": {"parts": [{"text": "an"}, {"text": "swer"}]}}]}
        )
    )
    gemini = GeminiProvider("key", "gemini-3.5-flash-lite", session)
    assert gemini.complete(Request(system="sys", user="usr", json_mode=True)) == "answer"
    assert session.sent["url"].endswith("/models/gemini-3.5-flash-lite:generateContent")
    assert session.sent["headers"] == {"x-goog-api-key": "key"}
    assert session.sent["json"]["systemInstruction"] == {"parts": [{"text": "sys"}]}
    assert session.sent["json"]["generationConfig"]["responseMimeType"] == "application/json"


def test_http_errors_map_to_retry_policy():
    with pytest.raises(RateLimited) as e:
        GroqProvider(
            "k", "m", FakeSession(FakeResponse(429, headers={"retry-after": "7"}))
        ).complete(REQ)
    assert e.value.retry_after == 7
    with pytest.raises(ProviderError) as e:
        GroqProvider("k", "m", FakeSession(FakeResponse(503))).complete(REQ)
    assert e.value.retryable
    with pytest.raises(ProviderError) as e:
        GroqProvider("k", "m", FakeSession(FakeResponse(401))).complete(REQ)
    assert not e.value.retryable
