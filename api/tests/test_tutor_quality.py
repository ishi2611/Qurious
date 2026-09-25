"""Tutor behaviour with the real local embedding model (no LLM).

Marked `slow`: the first run downloads the all-MiniLM-L6-v2 ONNX model (~90 MB).
Run with: pytest -m slow
"""

import pytest

from app.content.loader import load_content
from app.content.paths import build_graph
from app.llm.client import LLMClient
from app.tutor.retrieval import Retriever, build_chunks, default_embedder
from app.tutor.service import Tutor

pytestmark = pytest.mark.slow

ON_TOPIC = [
    ("measurement", "Why does measuring change the qubit?"),
    ("superposition", "Is a qubit really 0 and 1 at the same time?"),
    ("entanglement", "How is entanglement different from the gloves in boxes?"),
    ("no_signaling", "Why can't Alice send Bob a message using the entangled pair?"),
    ("teleportation", "Why does Alice need to send two classical bits?"),
    ("no_cloning", "Why can't we just copy a qubit?"),
    ("qubit", "How much information does a qubit hold?"),
    ("classical_bits", "Why is the AND gate irreversible?"),
]

UNRELATED = [
    ("measurement", "What's a good recipe for banana bread?"),
    ("entanglement", "Who won the world cup in 2022?"),
    ("teleportation", "Can you write me a poem about cats?"),
]

# Real quantum topics that exist in the map but have no lesson yet.
NOT_WRITTEN_YET = [
    ("measurement", "How does Grover search work?", "Grover's search"),
    ("cnot", "Explain how Shor's algorithm factors 15", "Shor's algorithm"),
]


@pytest.fixture(scope="module")
def tutor():
    content = load_content()
    retriever = Retriever(build_chunks(content), default_embedder())
    return Tutor(content, build_graph(content.concepts), retriever, LLMClient([]))


@pytest.mark.parametrize("concept, question", ON_TOPIC)
def test_on_topic_follow_ups_are_answered_from_the_lessons(tutor, concept, question):
    answer = tutor.ask(concept, question)
    assert answer.supported, question
    assert answer.answer.startswith("From the lesson")


@pytest.mark.parametrize("concept, question", UNRELATED)
def test_unrelated_questions_are_not_answered(tutor, concept, question):
    assert not tutor.ask(concept, question).supported


@pytest.mark.parametrize("concept, question, topic", NOT_WRITTEN_YET)
def test_topics_without_lessons_are_named_honestly(tutor, concept, question, topic):
    answer = tutor.ask(concept, question)
    assert not answer.supported
    assert topic in answer.answer


def test_quotes_prefer_explanations_over_misconception_lines(tutor):
    answer = tutor.ask("no_signaling", "Doesn't measuring one particle instantly affect the other?")
    assert answer.supported
    assert "A common mistake" not in answer.answer
