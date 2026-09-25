"""A small in-memory rate limiter for the endpoints that can call an LLM.

Free LLM tiers allow only a few requests per minute for the whole site, so one visitor
shouldn't be able to use them all. Per-process and approximate by design; fine for one
server instance.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float = 60, clock=time.monotonic):
        self.limit, self.window, self.clock = limit, window_seconds, clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = self.clock()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                retry = int(self.window - (now - hits[0])) + 1
                raise HTTPException(
                    429,
                    "You're asking faster than the tutor can keep up. "
                    f"Try again in {retry} seconds.",
                    headers={"Retry-After": str(retry)},
                )
            hits.append(now)


def client_key(request: Request) -> str:
    # Behind a proxy (Render, Hugging Face), the first X-Forwarded-For entry is the visitor.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
