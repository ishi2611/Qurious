"""Content and path-engine endpoints."""

from __future__ import annotations

from functools import lru_cache

import networkx as nx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.content.loader import Content, load_content
from app.content.paths import UnknownConceptError, build_graph, learning_path
from app.content.validate import validate

router = APIRouter()


class InvalidContentError(RuntimeError):
    pass


@lru_cache
def get_content() -> tuple[Content, nx.DiGraph]:
    """Load and validate content once per process. Refuses to serve broken content."""
    content = load_content()
    errors = validate(content)
    if errors:
        raise InvalidContentError("Content failed validation:\n" + "\n".join(errors))
    return content, build_graph(content.concepts)


class ConceptSummary(BaseModel):
    id: str
    title: str
    summary: str
    status: str
    prerequisites: list[str]
    estimated_minutes: int


class QuestionSummary(BaseModel):
    id: str
    question: str
    enabled: bool
    order: int
    preview: str
    targets: list[str]


class PathRequest(BaseModel):
    # Either a question id (targets come from its file) or explicit target concept ids.
    question_id: str | None = None
    targets: list[str] = Field(default_factory=list)
    known: list[str] = Field(default_factory=list)


class PathStep(BaseModel):
    id: str
    title: str
    estimated_minutes: int
    authored: bool
    is_target: bool


class PathResponse(BaseModel):
    targets: list[str]
    steps: list[PathStep]
    total_minutes: int


def _summary(concept) -> ConceptSummary:
    return ConceptSummary(**concept.model_dump(include=set(ConceptSummary.model_fields)))


@router.get("/concepts", response_model=list[ConceptSummary])
def list_concepts() -> list[ConceptSummary]:
    content, graph = get_content()
    # Foundations first, matching how paths are ordered.
    order = list(nx.lexicographical_topological_sort(graph))
    return [_summary(content.concepts[cid]) for cid in order]


@router.get("/questions", response_model=list[QuestionSummary])
def list_questions() -> list[QuestionSummary]:
    content, _ = get_content()
    questions = sorted(content.questions.values(), key=lambda q: (q.order, q.id))
    return [
        QuestionSummary(**q.model_dump(include=set(QuestionSummary.model_fields)))
        for q in questions
    ]


@router.post("/path", response_model=PathResponse)
def compute_path(req: PathRequest) -> PathResponse:
    """Ordered concepts from what the learner knows to their question's target concepts."""
    content, graph = get_content()
    targets = list(req.targets)
    if req.question_id:
        question = content.questions.get(req.question_id)
        if question is None:
            raise HTTPException(404, f"Unknown question '{req.question_id}'")
        targets = [*question.targets, *targets]
    if not targets:
        raise HTTPException(422, "Give a question_id or at least one target concept")

    try:
        ids = learning_path(graph, targets, req.known)
    except UnknownConceptError as e:
        raise HTTPException(422, str(e)) from e

    steps = [
        PathStep(
            id=cid,
            title=content.concepts[cid].title,
            estimated_minutes=content.concepts[cid].estimated_minutes,
            authored=content.concepts[cid].is_authored,
            is_target=cid in targets,
        )
        for cid in ids
    ]
    return PathResponse(
        targets=list(dict.fromkeys(targets)),
        steps=steps,
        total_minutes=sum(s.estimated_minutes for s in steps),
    )
