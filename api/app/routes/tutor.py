"""Tutor endpoints: follow-up questions, personalized hooks, and the v2 free-text router."""

from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.llm import get_llm
from app.ratelimit import RateLimiter, client_key
from app.routes.content import get_content
from app.storage import QuestionLogEntry, get_store
from app.tutor.retrieval import DEFAULT_CACHE, Retriever, build_chunks, default_embedder
from app.tutor.service import Tutor

router = APIRouter(prefix="/tutor")
# Per visitor (IP). A classroom often shares one IP, so limits are per-minute and generous;
# the LLM client's own backoff and fallback handle provider quotas. Hooks are hand-written or
# cached almost every time, so they get a much higher limit than open questions.
limiter = RateLimiter(limit=30, window_seconds=60)
hook_limiter = RateLimiter(limit=240, window_seconds=60)


@lru_cache
def get_tutor() -> Tutor:
    content, graph = get_content()
    retriever = Retriever(build_chunks(content), default_embedder(), cache=DEFAULT_CACHE)
    return Tutor(content, graph, retriever, get_llm())


def rate_limited(request: Request) -> None:
    limiter.check(client_key(request))


def hook_rate_limited(request: Request) -> None:
    hook_limiter.check(client_key(request))


class AskRequest(BaseModel):
    concept_id: str
    question_id: str | None = None
    message: str = Field(min_length=1, max_length=500)


class AskResponse(BaseModel):
    answer: str
    supported: bool
    sources: list[dict]
    suggestion: dict | None


@router.post("/ask", response_model=AskResponse, dependencies=[Depends(rate_limited)])
def ask(req: AskRequest) -> AskResponse:
    tutor = get_tutor()
    try:
        result = tutor.ask(req.concept_id, req.message.strip())
    except KeyError as e:
        raise HTTPException(404, f"Unknown concept '{req.concept_id}'") from e
    return AskResponse(
        answer=result.answer,
        supported=result.supported,
        sources=[s.__dict__ for s in result.sources],
        suggestion=result.suggestion,
    )


class HookRequest(BaseModel):
    concept_id: str
    question_id: str


class HookResponse(BaseModel):
    hook: str
    personalized: bool


@router.post("/hook", response_model=HookResponse, dependencies=[Depends(hook_rate_limited)])
def hook(req: HookRequest) -> HookResponse:
    tutor = get_tutor()
    if req.concept_id not in tutor.content.concepts:
        raise HTTPException(404, f"Unknown concept '{req.concept_id}'")
    text, personalized = tutor.personalized_hook(req.concept_id, req.question_id)
    return HookResponse(hook=text, personalized=personalized)


class RouteRequest(BaseModel):
    text: str = Field(min_length=3, max_length=300)


class RouteResponse(BaseModel):
    status: str
    message: str
    targets: list[str]
    target_titles: list[str]
    uncovered: list[str]


@router.post("/route", response_model=RouteResponse, dependencies=[Depends(rate_limited)])
def route(req: RouteRequest) -> RouteResponse:
    """v2 free-text questions, behind the FEATURE_FREE_TEXT flag."""
    if not settings.feature_free_text:
        raise HTTPException(404, "Free-text questions aren't enabled")
    result = get_tutor().route(req.text.strip())
    # Always log the raw question and the mapping result (brief §7).
    get_store().log_question(
        QuestionLogEntry(
            raw_text=req.text.strip(),
            status=result.status,
            targets=result.targets,
            uncovered=result.uncovered,
            method=result.method,
        )
    )
    return RouteResponse(
        status=result.status,
        message=result.message,
        targets=result.targets,
        target_titles=result.target_titles,
        uncovered=result.uncovered,
    )
