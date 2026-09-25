"""Content validator. Run from api/:  python -m app.content.validate

Checks every concept and question file:
  * each file matches the schema (see schema.py): required lesson sections, every check has an
    explanation and a valid answer, puzzle targets are consistent
  * every prerequisite and question target exists, and there are no prerequisite cycles
  * enabled questions only lead through authored (non-stub) lessons, so learners never hit a
    dead end
  * every circuit puzzle can actually be solved with its allowed gates (checked by search)
  * question-specific hooks refer to real questions
  * the study's pre/post-test (content/study/assessment.yaml) is valid and never repeats a
    lesson or quick-check question

Math rendering is checked separately with KaTeX (`npm run content:math` in web/), because
KaTeX is a JavaScript library. `scripts/validate-content.sh` runs both.

Exits with status 1 and a list of problems if anything fails.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml
from pydantic import ValidationError

from app.content.assessment import load_assessment, validate_assessment
from app.content.loader import DEFAULT_CONTENT_DIR, Content, load_content
from app.content.paths import CycleError, UnknownConceptError, build_graph, learning_path
from app.content.puzzles import shortest_solution
from app.content.schema import CircuitGoalPuzzle


def validate(content: Content) -> list[str]:
    errors = list(content.errors)

    try:
        graph = build_graph(content.concepts)
    except (UnknownConceptError, CycleError) as e:
        return [*errors, str(e)]

    for concept in content.concepts.values():
        where = f"concepts/{concept.id}.yaml"
        for question_id in concept.question_hooks:
            if question_id not in content.questions:
                errors.append(f"{where}: question_hooks refers to unknown question '{question_id}'")
        if (
            isinstance(concept.puzzle, CircuitGoalPuzzle)
            and shortest_solution(concept.puzzle) is None
        ):
            errors.append(f"{where}: the circuit puzzle can't be solved with its allowed gates")

    for question in content.questions.values():
        where = f"questions/{question.id}.yaml"
        missing = [t for t in question.targets if t not in content.concepts]
        if missing:
            errors.append(f"{where}: unknown target concept(s): {', '.join(missing)}")
            continue
        if not question.enabled:
            continue
        path = learning_path(graph, question.targets)
        stubs = [c for c in path if not content.concepts[c].is_authored]
        if stubs:
            errors.append(
                f"{where}: enabled, but its path includes unwritten (stub) concepts: "
                + ", ".join(stubs)
            )
        if question.reward.type == "coming_soon":
            errors.append(f"{where}: enabled questions need a real reward activity")

    return errors


def validate_study(content: Content, content_dir: Path) -> list[str]:
    path = content_dir / "study" / "assessment.yaml"
    if not path.exists():
        return []
    try:
        assessment = load_assessment(path)
    except (ValidationError, yaml.YAMLError) as e:
        return [f"study/assessment.yaml: {e}"]
    return validate_assessment(assessment, content)


def main(content_dir: Path = DEFAULT_CONTENT_DIR) -> int:
    content = load_content(content_dir)
    errors = validate(content) + validate_study(content, content_dir)
    authored = sum(c.is_authored for c in content.concepts.values())
    enabled = sum(q.enabled for q in content.questions.values())
    if errors:
        print(f"Content has {len(errors)} problem(s):")
        for error in errors:
            print(f"  ✗ {error}")
        return 1
    print(
        f"✓ Content OK: {len(content.concepts)} concepts ({authored} authored), "
        f"{len(content.questions)} questions ({enabled} enabled)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
