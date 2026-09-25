"""Study mode: consent, grading, events, withdrawal, export, and privacy."""

import csv
import io
import json

import pytest
from fastapi.testclient import TestClient

from app.content.assessment import get_assessment
from app.main import app
from app.routes import study
from app.storage.base import QuestionLogEntry, TestResponse
from app.storage.sqlite import SQLiteStore
from app.storage.supabase import SupabaseStore

ITEMS = get_assessment().items


@pytest.fixture
def client(monkeypatch, tmp_path):
    store = SQLiteStore(tmp_path / "study.db")
    monkeypatch.setattr(study, "get_store", lambda: store)
    monkeypatch.setattr(study.settings, "study_admin_token", "secret-token")
    monkeypatch.setattr(study.settings, "study_enabled", True)
    study.limiter._hits.clear()
    return TestClient(app), store


def enrol(client, **extra):
    res = client.post(
        "/study/participants",
        json={"consent_version": study.CONSENT_VERSION, "agreed": True, **extra},
    )
    assert res.status_code == 200
    return res.json()["participant_id"]


def test_enrolment_requires_consent_to_the_current_version(client):
    c, store = client
    base = {"consent_version": study.CONSENT_VERSION}
    assert c.post("/study/participants", json={**base, "agreed": False}).status_code == 422
    assert (
        c.post("/study/participants", json={"consent_version": "old", "agreed": True}).status_code
        == 409
    )
    pid = enrol(c, study_code="cohort-A")
    assert pid.startswith("P-") and len(pid) == 10
    row = store.rows("participants")[0]
    assert row["id"] == pid and row["study_code"] == "cohort-A"
    assert row["consent_version"] == study.CONSENT_VERSION


def test_enrolment_is_closed_unless_the_study_is_enabled(client, monkeypatch):
    c, _ = client
    monkeypatch.setattr(study.settings, "study_enabled", False)
    res = c.post(
        "/study/participants", json={"consent_version": study.CONSENT_VERSION, "agreed": True}
    )
    assert res.status_code == 403


def test_assessment_never_sends_the_answers(client):
    c, _ = client
    body = c.get("/study/assessment").json()
    assert len(body["items"]) == len(ITEMS)
    assert all(set(item) == {"id", "question", "options"} for item in body["items"])


def test_tests_are_graded_on_the_server_and_can_be_resubmitted(client):
    c, store = client
    pid = enrol(c)
    first = ITEMS[0]
    wrong = (first.answer + 1) % len(first.options)
    payload = {
        "participant_id": pid,
        "test": "pre",
        "answers": [{"item_id": first.id, "choice": wrong, "ms": 4200}],
    }
    assert c.post("/study/tests", json=payload).json() == {"saved": 1}
    assert store.rows("test_responses")[0]["correct"] is False
    payload["answers"][0]["choice"] = first.answer
    c.post("/study/tests", json=payload)
    rows = store.rows("test_responses")
    assert len(rows) == 1 and rows[0]["correct"] is True  # replaced, not duplicated


def test_test_submissions_are_validated(client):
    c, _ = client
    pid = enrol(c)
    ok = {"item_id": ITEMS[0].id, "choice": 0}
    assert (
        c.post(
            "/study/tests", json={"participant_id": "P-NOPE", "test": "pre", "answers": [ok]}
        ).status_code
        == 404
    )
    assert (
        c.post(
            "/study/tests", json={"participant_id": pid, "test": "mid", "answers": [ok]}
        ).status_code
        == 422
    )
    bad = {"participant_id": pid, "test": "pre", "answers": [{"item_id": "nope", "choice": 0}]}
    assert c.post("/study/tests", json=bad).status_code == 422


def events_body(pid, *events):
    return {"participant_id": pid, "session_id": "s1", "events": list(events)}


def test_events_are_stored_including_beacons_sent_as_text(client):
    c, store = client
    pid = enrol(c)
    body = events_body(
        pid,
        {
            "type": "concept_started",
            "at": "2026-09-24T10:00:00Z",
            "conceptId": "qubit",
            "questionId": "entanglement_ftl",
        },
        {
            "type": "check_attempt",
            "conceptId": "qubit",
            "checkIndex": 0,
            "correct": True,
            "attempt": 1,
        },
    )
    assert c.post("/study/events", json=body).json() == {"saved": 2}
    # navigator.sendBeacon sends text/plain when the page closes: this is how drop-off is caught.
    beacon = events_body(pid, {"type": "page_hidden", "conceptId": "qubit", "step": "check"})
    res = c.post(
        "/study/events", content=json.dumps(beacon), headers={"Content-Type": "text/plain"}
    )
    assert res.status_code == 200

    rows = store.rows("study_events")
    assert [r["type"] for r in rows] == ["concept_started", "check_attempt", "page_hidden"]
    assert rows[0]["concept_id"] == "qubit" and rows[0]["question_id"] == "entanglement_ftl"
    assert rows[1]["payload"] == {"checkIndex": 0, "correct": True, "attempt": 1}


def test_bad_event_batches_are_rejected(client):
    c, _ = client
    pid = enrol(c)
    assert c.post("/study/events", json=events_body(pid, {"type": "keystroke"})).status_code == 422
    huge = {"type": "step_viewed", "notes": "x" * 5000}
    assert c.post("/study/events", json=events_body(pid, huge)).status_code == 413
    assert (
        c.post("/study/events", json=events_body("P-NOPE", {"type": "page_hidden"})).status_code
        == 404
    )
    assert c.post("/study/events", content="not json").status_code == 422


def test_withdrawal_deletes_everything(client):
    c, store = client
    pid = enrol(c)
    c.post(
        "/study/events", json=events_body(pid, {"type": "concept_started", "conceptId": "qubit"})
    )
    c.post(
        "/study/tests",
        json={
            "participant_id": pid,
            "test": "pre",
            "answers": [{"item_id": ITEMS[0].id, "choice": 0}],
        },
    )
    assert c.delete(f"/study/participants/{pid}").status_code == 200
    assert store.rows("participants") == []
    assert store.rows("study_events") == []
    assert store.rows("test_responses") == []


def test_no_personal_data_is_stored(client):
    c, store = client
    pid = enrol(c)
    c.post(
        "/study/events",
        json=events_body(pid, {"type": "concept_started", "conceptId": "qubit"}),
        headers={"User-Agent": "Secret-Browser/1.0", "X-Forwarded-For": "203.0.113.7"},
    )
    dump = json.dumps({t: store.rows(t) for t in ("participants", "study_events")})
    assert "203.0.113.7" not in dump and "Secret-Browser" not in dump
    assert set(store.rows("participants")[0]) == {
        "id",
        "created_at",
        "study_code",
        "consent_version",
        "consented_at",
    }


def test_export_needs_the_researcher_token(client, monkeypatch):
    c, _ = client
    assert c.get("/study/export/participants.csv").status_code == 401
    assert (
        c.get(
            "/study/export/participants.csv", headers={"Authorization": "Bearer wrong"}
        ).status_code
        == 401
    )
    monkeypatch.setattr(study.settings, "study_admin_token", "")
    assert (
        c.get("/study/export/participants.csv", headers={"Authorization": "Bearer "}).status_code
        == 404
    )


def test_summary_export_has_scores_progress_and_drop_off(client):
    c, _ = client
    pid = enrol(c)
    answers = [{"item_id": i.id, "choice": i.answer} for i in ITEMS[:3]]
    c.post(
        "/study/tests",
        json={
            "participant_id": pid,
            "test": "pre",
            "answers": [{"item_id": ITEMS[0].id, "choice": ITEMS[0].answer}],
        },
    )
    c.post("/study/tests", json={"participant_id": pid, "test": "post", "answers": answers})
    c.post(
        "/study/events",
        json=events_body(
            pid,
            {"type": "concept_started", "conceptId": "qubit"},
            {
                "type": "step_viewed",
                "conceptId": "qubit",
                "step": "intuition",
                "msOnPreviousStep": 1500,
            },
            {"type": "check_attempt", "conceptId": "qubit", "correct": True, "attempt": 1},
            {"type": "concept_completed", "conceptId": "qubit", "ms": 90000},
            {"type": "detour_started", "fromConceptId": "superposition", "toConceptId": "qubit"},
            {"type": "page_hidden", "conceptId": "superposition", "step": "interactive"},
        ),
    )
    res = c.get("/study/export/summary.csv", headers={"Authorization": "Bearer secret-token"})
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    row = next(csv.DictReader(io.StringIO(res.text)))
    assert row["participant_id"] == pid
    assert (row["pre_correct"], row["post_correct"], row["post_answered"]) == ("1", "3", "3")
    assert row["concepts_completed"] == "1" and row["detours"] == "1"
    assert row["checks_correct_first_try"] == "1" and row["active_ms"] == "1500"
    assert (row["last_event"], row["last_concept"]) == ("page_hidden", "superposition")


def test_raw_table_exports(client):
    c, _ = client
    enrol(c)
    auth = {"Authorization": "Bearer secret-token"}
    for table in ("participants", "study_events", "test_responses", "question_log"):
        assert c.get(f"/study/export/{table}.csv", headers=auth).status_code == 200
    assert c.get("/study/export/secrets.csv", headers=auth).status_code == 404


# --- Supabase store (HTTP faked) ---------------------------------------------------------


class FakeResponse:
    def __init__(self, status=201, body=None):
        self.status_code, self._body, self.text = status, body if body is not None else [], ""

    def json(self):
        return self._body


class FakeSession:
    def __init__(self, *responses):
        self.responses, self.calls = list(responses), []

    def request(self, method, url, headers, params, json, timeout):
        self.calls.append(
            {"method": method, "url": url, "headers": headers, "params": params, "json": json}
        )
        return self.responses.pop(0) if self.responses else FakeResponse()


def test_supabase_new_secret_keys_are_not_sent_as_jwts():
    session = FakeSession()
    store = SupabaseStore("https://x.supabase.co", "sb_secret_abc", session)
    store.log_question(QuestionLogEntry("hi", "off_topic"))
    call = session.calls[0]
    assert call["url"] == "https://x.supabase.co/rest/v1/question_log"
    assert call["headers"]["apikey"] == "sb_secret_abc"
    assert "Authorization" not in call["headers"]


def test_supabase_legacy_jwt_keys_also_use_bearer():
    session = FakeSession()
    store = SupabaseStore("https://x.supabase.co/", "eyJhbGciOi.legacy", session)
    store.delete_participant("P-ABC")
    assert session.calls[0]["headers"]["Authorization"] == "Bearer eyJhbGciOi.legacy"
    assert session.calls[0]["params"] == {"id": "eq.P-ABC"}


def test_supabase_test_responses_upsert_and_rows_paginate():
    session = FakeSession(
        FakeResponse(201),
        FakeResponse(200, [{"id": i} for i in range(1000)]),
        FakeResponse(200, [{"id": 1000}]),
    )
    store = SupabaseStore("https://x.supabase.co", "sb_secret_abc", session)
    store.add_test_responses([TestResponse("P-A", "pre", "q1", 0, True)])
    upsert = session.calls[0]
    assert "resolution=merge-duplicates" in upsert["headers"]["Prefer"]
    assert upsert["params"] == {"on_conflict": "participant_id,test,item_id"}
    assert len(store.rows("study_events")) == 1001
    assert session.calls[2]["params"]["offset"] == 1000
