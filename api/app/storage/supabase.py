"""Supabase storage through its REST API (PostgREST), using the backend's secret key.

Supabase is replacing the legacy JWT `service_role` key with `sb_secret_…` keys (the legacy
keys are deprecated by the end of 2026). New secret keys aren't JWTs, so they're sent only in
the `apikey` header; a legacy JWT key is also sent as a Bearer token, as before.
"""

from __future__ import annotations

from dataclasses import asdict

import requests

from app.storage.base import (
    TABLES,
    Participant,
    QuestionLogEntry,
    StudyEvent,
    TestResponse,
)

PAGE = 1000  # PostgREST's usual max rows per request


class SupabaseError(RuntimeError):
    pass


class SupabaseStore:
    def __init__(self, url: str, secret_key: str, session: requests.Session | None = None):
        self.base = url.rstrip("/") + "/rest/v1"
        self.headers = {"apikey": secret_key, "Content-Type": "application/json"}
        if not secret_key.startswith("sb_"):
            self.headers["Authorization"] = f"Bearer {secret_key}"  # legacy JWT key
        self.session = session or requests.Session()

    def _request(self, method: str, path: str, *, params=None, json=None, prefer: str = ""):
        headers = {**self.headers, **({"Prefer": prefer} if prefer else {})}
        res = self.session.request(
            method, f"{self.base}/{path}", headers=headers, params=params, json=json, timeout=15
        )
        if res.status_code >= 300:
            raise SupabaseError(
                f"Supabase {method} {path} failed: {res.status_code} {res.text[:200]}"
            )
        return res

    def _insert(self, table: str, rows: list[dict], prefer: str = "return=minimal", **params):
        if rows:
            self._request("POST", table, json=rows, prefer=prefer, params=params or None)

    def log_question(self, entry: QuestionLogEntry) -> None:
        self._insert("question_log", [asdict(entry)])

    def add_participant(self, p: Participant) -> None:
        self._insert("participants", [asdict(p)])

    def participant_exists(self, participant_id: str) -> bool:
        res = self._request(
            "GET", "participants", params={"id": f"eq.{participant_id}", "select": "id"}
        )
        return bool(res.json())

    def add_events(self, events: list[StudyEvent]) -> None:
        self._insert("study_events", [asdict(e) for e in events])

    def add_test_responses(self, responses: list[TestResponse]) -> None:
        # Upsert on the (participant, test, item) unique key: re-submitting replaces answers.
        self._insert(
            "test_responses",
            [asdict(r) for r in responses],
            prefer="resolution=merge-duplicates,return=minimal",
            on_conflict="participant_id,test,item_id",
        )

    def delete_participant(self, participant_id: str) -> None:
        self._request("DELETE", "participants", params={"id": f"eq.{participant_id}"})

    def rows(self, table: str) -> list[dict]:
        if table not in TABLES:
            raise ValueError(f"unknown table {table}")
        out: list[dict] = []
        while True:
            res = self._request(
                "GET",
                table,
                params={
                    "select": "*",
                    "order": "id.asc" if table != "participants" else "created_at.asc",
                    "limit": PAGE,
                    "offset": len(out),
                },
            )
            batch = res.json()
            out.extend(batch)
            if len(batch) < PAGE:
                return out

    def question_log(self) -> list[dict]:
        return self.rows("question_log")
