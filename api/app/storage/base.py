"""The storage interface, implemented by SQLiteStore (local/dev) and SupabaseStore (production)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class QuestionLogEntry:
    """A v2 free-text question and what the router did with it. Unmapped questions show which
    concepts to write next."""

    raw_text: str
    status: str
    targets: list[str] = field(default_factory=list)
    uncovered: list[str] = field(default_factory=list)
    method: str = "retrieval"


class Store(Protocol):
    def log_question(self, entry: QuestionLogEntry) -> None: ...
