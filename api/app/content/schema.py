"""Schema for concepts (content/concepts/*.yaml) and entry questions (content/questions/*.yaml).

Pydantic enforces the *shape* of each file. Checks that need the whole map (prerequisites exist,
no cycles, questions point at real concepts) live in `app.content.validate`.

A concept is either a `stub` (in the map so paths and routing work, but no lesson yet) or an
authored lesson (`draft` until the content owner reviews it, then `reviewed`). Stubs only need
the map fields; authored lessons must have every lesson section.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Keep in sync with the interactive components in web/src/components/interactives/.
InteractiveType = Literal[
    "bit_switches",
    "coin_sampler",
    "amplitude_bars",
    "bloch_sphere",
    "measurement_lab",
    "circuit_sandbox",
    "bell_lab",
    "cloning_attempt",
    "teleport_lab",
]

RewardType = Literal["bell_signal_game", "teleport_lab", "coming_soon"]

GateId = Literal["X", "Y", "Z", "H", "S", "T", "CNOT", "CZ", "SWAP", "TOFFOLI"]

Id = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]*$")]
Text = Annotated[str, Field(min_length=1)]


class Strict(BaseModel):
    # Typos in YAML keys should fail loudly, not be silently ignored.
    model_config = ConfigDict(extra="forbid")


class Intuition(Strict):
    analogy: Text
    where_it_breaks: Text


class MathBlock(Strict):
    level: Annotated[int, Field(ge=1, le=3)]
    latex: Text
    plain_english: Text


class Interactive(Strict):
    type: InteractiveType
    # Component-specific settings, e.g. which gates a sandbox offers. Checked by the web app.
    props: dict = Field(default_factory=dict)
    caption: str = ""


class Check(Strict):
    question: Text
    options: Annotated[list[Text], Field(min_length=2, max_length=5)]
    answer: Annotated[int, Field(ge=0)]  # index into options
    explanation: Text
    misconception_addressed: str = ""

    @model_validator(mode="after")
    def answer_in_range(self) -> Check:
        if self.answer >= len(self.options):
            raise ValueError(
                f"answer {self.answer} is out of range for {len(self.options)} options"
            )
        if len(set(self.options)) != len(self.options):
            raise ValueError("options must be distinct")
        return self


class CircuitGoalPuzzle(Strict):
    type: Literal["circuit_goal"]
    prompt: Text
    num_qubits: Annotated[int, Field(ge=1, le=5)] = 1
    allowed_gates: Annotated[list[GateId], Field(min_length=1)]
    # Probabilities of basis states, big-endian labels ("01" means q0=0, q1=1). Missing labels = 0.
    target_probabilities: dict[str, float]
    # Optional stricter goal: amplitudes [re, im] per label, compared up to global phase.
    # Needed when states share probabilities but differ in phase (e.g. |+⟩ vs |−⟩).
    target_amplitudes: dict[str, tuple[float, float]] | None = None
    max_gates: Annotated[int, Field(ge=1)] | None = None
    # Gates the solution must use at least once, so a puzzle about CNOT can't be solved without it.
    required_gates: list[GateId] = Field(default_factory=list)
    hints: list[Text] = Field(default_factory=list)

    @model_validator(mode="after")
    def targets_are_consistent(self) -> CircuitGoalPuzzle:
        if set(self.required_gates) - set(self.allowed_gates):
            raise ValueError("required_gates must also be in allowed_gates")
        labels = list(self.target_probabilities) + list(self.target_amplitudes or {})
        for label in labels:
            if len(label) != self.num_qubits or set(label) - {"0", "1"}:
                raise ValueError(f"basis label '{label}' doesn't fit {self.num_qubits} qubit(s)")
        total = sum(self.target_probabilities.values())
        if abs(total - 1) > 1e-6:
            raise ValueError(f"target probabilities sum to {total}, not 1")
        return self


class NumericPuzzle(Strict):
    type: Literal["numeric"]
    prompt: Text
    answer: float
    tolerance: Annotated[float, Field(ge=0)] = 0.01
    hints: list[Text] = Field(default_factory=list)


Puzzle = Annotated[CircuitGoalPuzzle | NumericPuzzle, Field(discriminator="type")]


class Concept(Strict):
    id: Id
    title: Text
    summary: Text
    status: Literal["stub", "draft", "reviewed"]
    prerequisites: list[Id] = Field(default_factory=list)
    estimated_minutes: Annotated[int, Field(ge=1, le=15)]
    # Where this concept came from in the reference course (topic name only, never slide text).
    course_topic: str = ""

    hook: str = ""
    # Optional hand-written hooks for specific entry questions (question id → text). Used before
    # (and as a fallback for) LLM personalization, so the tutor works without any API key.
    question_hooks: dict[Id, Text] = Field(default_factory=dict)
    intuition: Intuition | None = None
    interactive: Interactive | None = None
    math: list[MathBlock] = Field(default_factory=list)
    puzzle: Puzzle | None = None
    checks: list[Check] = Field(default_factory=list)
    # Separate from `checks` so the quick check before a path never repeats the lesson's questions.
    diagnostic: list[Check] = Field(default_factory=list)
    alt_explanation: str = ""
    common_misconceptions: list[str] = Field(default_factory=list)
    # Anything the author is unsure about, for the content owner's review. Never shown to learners.
    reviewer_notes: list[str] = Field(default_factory=list)

    @field_validator("prerequisites")
    @classmethod
    def no_duplicate_prerequisites(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("prerequisites contain duplicates")
        return value

    @model_validator(mode="after")
    def authored_lessons_are_complete(self) -> Concept:
        if self.id in self.prerequisites:
            raise ValueError("a concept can't be its own prerequisite")
        if self.status == "stub":
            return self
        missing = [
            name
            for name, present in [
                ("hook", bool(self.hook.strip())),
                ("intuition", self.intuition is not None),
                ("interactive", self.interactive is not None),
                ("checks", len(self.checks) >= 1),
                ("diagnostic", len(self.diagnostic) >= 1),
                ("alt_explanation", bool(self.alt_explanation.strip())),
            ]
            if not present
        ]
        if missing:
            raise ValueError(f"{self.status} lessons need: {', '.join(missing)}")
        if len(self.checks) > 3 or len(self.diagnostic) > 2:
            raise ValueError("use 1–3 checks and 1–2 diagnostic questions")
        levels = [m.level for m in self.math]
        if levels != sorted(levels):
            raise ValueError("math blocks must be ordered by level")
        return self

    @property
    def is_authored(self) -> bool:
        return self.status != "stub"


class Reward(Strict):
    type: RewardType
    title: Text
    description: Text


class Question(Strict):
    id: Id
    question: Text
    status: Literal["draft", "reviewed"]
    # v1 shows only enabled questions as cards; disabled ones are "coming soon".
    enabled: bool = False
    order: int = 0
    # The honest 2–3 sentence preview shown before the path. Never the full answer.
    preview: Text
    targets: Annotated[list[Id], Field(min_length=1)]
    reward: Reward
    reviewer_notes: list[str] = Field(default_factory=list)

    @field_validator("preview")
    @classmethod
    def preview_is_short(cls, value: str) -> str:
        # Tutor, not chatbot: the preview must not turn into the full answer.
        if len(value.split()) > 80:
            raise ValueError("preview is longer than 80 words; keep it to 2–3 sentences")
        return value
