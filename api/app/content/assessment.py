"""The study's pre/post-test (content/study/assessment.yaml): schema, loading and grading."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import Field, model_validator

from app.content.loader import DEFAULT_CONTENT_DIR, Content
from app.content.schema import Id, Strict, Text

ASSESSMENT_PATH = DEFAULT_CONTENT_DIR / "study" / "assessment.yaml"


class Item(Strict):
    id: Id
    concept_id: Id
    question: Text
    options: Annotated[list[Text], Field(min_length=2, max_length=5)]
    answer: Annotated[int, Field(ge=0)]

    @model_validator(mode="after")
    def answer_in_range(self) -> Item:
        if self.answer >= len(self.options):
            raise ValueError(f"answer {self.answer} is out of range")
        return self


class Assessment(Strict):
    version: Text
    status: Literal["draft", "reviewed"]
    items: Annotated[list[Item], Field(min_length=1)]

    @model_validator(mode="after")
    def unique_ids(self) -> Assessment:
        ids = [i.id for i in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("item ids must be unique")
        return self

    def public(self) -> dict:
        """What the browser gets: questions and options, never the answers."""
        return {
            "version": self.version,
            "items": [
                {"id": i.id, "question": i.question, "options": i.options} for i in self.items
            ],
        }


def load_assessment(path: Path = ASSESSMENT_PATH) -> Assessment:
    return Assessment.model_validate(yaml.safe_load(path.read_text()))


@lru_cache
def get_assessment() -> Assessment:
    return load_assessment()


def validate_assessment(assessment: Assessment, content: Content) -> list[str]:
    """Items must point at real concepts and must not repeat any lesson or quick-check question."""
    errors = []
    seen = {
        " ".join(c.question.split())
        for concept in content.concepts.values()
        for c in [*concept.checks, *concept.diagnostic]
    }
    for item in assessment.items:
        where = f"study/assessment.yaml: {item.id}"
        if item.concept_id not in content.concepts:
            errors.append(f"{where}: unknown concept '{item.concept_id}'")
        if " ".join(item.question.split()) in seen:
            errors.append(f"{where}: repeats a lesson or quick-check question")
    return errors
