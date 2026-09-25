# Writing and reviewing lessons

All lesson content is YAML in `content/`. The authoritative schema is `api/app/content/schema.py`, and `./scripts/validate-content.sh` checks everything.

## The rules
- **Tutor, not chatbot.** A lesson teaches one idea. Question previews stay at 2–3 sentences and never give the full answer.
- **Honest analogies.** Every `intuition` has a `where_it_breaks`.
- **Math is optional.** Every math block has a `plain_english` line. Levels are revealed one at a time.
- **Accuracy first.** Put anything you're unsure about in `reviewer_notes`. They're never shown to learners.
- **Original writing only.** Never copy or closely paraphrase course slides.

## Status
| Status | Meaning |
| --- | --- |
| `stub` | In the concept map (paths and routing work) but no lesson yet |
| `draft` | Full lesson, awaiting the content owner's review. Learners see a "Draft lesson" badge. |
| `reviewed` | Approved by the content owner |

A question can only be `enabled: true` if every concept on its path is written (not a stub). The validator enforces this, so learners never hit a dead end.

## A concept file, section by section
| Field | Notes |
| --- | --- |
| `hook` | Why this matters. `question_hooks` can override it for specific questions, and hand-written overrides always beat LLM personalization. |
| `intuition` | `analogy` + `where_it_breaks` |
| `interactive` | `type` (one of the components in `web/src/components/interactives/`) and its `props` |
| `math` | Layers of `{level, latex, plain_english}`, ordered by level |
| `puzzle` | `circuit_goal` (target probabilities, optional `target_amplitudes` for phase, `allowed_gates`, `required_gates`, `max_gates`, `hints`) or `numeric` (`answer`, `tolerance`) |
| `checks` | 1–3 multiple-choice questions, each with an `explanation` and ideally the `misconception_addressed` |
| `diagnostic` | 1–2 *different* questions, used by the quick check before a path |
| `alt_explanation` | Shown after a wrong answer, before the retry. It should explain the idea differently. |

## What the validator checks
- Schema: required sections, answer indexes, unknown keys (typos fail loudly).
- Graph: prerequisites exist, and there are no cycles.
- Dead ends: enabled questions route only through written lessons.
- Puzzles: each `circuit_goal` is **solvable** with its allowed gates, found by a breadth-first search that respects `required_gates`.
- Math: every block renders with KaTeX, the same library the app uses.
- Study test: items point to real concepts and never repeat a lesson or quick-check question.

## Reviewing a lesson
1. Open it at `/learn/<concept_id>` and play it through, including a wrong answer.
2. Read its `reviewer_notes` and resolve each one.
3. Change `status: draft` to `status: reviewed`, then run `./scripts/validate-content.sh`.

`api/tests/test_content.py::test_every_real_lesson_is_still_a_draft` will then fail on purpose. That makes the review visible in the commit: update or delete that test in the same commit.
