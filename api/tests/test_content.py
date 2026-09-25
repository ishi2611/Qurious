"""Schema rules, the validator, and the real content in content/."""

import copy
import textwrap

import pytest
import yaml
from pydantic import ValidationError

from app.content.loader import DEFAULT_CONTENT_DIR, load_content
from app.content.schema import CircuitGoalPuzzle, Concept, Question
from app.content.validate import main as validate_main
from app.content.validate import validate

CHECK = {
    "question": "q?",
    "options": ["a", "b"],
    "answer": 0,
    "explanation": "because",
}

AUTHORED = {
    "id": "superposition",
    "title": "Superposition",
    "summary": "s",
    "status": "draft",
    "prerequisites": ["qubit"],
    "estimated_minutes": 4,
    "hook": "why it matters",
    "intuition": {"analogy": "a", "where_it_breaks": "b"},
    "interactive": {"type": "bloch_sphere"},
    "checks": [CHECK],
    "diagnostic": [CHECK],
    "alt_explanation": "another way",
}


def test_authored_concept_is_valid():
    Concept.model_validate(AUTHORED)


@pytest.mark.parametrize("field", ["hook", "intuition", "interactive", "checks", "diagnostic"])
def test_authored_concept_needs_every_section(field):
    data = copy.deepcopy(AUTHORED)
    data.pop(field)
    with pytest.raises(ValidationError, match=field):
        Concept.model_validate(data)


def test_stub_needs_only_map_fields():
    Concept.model_validate(
        {"id": "grover", "title": "G", "summary": "s", "status": "stub", "estimated_minutes": 5}
    )


def test_every_check_needs_an_explanation():
    data = copy.deepcopy(AUTHORED)
    del data["checks"][0]["explanation"]
    with pytest.raises(ValidationError, match="explanation"):
        Concept.model_validate(data)


def test_check_answer_must_be_a_valid_option():
    data = copy.deepcopy(AUTHORED)
    data["checks"][0]["answer"] = 2
    with pytest.raises(ValidationError, match="out of range"):
        Concept.model_validate(data)


def test_unknown_keys_are_rejected():
    data = copy.deepcopy(AUTHORED)
    data["hookk"] = "typo"
    with pytest.raises(ValidationError, match="hookk"):
        Concept.model_validate(data)


def test_unknown_interactive_is_rejected():
    data = copy.deepcopy(AUTHORED)
    data["interactive"] = {"type": "hologram"}
    with pytest.raises(ValidationError):
        Concept.model_validate(data)


def test_puzzle_probabilities_must_sum_to_one_and_fit_the_qubits():
    base = {"type": "circuit_goal", "prompt": "p", "allowed_gates": ["H"]}
    with pytest.raises(ValidationError, match="sum to"):
        CircuitGoalPuzzle.model_validate({**base, "target_probabilities": {"0": 0.4}})
    with pytest.raises(ValidationError, match="doesn't fit"):
        CircuitGoalPuzzle.model_validate({**base, "target_probabilities": {"01": 1}})


def test_preview_must_stay_short():
    with pytest.raises(ValidationError, match="80 words"):
        Question.model_validate(
            {
                "id": "q",
                "question": "Q?",
                "status": "draft",
                "preview": "word " * 81,
                "targets": ["x"],
                "reward": {"type": "coming_soon", "title": "t", "description": "d"},
            }
        )


def write(folder, name, text):
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{name}.yaml").write_text(textwrap.dedent(text))


def stub(folder, id_, prereqs="[]"):
    write(
        folder,
        id_,
        f"""
        id: {id_}
        title: {id_}
        summary: s
        status: stub
        prerequisites: {prereqs}
        estimated_minutes: 3
        """,
    )


def question(folder, id_, targets, enabled="false"):
    write(
        folder,
        id_,
        f"""
        id: {id_}
        question: Q?
        status: draft
        enabled: {enabled}
        preview: A short preview.
        targets: {targets}
        reward: {{ type: coming_soon, title: t, description: d }}
        """,
    )


def test_validator_reports_every_problem(tmp_path):
    concepts, questions = tmp_path / "concepts", tmp_path / "questions"
    stub(concepts, "a")
    stub(concepts, "wrong_name")
    (concepts / "wrong_name.yaml").rename(concepts / "b.yaml")
    question(questions, "q1", "[missing]")
    errors = validate(load_content(tmp_path))
    assert any("file name must match id" in e for e in errors)
    assert any("unknown target concept(s): missing" in e for e in errors)


def test_enabled_question_cannot_route_through_stubs(tmp_path):
    concepts, questions = tmp_path / "concepts", tmp_path / "questions"
    stub(concepts, "a")
    question(questions, "q1", "[a]", enabled="true")
    errors = validate(load_content(tmp_path))
    assert any("unwritten (stub) concepts: a" in e for e in errors)
    assert any("need a real reward" in e for e in errors)


def test_validator_detects_cycles(tmp_path):
    concepts = tmp_path / "concepts"
    stub(concepts, "a", "[b]")
    stub(concepts, "b", "[a]")
    (tmp_path / "questions").mkdir()
    assert any("cycle" in e for e in validate(load_content(tmp_path)))


def test_invalid_yaml_is_reported(tmp_path):
    concepts = tmp_path / "concepts"
    concepts.mkdir()
    (concepts / "a.yaml").write_text("id: a\n  bad: [indent")
    (tmp_path / "questions").mkdir()
    assert any("invalid YAML" in e for e in validate(load_content(tmp_path)))


# --- The real content -----------------------------------------------------------------------


def test_real_content_passes_validation(capsys):
    assert validate_main(DEFAULT_CONTENT_DIR) == 0
    assert "Content OK" in capsys.readouterr().out


def test_every_real_lesson_is_still_a_draft():
    """Only the content owner marks lessons reviewed; this flags it in code review if it changes."""
    content = load_content()
    statuses = {c.status for c in content.concepts.values()} | {
        q.status for q in content.questions.values()
    }
    assert "reviewed" not in statuses


def test_real_yaml_files_parse_as_plain_yaml():
    for path in (DEFAULT_CONTENT_DIR / "concepts").glob("*.yaml"):
        assert isinstance(yaml.safe_load(path.read_text()), dict), path.name
