"""The tutor stays grounded: it answers only from retrieved lesson content, says honestly when
something isn't covered, and never lets the LLM invent concepts. Providers are faked, and a
tiny deterministic bag-of-words embedder stands in for the real model so tests run offline."""

import hashlib
import json
import math
import re

import pytest
from fastapi.testclient import TestClient

from app.content.loader import load_content
from app.content.paths import build_graph
from app.llm.client import LLMClient
from app.main import app
from app.routes import tutor as tutor_routes
from app.storage.sqlite import SQLiteStore
from app.tutor.retrieval import Retriever, build_chunks
from app.tutor.service import NOT_COVERED, Tutor

DIM = 512
STOP = {
    "the",
    "a",
    "an",
    "of",
    "is",
    "to",
    "and",
    "in",
    "it",
    "what",
    "why",
    "how",
    "does",
    "do",
    "you",
    "can",
    "i",
    "my",
    "on",
    "for",
    "be",
    "that",
    "this",
    "with",
    "are",
}


def fake_embed(texts):
    """Hashed bag of words, normalized. Shared words ⇒ higher cosine similarity."""
    out = []
    for text in texts:
        v = [0.0] * DIM
        for word in re.findall(r"[a-z]+", text.lower()):
            if word not in STOP:
                v[int(hashlib.md5(word.encode()).hexdigest(), 16) % DIM] += 1
        norm = math.sqrt(sum(x * x for x in v)) or 1
        out.append([x / norm for x in v])
    return out


class ScriptedLLM:
    """Stands in for LLMClient: records prompts and returns scripted JSON."""

    def __init__(self, *replies, available=True):
        self.replies, self.available, self.prompts = list(replies), available, []

    def complete(self, request):
        self.prompts.append(request)
        reply = self.replies.pop(0)
        from app.llm.client import Completion

        return Completion(reply if isinstance(reply, str) else json.dumps(reply), "fake", "fake")


CONTENT = load_content()
GRAPH = build_graph(CONTENT.concepts)
RETRIEVER = Retriever(build_chunks(CONTENT), fake_embed)


def tutor(llm=None):
    return Tutor(CONTENT, GRAPH, RETRIEVER, llm or LLMClient([]))


ON_TOPIC = "Why does measuring a qubit change its state to the result?"


# --- Follow-up questions ------------------------------------------------------------------


def test_unrelated_question_is_refused_without_calling_the_llm():
    llm = ScriptedLLM()
    answer = tutor(llm).ask("measurement", "What's a good recipe for banana bread?")
    assert not answer.supported
    assert answer.answer == NOT_COVERED
    assert llm.prompts == []  # nothing to ground an answer in, so the LLM is never asked


def test_grounded_llm_answer_cites_the_excerpts_it_was_given():
    first = tutor().retriever.search(ON_TOPIC, concept_ids=["measurement"])[0].chunk.id
    llm = ScriptedLLM(
        {"supported": True, "answer": "Because measurement collapses it.", "source_ids": [first]}
    )
    answer = tutor(llm).ask("measurement", ON_TOPIC)
    assert answer.supported and answer.method == "llm"
    assert answer.answer == "Because measurement collapses it."
    assert answer.sources and answer.sources[0].concept_id == "measurement"


def test_llm_only_sees_retrieved_lesson_excerpts_from_this_step_and_below():
    llm = ScriptedLLM({"supported": False, "answer": "", "source_ids": []})
    tutor(llm).ask("measurement", ON_TOPIC)
    prompt = llm.prompts[0]
    assert "Use ONLY the lesson excerpts provided" in prompt.system
    ids = re.findall(r"^\[([a-z_]+)#\d+\]", prompt.user, flags=re.M)
    assert ids, "the prompt should contain lesson excerpts"
    allowed = {
        "measurement",
        "superposition",
        "qubit",
        "classical_bits",
        "vectors_and_kets",
        "probability_basics",
    }
    assert set(ids) <= allowed  # nothing from lessons further ahead (e.g. teleportation)


def test_llm_saying_unsupported_gives_an_honest_not_covered():
    llm = ScriptedLLM({"supported": False, "answer": "", "source_ids": []})
    answer = tutor(llm).ask("measurement", ON_TOPIC)
    assert not answer.supported and answer.answer == NOT_COVERED


def test_llm_answer_citing_nothing_it_was_given_is_discarded():
    llm = ScriptedLLM(
        {"supported": True, "answer": "Invented physics.", "source_ids": ["made_up#9"]}
    )
    answer = tutor(llm).ask("measurement", ON_TOPIC)
    assert "Invented physics" not in answer.answer
    assert answer.method == "retrieval" and answer.answer.startswith("From the lesson")


def test_broken_llm_output_falls_back_to_quoting_the_lesson():
    answer = tutor(ScriptedLLM("not json at all")).ask("measurement", ON_TOPIC)
    assert answer.supported and answer.method == "retrieval"


def test_without_an_llm_the_tutor_quotes_the_best_lesson_passage():
    answer = tutor().ask("measurement", ON_TOPIC)
    assert answer.supported and answer.method == "retrieval"
    assert answer.sources[0].concept_id in {"measurement", "superposition", "qubit"}


def test_unknown_concept_raises():
    with pytest.raises(KeyError):
        tutor().ask("warp_drive", ON_TOPIC)


# --- Hooks ----------------------------------------------------------------------------------


def test_authored_question_hook_wins_over_the_llm():
    llm = ScriptedLLM()
    hook, personalized = tutor(llm).personalized_hook("entanglement", "entanglement_ftl")
    assert hook == CONTENT.concepts["entanglement"].question_hooks["entanglement_ftl"]
    assert not personalized and llm.prompts == []


def test_llm_personalizes_hooks_that_have_no_authored_version():
    llm = ScriptedLLM({"hook": "Measurement is where your question about light speed begins."})
    hook, personalized = tutor(llm).personalized_hook("measurement", "entanglement_ftl")
    assert personalized and "light speed" in hook
    assert "Do NOT answer the learner's question" in llm.prompts[0].system


def test_overlong_or_failed_personalization_keeps_the_authored_hook():
    long = {"hook": "word " * 80}
    assert tutor(ScriptedLLM(long)).personalized_hook("measurement", "entanglement_ftl") == (
        CONTENT.concepts["measurement"].hook,
        False,
    )
    assert (
        tutor(ScriptedLLM("oops")).personalized_hook("measurement", "entanglement_ftl")[1] is False
    )


# --- v2 free-text routing -------------------------------------------------------------------


def test_router_drops_concept_ids_the_llm_invented():
    llm = ScriptedLLM(
        {"status": "mapped", "targets": ["no_signaling", "warp_drive"], "uncovered": []}
    )
    result = tutor(llm).route("Can I use entanglement to text my friend on Mars instantly?")
    assert result.targets == ["no_signaling"]
    assert result.status == "mapped"


def test_router_is_honest_about_concepts_without_lessons():
    llm = ScriptedLLM({"status": "mapped", "targets": ["shor"], "uncovered": []})
    result = tutor(llm).route("How does Shor's algorithm factor numbers?")
    assert result.status == "partial"
    assert result.targets == []  # shor's path includes unwritten lessons
    assert "Shor's algorithm" in result.uncovered
    assert "doesn't cover" in result.message


def test_router_off_topic():
    llm = ScriptedLLM({"status": "off_topic", "targets": [], "uncovered": []})
    result = tutor(llm).route("What's the best pizza topping?")
    assert result.status == "off_topic" and result.targets == []


def test_router_works_without_an_llm():
    result = tutor().route("Is quantum teleportation real teleportation with entangled qubits?")
    assert result.method == "retrieval"
    assert result.status in {"mapped", "partial"}
    assert result.targets and all(t in CONTENT.concepts for t in result.targets)


# --- Endpoints ------------------------------------------------------------------------------


@pytest.fixture
def api(monkeypatch, tmp_path):
    store = SQLiteStore(tmp_path / "test.db")
    monkeypatch.setattr(tutor_routes, "get_tutor", lambda: tutor())
    monkeypatch.setattr(tutor_routes, "get_store", lambda: store)
    tutor_routes.limiter._hits.clear()
    return TestClient(app), store


def test_ask_endpoint(api):
    client, _ = api
    res = client.post("/tutor/ask", json={"concept_id": "measurement", "message": ON_TOPIC})
    assert res.status_code == 200 and res.json()["supported"]
    assert (
        client.post("/tutor/ask", json={"concept_id": "nope", "message": "hi"}).status_code == 404
    )
    assert (
        client.post("/tutor/ask", json={"concept_id": "qubit", "message": "x" * 501}).status_code
        == 422
    )


def test_tutor_endpoints_are_rate_limited(api):
    client, _ = api
    body = {"concept_id": "qubit", "question_id": "entanglement_ftl"}
    codes = [client.post("/tutor/hook", json=body).status_code for _ in range(21)]
    assert codes[:20] == [200] * 20 and codes[20] == 429


def test_route_is_behind_a_flag_and_logs_every_question(api, monkeypatch):
    client, store = api
    assert client.post("/tutor/route", json={"text": "What is a qubit?"}).status_code == 404
    monkeypatch.setattr(tutor_routes.settings, "feature_free_text", True)
    res = client.post("/tutor/route", json={"text": "Is quantum teleportation real?"})
    assert res.status_code == 200
    log = store.question_log()
    assert log[-1]["raw_text"] == "Is quantum teleportation real?"
    assert log[-1]["status"] == res.json()["status"]
