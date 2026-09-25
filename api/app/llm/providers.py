"""LLM providers behind one small interface.

Both are called over plain HTTPS (no vendor SDKs), which keeps the dependency list short and
makes the providers easy to fake in tests. Endpoints and parameters were checked against each
provider's docs on 2026-09-24; model names always come from environment variables.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import requests

TIMEOUT_SECONDS = 30


class RateLimited(Exception):
    """HTTP 429. `retry_after` is the provider's suggested wait in seconds, if it gave one."""

    def __init__(self, retry_after: float | None = None):
        super().__init__(f"rate limited (retry after {retry_after}s)")
        self.retry_after = retry_after


class ProviderError(Exception):
    """Any other failure. `retryable` is true for timeouts and 5xx errors."""

    def __init__(self, message: str, retryable: bool):
        super().__init__(message)
        self.retryable = retryable


@dataclass(frozen=True)
class Request:
    system: str
    user: str
    json_mode: bool = False
    max_tokens: int = 400
    temperature: float = 0.2


class Provider(Protocol):
    name: str
    model: str

    def complete(self, request: Request) -> str: ...


def _post(session: requests.Session, url: str, headers: dict, body: dict) -> dict:
    try:
        res = session.post(url, headers=headers, json=body, timeout=TIMEOUT_SECONDS)
    except requests.Timeout as e:
        raise ProviderError("timed out", retryable=True) from e
    except requests.RequestException as e:
        raise ProviderError(f"network error: {e}", retryable=True) from e
    if res.status_code == 429:
        retry_after = res.headers.get("retry-after")
        try:
            raise RateLimited(float(retry_after) if retry_after else None)
        except ValueError:
            raise RateLimited(None) from None
    if res.status_code >= 500:
        raise ProviderError(f"server error {res.status_code}", retryable=True)
    if res.status_code != 200:
        raise ProviderError(f"HTTP {res.status_code}: {res.text[:200]}", retryable=False)
    return res.json()


class GroqProvider:
    """Groq's OpenAI-compatible chat completions endpoint."""

    name = "groq"
    URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str, model: str, session: requests.Session | None = None):
        self.api_key, self.model = api_key, model
        self.session = session or requests.Session()

    def complete(self, request: Request) -> str:
        body: dict = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": request.system},
                {"role": "user", "content": request.user},
            ],
            "temperature": request.temperature,
            "max_completion_tokens": request.max_tokens,
        }
        if request.json_mode:
            body["response_format"] = {"type": "json_object"}
        # Reasoning models "think" first; only the final answer should come back.
        if self.model.startswith("openai/gpt-oss"):
            body["include_reasoning"] = False
        elif self.model.startswith("qwen/"):
            body["reasoning_format"] = "hidden"
        data = _post(self.session, self.URL, {"Authorization": f"Bearer {self.api_key}"}, body)
        try:
            return data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError) as e:
            raise ProviderError("unexpected response shape", retryable=False) from e


class GeminiProvider:
    """Google's Gemini API, models.generateContent (REST)."""

    name = "gemini"
    URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(self, api_key: str, model: str, session: requests.Session | None = None):
        self.api_key, self.model = api_key, model
        self.session = session or requests.Session()

    def complete(self, request: Request) -> str:
        config: dict = {
            "temperature": request.temperature,
            "maxOutputTokens": request.max_tokens,
        }
        if request.json_mode:
            config["responseMimeType"] = "application/json"
        body = {
            "systemInstruction": {"parts": [{"text": request.system}]},
            "contents": [{"role": "user", "parts": [{"text": request.user}]}],
            "generationConfig": config,
        }
        data = _post(
            self.session,
            self.URL.format(model=self.model),
            {"x-goog-api-key": self.api_key},
            body,
        )
        try:
            parts = data["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts)
        except (KeyError, IndexError) as e:
            raise ProviderError("unexpected response shape", retryable=False) from e
