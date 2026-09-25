"""The tutor layer: grounded follow-ups, hook personalization, and the v2 free-text router.

Qurious is a tutor, not a chatbot. The rules enforced here:
  * Follow-up answers use ONLY retrieved lesson excerpts. If retrieval finds nothing relevant,
    the LLM is never called and the learner is told honestly that it isn't covered yet.
  * An LLM answer must cite at least one of the excerpts it was given, or it's discarded.
  * Personalized hooks connect a lesson to the learner's question but never answer it.
  * Free-text questions are mapped onto existing concept ids only; unknown ids are dropped.
  * Everything works without an LLM (retrieval-only answers, authored hooks, retrieval routing).
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, ValidationError

from app.content.loader import Content
from app.content.paths import learning_path
from app.llm import LLMClient, LLMUnavailable, Request
from app.tutor.retrieval import Hit, Retriever

log = logging.getLogger("qurious.tutor")

# Cosine-similarity thresholds for the local MiniLM embedder, tuned on the questions in
# tests/test_tutor_quality.py (on-topic follow-ups scored ≥ 0.42, unrelated ones ≤ 0.18).
# Below SUPPORTED, a follow-up isn't answered; below SUGGEST, we don't point to a lesson.
# Without an LLM to judge relevance, quoting a passage needs a closer match.
SUPPORTED_SIMILARITY = 0.35
SUGGEST_SIMILARITY = 0.25
RETRIEVAL_ONLY_SIMILARITY = 0.45
ROUTE_MAPPED_SIMILARITY = 0.45
ROUTE_PARTIAL_SIMILARITY = 0.32

MAX_ANSWER_CHARS = 800
MAX_HOOK_WORDS = 60

NOT_COVERED = (
    "That isn't covered in Qurious's lessons yet, so I won't guess. "
    "Try rephrasing it in terms of this step, or explore a related lesson."
)

# System prompts, one rule per line.
TUTOR_SYSTEM = "\n".join(
    [
        "You are the Qurious tutor, helping a learner with one step of a quantum computing lesson.",
        "Rules you must follow:",
        "1. Use ONLY the lesson excerpts provided. Do not use outside knowledge,"
        " even if you know the answer.",
        '2. If the excerpts do not contain what is needed to answer, set "supported" to false'
        ' and leave "answer" empty.',
        "3. Stay within this step. Do not give the full answer to the learner's bigger question;"
        " the lessons teach that.",
        "4. Be brief and plain: at most 4 sentences, no LaTeX, no lists.",
        '5. List the ids of the excerpts you used in "source_ids".',
        "Reply with JSON only:"
        ' {"supported": true or false, "answer": "...", "source_ids": ["..."]}',
    ]
)

HOOK_SYSTEM = "\n".join(
    [
        "You write the opening line of a lesson step for Qurious, a quantum computing tutor.",
        "Rewrite the given hook in 1-2 sentences (at most 45 words) so it connects this step"
        " to the learner's question.",
        "Do NOT answer the learner's question, and do not add any fact that isn't in the hook"
        " or summary.",
        'Reply with JSON only: {"hook": "..."}',
    ]
)

ROUTE_SYSTEM = "\n".join(
    [
        "You map a learner's question onto the concepts of a quantum computing course.",
        "You may ONLY use concept ids from the list provided. Choose the 1-3 concepts that the"
        " answer most depends on.",
        'status: "mapped" if the listed concepts cover the question, "partial" if they cover'
        ' only part of it, "off_topic" if it is not about quantum computing or the listed'
        " concepts don't help at all.",
        '"uncovered": short phrases for parts of the question the listed concepts don\'t cover.',
        "Do NOT answer the question itself.",
        'Reply with JSON only: {"status": "...", "targets": ["concept_id"], "uncovered": ["..."]}',
    ]
)


class _TutorReply(BaseModel):
    supported: bool
    answer: str = ""
    source_ids: list[str] = []


class _HookReply(BaseModel):
    hook: str


class _RouteReply(BaseModel):
    status: Literal["mapped", "partial", "off_topic"]
    targets: list[str] = []
    uncovered: list[str] = []


def _parse_json(text: str) -> dict:
    """Parse a JSON object, tolerating code fences some models wrap around it."""
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(text)


@dataclass
class Source:
    concept_id: str
    title: str
    section: str


@dataclass
class TutorAnswer:
    answer: str
    supported: bool
    sources: list[Source] = field(default_factory=list)
    suggestion: dict | None = None
    method: Literal["llm", "retrieval", "none"] = "none"


@dataclass
class RouteResult:
    status: Literal["mapped", "partial", "off_topic"]
    message: str
    targets: list[str]
    target_titles: list[str]
    uncovered: list[str]
    method: Literal["llm", "retrieval"]


class Tutor:
    def __init__(self, content: Content, graph, retriever: Retriever, llm: LLMClient):
        self.content, self.graph, self.retriever, self.llm = content, graph, retriever, llm

    # ------------------------------------------------------------------ follow-up questions

    def _scope(self, concept_id: str) -> list[str]:
        """The current concept plus everything it builds on: what this step may draw from."""
        path = learning_path(self.graph, [concept_id])
        return [c for c in path if self.content.concepts[c].is_authored]

    def _suggestion(self, hits: list[Hit]) -> dict | None:
        if hits and hits[0].similarity >= SUGGEST_SIMILARITY:
            c = hits[0].chunk
            return {"concept_id": c.concept_id, "title": c.title}
        return None

    def ask(self, concept_id: str, message: str) -> TutorAnswer:
        if concept_id not in self.content.concepts:
            raise KeyError(concept_id)
        hits = self.retriever.search(message, k=5, concept_ids=self._scope(concept_id))
        best = hits[0].similarity if hits else 0.0

        # Is this really about a topic that's in the map but not written yet (e.g. Grover's
        # search)? Quantum questions like that can look similar to real lessons, so compare
        # against the unwritten concepts directly and say honestly that it isn't covered.
        nearest = self.retriever.search(message, k=1, authored_only=False)
        if (
            nearest
            and not nearest[0].chunk.authored
            and nearest[0].similarity >= max(SUPPORTED_SIMILARITY, best)
        ):
            title = nearest[0].chunk.title
            return TutorAnswer(
                f"That's about {title}, which Qurious doesn't have a lesson on yet, "
                "so I won't guess. It's on the list of lessons to write.",
                supported=False,
            )

        if best < SUPPORTED_SIMILARITY:
            # Not in this step's lessons: look across every lesson for somewhere to point them.
            anywhere = self.retriever.search(message, k=1)
            return TutorAnswer(NOT_COVERED, supported=False, suggestion=self._suggestion(anywhere))

        relevant = [h for h in hits if h.similarity >= SUGGEST_SIMILARITY]
        if self.llm.available:
            answer = self._llm_answer(concept_id, message, relevant)
            if answer:
                return answer
        if best < RETRIEVAL_ONLY_SIMILARITY:
            return TutorAnswer(NOT_COVERED, supported=False, suggestion=self._suggestion(hits))
        # No LLM (or it failed or strayed): quote the best-matching lesson passage verbatim.
        # Prefer passages that explain over lines that state a misconception, which read badly
        # out of context, as long as they match nearly as well.
        explanatory = [
            h
            for h in relevant
            if h.chunk.section != "common misconception"
            and h.similarity >= max(RETRIEVAL_ONLY_SIMILARITY, relevant[0].similarity - 0.1)
        ]
        best = (explanatory or relevant)[0].chunk
        return TutorAnswer(
            f"From the lesson “{best.title}”: {best.text}",
            supported=True,
            sources=[Source(best.concept_id, best.title, best.section)],
            method="retrieval",
        )

    def _llm_answer(self, concept_id: str, message: str, hits: list[Hit]) -> TutorAnswer | None:
        excerpts = "\n".join(
            f"[{h.chunk.id}] ({h.chunk.title}, {h.chunk.section}): {h.chunk.text}" for h in hits
        )
        user = (
            f"Current step: {self.content.concepts[concept_id].title}\n\n"
            f"Lesson excerpts:\n{excerpts}\n\n"
            f"Learner's question: {message}"
        )
        try:
            completion = self.llm.complete(
                Request(system=TUTOR_SYSTEM, user=user, json_mode=True, max_tokens=350)
            )
            reply = _TutorReply.model_validate(_parse_json(completion.text))
        except (LLMUnavailable, ValueError, ValidationError) as e:
            log.warning("tutor LLM answer unusable: %s", e)
            return None

        if not reply.supported:
            return TutorAnswer(NOT_COVERED, supported=False, suggestion=self._suggestion(hits))
        by_id = {h.chunk.id: h.chunk for h in hits}
        cited = [by_id[s] for s in reply.source_ids if s in by_id]
        if not cited or not reply.answer.strip():
            # An answer that can't point to an excerpt might not be grounded; don't show it.
            log.warning("tutor LLM answer cited no provided excerpt; discarded")
            return None
        return TutorAnswer(
            reply.answer.strip()[:MAX_ANSWER_CHARS],
            supported=True,
            sources=[Source(c.concept_id, c.title, c.section) for c in cited],
            method="llm",
        )

    # ------------------------------------------------------------------ hook personalization

    def personalized_hook(self, concept_id: str, question_id: str) -> tuple[str, bool]:
        """(hook, personalized). Authored question-specific hooks always win: they're reviewed."""
        concept = self.content.concepts[concept_id]
        question = self.content.questions.get(question_id)
        if question_id in concept.question_hooks:
            return concept.question_hooks[question_id], False
        if not question or not self.llm.available:
            return concept.hook, False
        user = (
            f"Learner's question: {question.question}\n"
            f"Lesson step: {concept.title}\nSummary: {concept.summary}\nHook: {concept.hook}"
        )
        try:
            completion = self.llm.complete(
                Request(system=HOOK_SYSTEM, user=user, json_mode=True, max_tokens=150)
            )
            hook = _HookReply.model_validate(_parse_json(completion.text)).hook.strip()
        except (LLMUnavailable, ValueError, ValidationError) as e:
            log.warning("hook personalization failed: %s", e)
            return concept.hook, False
        if not hook or len(hook.split()) > MAX_HOOK_WORDS:
            return concept.hook, False
        return hook, True

    # ------------------------------------------------------------------ v2 free-text routing

    def _routable(self, concept_id: str) -> bool:
        """A target is usable only if its whole path is written (no dead ends)."""
        return all(
            self.content.concepts[c].is_authored for c in learning_path(self.graph, [concept_id])
        )

    def route(self, text: str) -> RouteResult:
        ids = set(self.content.concepts)
        method: Literal["llm", "retrieval"] = "retrieval"
        status, targets, uncovered = None, [], []

        if self.llm.available:
            catalog = "\n".join(
                f"{c.id}: {c.title}. {c.summary}" for c in self.content.concepts.values()
            )
            try:
                completion = self.llm.complete(
                    Request(
                        system=ROUTE_SYSTEM,
                        user=f"Concepts:\n{catalog}\n\nLearner's question: {text}",
                        json_mode=True,
                        max_tokens=200,
                    )
                )
                reply = _RouteReply.model_validate(_parse_json(completion.text))
                # Only ids that really exist; the LLM can't invent concepts.
                status, method = reply.status, "llm"
                targets = [t for t in dict.fromkeys(reply.targets) if t in ids][:3]
                uncovered = [u.strip() for u in reply.uncovered if u.strip()][:3]
                if status != "off_topic" and not targets:
                    status = "off_topic"
            except (LLMUnavailable, ValueError, ValidationError) as e:
                log.warning("LLM routing failed, using retrieval: %s", e)
                status = None

        if status is None:
            hits = self.retriever.search(text, k=3, authored_only=False)
            best = hits[0].similarity if hits else 0.0
            if best >= ROUTE_MAPPED_SIMILARITY:
                status = "mapped"
            elif best >= ROUTE_PARTIAL_SIMILARITY:
                status = "partial"
            else:
                status = "off_topic"
            targets = [hits[0].chunk.concept_id] if status != "off_topic" else []

        # Concepts that exist in the map but aren't written yet become "not covered yet".
        ready = [t for t in targets if self._routable(t)]
        for t in targets:
            if t not in ready:
                uncovered.append(self.content.concepts[t].title)
                status = "partial"
        if status != "off_topic" and not ready:
            status = "partial"
        titles = [self.content.concepts[t].title for t in ready]
        return RouteResult(
            status, self._route_message(status, titles, uncovered), ready, titles, uncovered, method
        )

    @staticmethod
    def _route_message(status: str, titles: list[str], uncovered: list[str]) -> str:
        # Written here, not by the LLM, so what learners are told is always honest and reviewed.
        if status == "off_topic":
            return (
                "That's outside what Qurious teaches. It covers quantum computing, starting from "
                "questions like the ones above. Try one of those, or ask something about qubits, "
                "entanglement or quantum computers."
            )
        parts = []
        if titles:
            parts.append(
                f"Your question builds on: {', '.join(titles)}. The path below teaches it."
            )
        if uncovered:
            parts.append(
                f"Qurious doesn't cover {', '.join(uncovered)} yet, so that part stays open."
            )
        if not titles:
            parts.append("There's no complete path for it yet. Try one of the questions above.")
        return " ".join(parts)
