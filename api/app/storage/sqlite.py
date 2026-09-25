"""SQLite storage: the default for local development and tests. Supabase (Postgres) is used in
production when it's configured; both implement the same Store interface (see base.py)."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path

from app.storage.base import QuestionLogEntry

SCHEMA = """
create table if not exists question_log (
    id integer primary key autoincrement,
    created_at text not null,
    raw_text text not null,
    status text not null,
    targets text not null,      -- JSON list of concept ids
    uncovered text not null,    -- JSON list of phrases
    method text not null        -- "llm" or "retrieval"
);
"""


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

    def log_question(self, entry: QuestionLogEntry) -> None:
        with self._lock:
            self._conn.execute(
                "insert into question_log"
                " (created_at, raw_text, status, targets, uncovered, method)"
                " values (?, ?, ?, ?, ?, ?)",
                (
                    now(),
                    entry.raw_text,
                    entry.status,
                    json.dumps(entry.targets),
                    json.dumps(entry.uncovered),
                    entry.method,
                ),
            )
            self._conn.commit()

    def question_log(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("select * from question_log order by id").fetchall()
        return [
            {
                **dict(r),
                "targets": json.loads(r["targets"]),
                "uncovered": json.loads(r["uncovered"]),
            }
            for r in rows
        ]
