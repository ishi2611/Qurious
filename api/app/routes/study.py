"""Study mode: consent, pre/post-test, learning events, withdrawal, and CSV export.

What is collected is exactly what brief §8 lists, keyed by a random pseudonymous research id:
consent (version + time), test answers, and learning events (concept started/completed, check
attempts, time on step, detours, drop-off). No names, emails, IP addresses or user agents are
stored. Any change to this list must be approved by the content owner first.
"""

from __future__ import annotations

import csv
import io
import json
import secrets
from collections import defaultdict
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field, ValidationError

from app.config import settings
from app.content.assessment import get_assessment
from app.ratelimit import RateLimiter, client_key
from app.storage import Participant, StudyEvent, TestResponse, get_store
from app.storage.base import TABLES

router = APIRouter(prefix="/study")
limiter = RateLimiter(limit=120, window_seconds=60)

# Bump when the consent text changes; participants consent to a specific version.
CONSENT_VERSION = "v1-draft"

# Mirrors LearningEvent in web/src/lib/telemetry.ts.
EVENT_TYPES = {
    "question_selected",
    "diagnostic_answered",
    "path_started",
    "concept_started",
    "step_viewed",
    "check_attempt",
    "puzzle_attempt",
    "puzzle_skipped",
    "math_opened",
    "detour_started",
    "concept_completed",
    "reward_reached",
    "tutor_question",
    "page_hidden",
}
MAX_EVENTS_PER_BATCH = 100
MAX_PAYLOAD_BYTES = 2000
ID_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"  # no look-alikes (0/O, 1/I/L, U/V)


def rate_limited(request: Request) -> None:
    limiter.check(client_key(request))


def new_participant_id() -> str:
    return "P-" + "".join(secrets.choice(ID_ALPHABET) for _ in range(8))


def require_participant(participant_id: str) -> None:
    if not get_store().participant_exists(participant_id):
        raise HTTPException(404, "Unknown participant")


# --- Enrolment and withdrawal ----------------------------------------------------------------


class EnrolRequest(BaseModel):
    consent_version: str
    agreed: bool
    study_code: Annotated[str, Field(max_length=40, pattern=r"^[A-Za-z0-9_-]*$")] = ""


@router.post("/participants", dependencies=[Depends(rate_limited)])
def enrol(req: EnrolRequest) -> dict:
    if not settings.study_enabled:
        # Off by default so no participant data is collected before the consent form and test
        # have been reviewed (and approved by an ethics board, if required).
        raise HTTPException(403, "The study isn't open for enrolment")
    if not req.agreed:
        raise HTTPException(422, "Consent is required to take part")
    if req.consent_version != CONSENT_VERSION:
        raise HTTPException(409, "The consent form has changed. Please reload the page.")
    participant = Participant(
        id=new_participant_id(),
        consent_version=req.consent_version,
        consented_at=datetime.now(UTC).isoformat(),
        study_code=req.study_code or None,
    )
    get_store().add_participant(participant)
    return {"participant_id": participant.id}


@router.delete("/participants/{participant_id}", dependencies=[Depends(rate_limited)])
def withdraw(participant_id: str) -> dict:
    """Withdraw from the study: deletes the participant and all of their data."""
    require_participant(participant_id)
    get_store().delete_participant(participant_id)
    return {"deleted": participant_id}


# --- Pre/post-test ---------------------------------------------------------------------------


@router.get("/assessment")
def assessment() -> dict:
    return get_assessment().public()


class Answer(BaseModel):
    item_id: str
    choice: int = Field(ge=0)
    ms: int | None = Field(default=None, ge=0)


class TestSubmission(BaseModel):
    participant_id: str
    test: Literal["pre", "post"]
    answers: Annotated[list[Answer], Field(min_length=1, max_length=50)]


@router.post("/tests", dependencies=[Depends(rate_limited)])
def submit_test(sub: TestSubmission) -> dict:
    require_participant(sub.participant_id)
    items = {i.id: i for i in get_assessment().items}
    unknown = [a.item_id for a in sub.answers if a.item_id not in items]
    if unknown:
        raise HTTPException(422, f"Unknown items: {', '.join(unknown)}")
    responses = [
        TestResponse(
            participant_id=sub.participant_id,
            test=sub.test,
            item_id=a.item_id,
            choice=a.choice,
            correct=a.choice == items[a.item_id].answer,
            ms=a.ms,
        )
        for a in sub.answers
    ]
    get_store().add_test_responses(responses)
    # Scores aren't returned: showing them could influence the post-test.
    return {"saved": len(responses)}


# --- Learning events -------------------------------------------------------------------------


class IncomingEvent(BaseModel):
    type: str
    at: str | None = None
    conceptId: str | None = None  # noqa: N815 - matches the browser's field names
    questionId: str | None = None  # noqa: N815

    model_config = {"extra": "allow"}


class EventBatch(BaseModel):
    participant_id: str
    session_id: Annotated[str, Field(min_length=1, max_length=64)]
    events: Annotated[list[IncomingEvent], Field(min_length=1, max_length=MAX_EVENTS_PER_BATCH)]


@router.post("/events", dependencies=[Depends(rate_limited)])
async def record_events(request: Request) -> dict:
    # Parsed by hand because the browser may send this with navigator.sendBeacon (text/plain)
    # when a page is being closed, which is how the drop-off point is captured.
    try:
        batch = EventBatch.model_validate(json.loads(await request.body()))
    except (ValueError, ValidationError) as e:
        raise HTTPException(422, "Invalid event batch") from e
    require_participant(batch.participant_id)

    events = []
    for e in batch.events:
        if e.type not in EVENT_TYPES:
            raise HTTPException(422, f"Unknown event type '{e.type}'")
        payload = e.model_extra or {}
        if len(json.dumps(payload)) > MAX_PAYLOAD_BYTES:
            raise HTTPException(413, "Event payload too large")
        events.append(
            StudyEvent(
                participant_id=batch.participant_id,
                session_id=batch.session_id,
                type=e.type,
                concept_id=e.conceptId,
                question_id=e.questionId,
                payload=payload,
                client_at=e.at,
            )
        )
    get_store().add_events(events)
    return {"saved": len(events)}


# --- Export (researchers only) ---------------------------------------------------------------


def require_admin(authorization: Annotated[str | None, Header()] = None) -> None:
    token = settings.study_admin_token
    if not token:
        raise HTTPException(404, "Export is not enabled (set STUDY_ADMIN_TOKEN)")
    if not authorization or not secrets.compare_digest(authorization, f"Bearer {token}"):
        raise HTTPException(401, "Researcher token required")


def summarize(participants: list[dict], events: list[dict], tests: list[dict]) -> list[dict]:
    """One analysis-ready row per participant: scores, progress, time, and drop-off point."""
    by_participant: dict[str, list[dict]] = defaultdict(list)
    for e in events:
        by_participant[e["participant_id"]].append(e)
    scores: dict[tuple[str, str], list[bool]] = defaultdict(list)
    for t in tests:
        scores[(t["participant_id"], t["test"])].append(bool(t["correct"]))

    rows = []
    for p in participants:
        pid = p["id"]
        evs = sorted(
            by_participant[pid], key=lambda e: (e.get("received_at") or "", e.get("id") or 0)
        )
        checks = [e for e in evs if e["type"] == "check_attempt"]
        last = evs[-1] if evs else {}
        rows.append(
            {
                "participant_id": pid,
                "study_code": p.get("study_code") or "",
                "consent_version": p["consent_version"],
                "consented_at": p["consented_at"],
                "pre_correct": sum(scores[(pid, "pre")]),
                "pre_answered": len(scores[(pid, "pre")]),
                "post_correct": sum(scores[(pid, "post")]),
                "post_answered": len(scores[(pid, "post")]),
                "concepts_completed": sum(e["type"] == "concept_completed" for e in evs),
                "check_attempts": len(checks),
                "checks_correct_first_try": sum(
                    1
                    for e in checks
                    if e["payload"].get("correct") and e["payload"].get("attempt") == 1
                ),
                "detours": sum(e["type"] == "detour_started" for e in evs),
                "rewards_reached": sum(e["type"] == "reward_reached" for e in evs),
                "active_ms": sum(
                    int(e["payload"].get("msOnPreviousStep") or 0)
                    for e in evs
                    if e["type"] == "step_viewed"
                ),
                "last_event": last.get("type", ""),
                "last_concept": last.get("concept_id") or "",
                "last_event_at": last.get("received_at", ""),
            }
        )
    return rows


def to_csv(rows: list[dict]) -> str:
    buffer = io.StringIO()
    if not rows:
        return ""
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0]))
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in row.items()}
        )
    return buffer.getvalue()


@router.get("/export/{name}.csv", dependencies=[Depends(require_admin)])
def export(name: str) -> Response:
    store = get_store()
    if name == "summary":
        rows = summarize(
            store.rows("participants"), store.rows("study_events"), store.rows("test_responses")
        )
    elif name in TABLES:
        rows = store.rows(name)
    else:
        raise HTTPException(404, f"Unknown export '{name}'")
    return Response(
        to_csv(rows),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="qurious-{name}.csv"'},
    )
