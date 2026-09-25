"""The storage interface, implemented by SQLiteStore (local/dev) and SupabaseStore (production).

Tables mirror supabase/migrations/0001_init.sql. Study data is keyed only by a random
pseudonymous participant id.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

TABLES = ("participants", "study_events", "test_responses", "question_log")


@dataclass
class QuestionLogEntry:
    """A v2 free-text question and what the router did with it. Unmapped questions show which
    concepts to write next."""

    raw_text: str
    status: str
    targets: list[str] = field(default_factory=list)
    uncovered: list[str] = field(default_factory=list)
    method: str = "retrieval"


@dataclass
class Participant:
    id: str
    consent_version: str
    consented_at: str
    study_code: str | None = None


@dataclass
class StudyEvent:
    participant_id: str
    session_id: str
    type: str
    concept_id: str | None = None
    question_id: str | None = None
    payload: dict = field(default_factory=dict)
    client_at: str | None = None


@dataclass
class TestResponse:
    __test__ = False  # a data class, not a pytest test (its name starts with "Test")

    participant_id: str
    test: str  # "pre" or "post"
    item_id: str
    choice: int
    correct: bool
    ms: int | None = None


class Store(Protocol):
    def log_question(self, entry: QuestionLogEntry) -> None: ...

    def add_participant(self, participant: Participant) -> None: ...

    def participant_exists(self, participant_id: str) -> bool: ...

    def add_events(self, events: list[StudyEvent]) -> None: ...

    def add_test_responses(self, responses: list[TestResponse]) -> None: ...

    def delete_participant(self, participant_id: str) -> None: ...

    def rows(self, table: str) -> list[dict]: ...
