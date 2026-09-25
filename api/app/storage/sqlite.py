"""SQLite storage: the default for local development and tests. Supabase (Postgres) is used in
production when it's configured; both implement the same Store interface (see base.py)."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path

from app.storage.base import (
    TABLES,
    Participant,
    QuestionLogEntry,
    StudyEvent,
    TestResponse,
)

# Mirrors supabase/migrations/0001_init.sql (JSON columns are stored as text here).
SCHEMA = """
pragma foreign_keys = on;

create table if not exists participants (
    id text primary key,
    created_at text not null,
    study_code text,
    consent_version text not null,
    consented_at text not null
);

create table if not exists study_events (
    id integer primary key autoincrement,
    participant_id text not null references participants(id) on delete cascade,
    session_id text not null,
    type text not null,
    concept_id text,
    question_id text,
    payload text not null default '{}',
    client_at text,
    received_at text not null
);

create table if not exists test_responses (
    id integer primary key autoincrement,
    participant_id text not null references participants(id) on delete cascade,
    test text not null check (test in ('pre', 'post')),
    item_id text not null,
    choice integer not null,
    correct integer not null,
    ms integer,
    created_at text not null,
    unique (participant_id, test, item_id)
);

create table if not exists question_log (
    id integer primary key autoincrement,
    created_at text not null,
    raw_text text not null,
    status text not null,
    targets text not null,
    uncovered text not null,
    method text not null
);
"""

JSON_COLUMNS = {"payload", "targets", "uncovered"}


def now() -> str:
    return datetime.now(UTC).isoformat()


class SQLiteStore:
    def __init__(self, path: Path | str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(SCHEMA)

    def _write(self, sql: str, rows: list[tuple]) -> None:
        with self._lock:
            self._conn.executemany(sql, rows)
            self._conn.commit()

    def log_question(self, entry: QuestionLogEntry) -> None:
        self._write(
            "insert into question_log"
            " (created_at, raw_text, status, targets, uncovered, method)"
            " values (?, ?, ?, ?, ?, ?)",
            [
                (
                    now(),
                    entry.raw_text,
                    entry.status,
                    json.dumps(entry.targets),
                    json.dumps(entry.uncovered),
                    entry.method,
                )
            ],
        )

    def add_participant(self, p: Participant) -> None:
        self._write(
            "insert into participants (id, created_at, study_code, consent_version, consented_at)"
            " values (?, ?, ?, ?, ?)",
            [(p.id, now(), p.study_code, p.consent_version, p.consented_at)],
        )

    def participant_exists(self, participant_id: str) -> bool:
        with self._lock:
            row = self._conn.execute(
                "select 1 from participants where id = ?", (participant_id,)
            ).fetchone()
        return row is not None

    def add_events(self, events: list[StudyEvent]) -> None:
        received = now()
        self._write(
            "insert into study_events (participant_id, session_id, type, concept_id,"
            " question_id, payload, client_at, received_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    e.participant_id,
                    e.session_id,
                    e.type,
                    e.concept_id,
                    e.question_id,
                    json.dumps(e.payload),
                    e.client_at,
                    received,
                )
                for e in events
            ],
        )

    def add_test_responses(self, responses: list[TestResponse]) -> None:
        # Re-submitting a test replaces earlier answers for the same items.
        self._write(
            "insert or replace into test_responses"
            " (participant_id, test, item_id, choice, correct, ms, created_at)"
            " values (?, ?, ?, ?, ?, ?, ?)",
            [
                (r.participant_id, r.test, r.item_id, r.choice, int(r.correct), r.ms, now())
                for r in responses
            ],
        )

    def delete_participant(self, participant_id: str) -> None:
        self._write("delete from participants where id = ?", [(participant_id,)])

    def rows(self, table: str) -> list[dict]:
        if table not in TABLES:
            raise ValueError(f"unknown table {table}")
        with self._lock:
            # `table` is checked against a fixed allow-list above, so this isn't injectable.
            result = self._conn.execute(f"select * from {table} order by rowid").fetchall()  # noqa: S608
        out = []
        for r in result:
            row = dict(r)
            for col in JSON_COLUMNS & row.keys():
                row[col] = json.loads(row[col])
            if table == "test_responses":
                row["correct"] = bool(row["correct"])
            out.append(row)
        return out

    def question_log(self) -> list[dict]:
        return self.rows("question_log")
