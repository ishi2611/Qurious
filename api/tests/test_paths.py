import pytest

from app.content.paths import CycleError, UnknownConceptError, build_graph, learning_path
from app.content.schema import Concept


def concept(id_: str, *prereqs: str) -> Concept:
    return Concept(
        id=id_,
        title=id_,
        summary="s",
        status="stub",
        prerequisites=list(prereqs),
        estimated_minutes=3,
    )


def graph_of(*concepts: Concept):
    return build_graph({c.id: c for c in concepts})


# A small map shaped like the real one:
#   bits ─┐
#          ├─ qubit ── superposition ── measurement ─┬─ gates ── cnot ── entanglement
#   kets ─┘                                          └──────────────────────────────── decoherence
MAP = graph_of(
    concept("bits"),
    concept("kets"),
    concept("qubit", "bits", "kets"),
    concept("superposition", "qubit"),
    concept("measurement", "superposition"),
    concept("gates", "measurement"),
    concept("cnot", "gates", "bits"),
    concept("entanglement", "cnot"),
    concept("decoherence", "measurement", "entanglement"),
)


def test_path_includes_all_prerequisites_in_dependency_order():
    path = learning_path(MAP, ["entanglement"])
    assert set(path) == {
        "bits",
        "kets",
        "qubit",
        "superposition",
        "measurement",
        "gates",
        "cnot",
        "entanglement",
    }
    for node in path:
        for prereq in MAP.predecessors(node):
            assert path.index(prereq) < path.index(node), f"{prereq} must come before {node}"


def test_path_is_deterministic():
    assert learning_path(MAP, ["decoherence"]) == learning_path(MAP, ["decoherence"])
    # Foundations of equal depth are ordered by id.
    assert learning_path(MAP, ["qubit"]) == ["bits", "kets", "qubit"]


def test_known_concepts_are_removed_along_with_what_only_they_needed():
    path = learning_path(MAP, ["entanglement"], known=["measurement"])
    # measurement and everything under it are skipped...
    assert "measurement" not in path and "qubit" not in path and "kets" not in path
    # ...but "bits" is still needed by cnot, which isn't known.
    assert path == ["bits", "gates", "cnot", "entanglement"]


def test_everything_known_gives_empty_path():
    assert learning_path(MAP, ["qubit"], known=["qubit"]) == []


def test_multiple_targets_share_prerequisites_once():
    path = learning_path(MAP, ["entanglement", "decoherence"])
    assert len(path) == len(set(path))
    assert path[-1] == "decoherence"


def test_unknown_concepts_are_rejected():
    with pytest.raises(UnknownConceptError):
        learning_path(MAP, ["teleportation"])
    with pytest.raises(UnknownConceptError):
        learning_path(MAP, ["qubit"], known=["nope"])


def test_missing_prerequisite_is_rejected():
    with pytest.raises(UnknownConceptError, match="requires unknown concept 'ghost'"):
        graph_of(concept("a", "ghost"))


def test_cycles_are_detected_and_named():
    with pytest.raises(CycleError, match="prerequisite cycle"):
        graph_of(concept("a", "c"), concept("b", "a"), concept("c", "b"))
