"""Provider-agnostic LLM client: primary → fallback, exponential backoff on 429, request cache."""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from app.llm.providers import Provider, ProviderError, RateLimited, Request

log = logging.getLogger("qurious.llm")


class LLMUnavailable(Exception):
    """Every provider failed (or none is configured)."""


@dataclass(frozen=True)
class Completion:
    text: str
    provider: str
    model: str
    cached: bool = False


class TTLCache:
    """Small thread-safe LRU cache with expiry. Identical requests (same prompt, same settings)
    are answered from here, which matters on free tiers with tight rate limits."""

    def __init__(self, max_items: int = 512, ttl_seconds: float = 24 * 3600, clock=time.monotonic):
        self.max_items, self.ttl, self.clock = max_items, ttl_seconds, clock
        self._items: OrderedDict[str, tuple[float, Completion]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Completion | None:
        with self._lock:
            item = self._items.get(key)
            if not item:
                return None
            stored_at, value = item
            if self.clock() - stored_at > self.ttl:
                del self._items[key]
                return None
            self._items.move_to_end(key)
            return value

    def put(self, key: str, value: Completion) -> None:
        with self._lock:
            self._items[key] = (self.clock(), value)
            self._items.move_to_end(key)
            while len(self._items) > self.max_items:
                self._items.popitem(last=False)


def cache_key(request: Request) -> str:
    payload = json.dumps(request.__dict__, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


class LLMClient:
    def __init__(
        self,
        providers: Sequence[Provider],
        cache: TTLCache | None = None,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 8.0,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.providers = list(providers)
        self.cache = cache or TTLCache()
        self.max_attempts, self.base_delay, self.max_delay = max_attempts, base_delay, max_delay
        self.sleep = sleep

    @property
    def available(self) -> bool:
        return bool(self.providers)

    def _backoff(self, attempt: int, suggested: float | None) -> float:
        # Exponential backoff (1s, 2s, 4s…), never shorter than what the provider asked for,
        # capped so a learner isn't left waiting for long.
        delay = self.base_delay * (2**attempt)
        if suggested is not None:
            delay = max(delay, suggested)
        return min(delay, self.max_delay)

    def complete(self, request: Request) -> Completion:
        key = cache_key(request)
        if hit := self.cache.get(key):
            return Completion(hit.text, hit.provider, hit.model, cached=True)

        for provider in self.providers:
            for attempt in range(self.max_attempts):
                try:
                    text = provider.complete(request)
                except RateLimited as e:
                    if attempt == self.max_attempts - 1:
                        log.warning("%s still rate limited; falling back", provider.name)
                        break
                    self.sleep(self._backoff(attempt, e.retry_after))
                    continue
                except ProviderError as e:
                    if e.retryable and attempt < self.max_attempts - 1:
                        self.sleep(self._backoff(attempt, None))
                        continue
                    log.warning("%s failed (%s); falling back", provider.name, e)
                    break
                result = Completion(text, provider.name, provider.model)
                self.cache.put(key, result)
                return result

        raise LLMUnavailable("no LLM provider could answer")
