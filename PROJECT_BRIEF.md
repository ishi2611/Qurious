## 1. Who I am and why this exists

I'm a Master's student in Computer Engineering doing research in quantum machine learning. When I was learning quantum computing, I kept hitting the same wall: every course starts with "bit vs. qubit," then superposition, then linear algebra, and by the time anything interesting shows up, I'd lost motivation. Many learners start and never come back.

**Qurious flips that.** The learner starts from a question they are genuinely curious about ("Can a quantum computer steal my Bitcoin?", "Did Google prove parallel universes exist?"). The platform works out which concepts that question depends on, skips what the learner already knows, and teaches *only* the path to the answer, using short explanations, interactive visuals, and puzzles.

This is a portfolio and research project for PhD applications. It will be used in a small learning study (pre-test / post-test, completion rates), so code quality, correctness, and data collection matter as much as looks.

---

## 2. The one rule that defines this product

**Qurious is a tutor, not a chatbot.**

- The LLM **never** gives a full answer on its own. It gives a short, honest 2–3 sentence preview, then routes the learner into a learning path.
- **What gets taught is controlled by the concept map and the authored lessons**, not by the LLM. The LLM rephrases, connects content to the learner's question, and answers follow-ups **only from retrieved lesson content**.
- Every session should end with the learner having understood a concept (and passed a check), not just having read an answer.

If a feature would let a user get answers without learning anything, it doesn't belong in this project. Flag it to me instead of building it.

---

## 3. Core experience (what the learner sees)

1. **Home:** a clean landing screen with 6–8 **question cards** (curated entry questions, see §6). In v1, learners pick a card. A free-text "ask anything" box exists behind a feature flag for v2.
2. **Preview:** a short honest answer preview plus "To really understand this you need **N ideas**. Ready?"
3. **Quick check:** 1–2 diagnostic questions per prerequisite concept. Pass → skip it. Fail → teach it.
4. **The path:** a visible journey (like a subway map) from where they are to their question. The progress label reads "3 steps from your answer," never "Lesson 4 of 30."
5. **Each concept step (3–5 minutes):**
   - **Hook:** why this matters *for their question*
   - **Intuition:** a classical analogy, plus an explicit "where this analogy breaks" note
   - **Interactive:** a visual they can manipulate (Bloch sphere, probability bars, circuit)
   - **The math (optional, progressive):** collapsed by default, revealed in layers ("show me the math" → "show me more")
   - **Puzzle:** a small challenge that uses the idea
   - **Check:** 1–2 questions. Pass → next step. Fail → a different explanation, then retry.
6. **Detours:** a "wait, why?" button lets the learner branch into a prerequisite and then return to the path.
7. **The payoff:** reaching the goal unlocks a reward they *do*, not read (e.g., run a toy version of the algorithm, break a toy encryption, teleport a qubit).
8. **Classical → Quantum Translator (later milestone):** the learner builds a classical logic circuit (AND, XOR, half adder); the tool explains why it can't run directly on a quantum computer (irreversibility), converts it to a reversible version (AND → Toffoli, XOR → CNOT), simulates it, and then asks "what happens if the input is in superposition?"

---

## 4. Design direction: professional, warm, and genuinely easy to learn from

This should feel like a thoughtfully designed learning product (think the clarity of a good textbook combined with the feel of a well-made app), **not** a hackathon demo and **not** childish gamification.

- **One idea per screen.** Short paragraphs. Generous whitespace. No walls of text.
- **Show, then tell.** Every concept leads with something visual or interactive.
- **Honest analogies.** Never say "a qubit is 0 and 1 at the same time" without clarifying what that actually means. Always include where each analogy fails.
- **Math is welcome but never forced.** Use KaTeX for rendering. Every equation needs a plain-English line under it.
- **Immediate feedback.** Visuals update live as the learner changes gates or parameters.
- **Motivation through progress, not points.** Distance-to-goal, a satisfying completion moment, and a visible map. Avoid streak pressure and badges for their own sake.
- **Visual style:** calm, modern, and consistent. Use one accent color with semantic colors (e.g., one hue for |0⟩ and one for |1⟩, used consistently everywhere), a clean sans-serif for text and a monospace for code and kets. Support light and dark mode.
- **Accessible:** WCAG AA contrast, keyboard navigable, never use color alone to carry meaning, and provide alt text for visuals.
- **Responsive:** works well on a phone. Students will open it on their phones.

Before building the UI, propose a small design system (colors, type scale, spacing, core components) and show it to me.

---

## 5. Tech stack

Use these unless you have a strong reason not to. If you want to change something, explain why and ask first.

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | Strict TypeScript |
| Animation | Framer Motion | Subtle, purposeful motion only |
| Bloch sphere / 3D | Three.js via react-three-fiber | |
| Concept map / path view | React Flow | |
| Circuit builder | dnd-kit | Drag-and-drop gates |
| Math rendering | KaTeX | |
| In-browser simulator | **Custom TypeScript state-vector simulator** (≤ 5 qubits) | Written by us. Instant, no server round trip. |
| Backend | Python 3.11+ with FastAPI | |
| Quantum (backend) | Qiskit + qiskit-aer; qiskit-ibm-runtime (optional) | Validates our simulator; optional "run on real hardware" |
| Concept graph | YAML files in the repo + NetworkX | Content is version-controlled |
| Retrieval | sentence-transformers (local) + ChromaDB | No paid embedding API |
| LLM | Provider-agnostic wrapper: **Groq** (primary) and **Gemini** (fallback) | Model names from env vars. Check current model names in each provider's docs; don't hardcode from memory. |
| Database + auth | Supabase (Postgres + Auth) | Progress and study data |
| Testing | Vitest (frontend), pytest (backend), Playwright (a few end-to-end flows) | |
| Deployment | Vercel (frontend), Render or Hugging Face Spaces (backend) | Later milestone |

**Secrets:** all keys go in `.env` files (with a committed `.env.example`). Never commit keys. Required:
```
GROQ_API_KEY=
GEMINI_API_KEY=
LLM_PRIMARY_MODEL=
LLM_FALLBACK_MODEL=
IBM_QUANTUM_TOKEN=        # optional
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

**LLM rate limits:** free tiers are limited. Implement exponential backoff on HTTP 429, automatic fallback to the secondary provider, and cache identical requests.

---

## 6. Content: where the concepts come from

### 6a. Course lecture slides (concept source)

**Lecture slides:** `[PLACEHOLDER — Google Drive folder link: ___________________ ]`

- If you can't access the link directly, stop and ask me. I'll download the PDFs into `reference/slides/`.
- **`reference/` must be in `.gitignore`.** The slides are my professor's material and must never be committed, published, or quoted in the app.
- Use the slides **only to extract**: (a) the list of concepts a real course treats as essential, (b) the order and dependencies between them, and (c) notation conventions. Produce `reference/slide_concepts.md` summarizing this, and show it to me.
- **All lesson text in the app must be original writing**, not copied or closely paraphrased from the slides.

### 6b. Curated entry questions (v1)

Based on research into what the public most asks about quantum computing:

1. Can quantum computers break my passwords or Bitcoin?
2. Did Google prove that parallel universes exist?
3. Why are quantum computers supposed to be so fast?
4. Is quantum computing real, or just hype?
5. Why do quantum computers need to be so cold?
6. Is entanglement faster than light?
7. Is quantum teleportation real teleportation?
8. What will quantum computers actually be useful for?

### 6c. Concept map: starting scope

Aim for **25–30 concept nodes** total that together can answer all entry questions. Expected core nodes include: classical bit, probability basics, complex numbers (light), vectors & state notation, qubit, superposition, measurement, Bloch sphere, X/Z/H gates, phase, interference, multiple qubits & tensor product, CNOT, entanglement, Bell states, no-cloning, no-signaling, reversible computation, decoherence & noise, error correction (intuition), physical qubits, Deutsch–Jozsa (intuition), Grover's search, QFT & period finding (intuition), Shor's algorithm (intuition), RSA/ECC basics, post-quantum cryptography, quantum teleportation, interpretations of QM (brief).

Cross-check this list against `reference/slide_concepts.md` and propose a final list to me before writing lessons.

### 6d. Concept node schema

Each concept is one YAML file in `content/concepts/`. Propose refinements, but start from:

```yaml
id: superposition
title: Superposition
summary: A qubit can be in a weighted combination of 0 and 1 until it's measured.
prerequisites: [qubit, probability_basics]
estimated_minutes: 4
hook: >
  Short text explaining why this matters. Personalized at runtime to the learner's question.
intuition:
  analogy: ...
  where_it_breaks: ...
interactive: bloch_sphere        # which interactive component to show
math:
  - level: 1
    latex: '|\psi\rangle = \alpha|0\rangle + \beta|1\rangle'
    plain_english: ...
  - level: 2
    latex: '|\alpha|^2 + |\beta|^2 = 1'
    plain_english: ...
puzzle:
  type: circuit_goal
  prompt: Make the qubit land on 1 exactly half the time.
  target: { probabilities: { "0": 0.5, "1": 0.5 } }
  allowed_gates: [H, X]
checks:
  - question: ...
    options: [...]
    answer: 1
    explanation: ...
    misconception_addressed: ...   # the wrong idea this question catches
alt_explanation: A second, different explanation shown if the learner fails a check.
common_misconceptions: [...]
```

Entry questions live in `content/questions/` and point to one or more target concept ids plus a reward activity.

### 6e. Accuracy review

I am the content owner. **Draft lessons, but mark every lesson `status: draft` until I review it.** Physics accuracy is non-negotiable. Where you're unsure, say so in a comment rather than guessing. Add a validation script that checks every node: prerequisites exist, no cycles, every check has an explanation, and math blocks render.

---

## 7. How the system works (architecture)

```
Learner picks a question card (v1)  /  types a question (v2, feature flag)
        │
        ▼
[Question → Concepts]  v1: lookup from content/questions/
                       v2: LLM classifies into existing concept ids ONLY
                           (structured JSON output, validated against the id list)
        │
        ▼
[Path Engine]  NetworkX: collect all prerequisites of the targets,
               topological sort, remove concepts already mastered
        │
        ▼
[Diagnostic]   1–2 check questions per concept → skip what they already know
        │
        ▼
[Lesson Player]  hook → intuition → interactive → math → puzzle → check
        │           ▲
        │           └── "wait, why?" detours
        ▼
[Tutor Layer]  follow-up questions answered ONLY from retrieved lesson content
               (ChromaDB over content/). If unsupported: say so and point to a concept.
        │
        ▼
[Goal reward] + progress saved + study events logged
```

**Handling v2 free-text questions:**
- **Maps cleanly:** build the path.
- **Partly covered:** teach the nearest path, and say honestly what isn't covered yet.
- **Off-topic:** brief friendly reply, then suggest a real path.
- **Always log the raw question and the mapping result** (table `question_log`). Unmapped questions guide which concepts to add next.

---

## 8. Milestones

Build in this order. **At the end of each milestone: run tests, summarize what you built, list anything uncertain, and stop for my review.**

**M0 — Setup**
Monorepo (`/web`, `/api`, `/content`, `/reference` (gitignored), `/docs`). Linting, formatting, `.env.example`, a README with setup steps, and a `CLAUDE.md` capturing the key rules from this brief (tutor-not-chatbot, content ownership, slide rules).
*Done when:* both apps run locally with a hello-world page and a `/health` endpoint.

**M1 — Quantum simulator**
TypeScript state-vector simulator: gates X, Y, Z, H, S, T, RX/RY/RZ, CNOT, CZ, SWAP, Toffoli; measurement sampling; Bloch vector for single qubits.
*Done when:* unit tests pass, plus a script that runs ~50 random circuits through both our simulator and Qiskit-Aer and confirms matching probabilities.

**M2 — Content pipeline and path engine**
Extract concepts from the slides (§6a), finalize the concept list with me, write the YAML schema and validator, write 2 concept nodes as examples, and build the path engine API (`POST /path` with targets and known concepts → ordered path).
*Done when:* the validator passes, path tests pass (including cycle detection), and I've approved the concept list.

**M3 — Design system and lesson player**
Design system (show it to me first), then the lesson player for one full concept (qubit → superposition) including the Bloch sphere interactive and KaTeX math layers.
*Done when:* one concept is fully playable and looks polished on desktop and phone.

**M4 — Puzzles**
Drag-and-drop circuit builder with a live probability display and a puzzle checker.
*Done when:* 3 working puzzles exist, with helpful feedback on wrong attempts.

**M5 — End-to-end journeys**
Home with question cards, preview screen, diagnostic, path map view, detours, goal reward. Author the full content for **2 entry questions** end to end.
*Done when:* a new user can go from a card to the reward for both questions without hitting dead ends.

**M6 — Tutor layer**
LLM wrapper (Groq + Gemini fallback, backoff, caching), retrieval over lesson content, question personalization of hooks, follow-up Q&A, and the v2 free-text router behind a feature flag. Add tests showing the tutor refuses to answer beyond retrieved content.
*Done when:* follow-ups are grounded, and unsupported questions get an honest "not covered yet" response.

**M7 — Classical → Quantum Translator**
Covers AND, OR, XOR, NOT, and a half adder, as described in §3.
*Done when:* each converted circuit is simulated and shown to match its classical truth table.

**M8 — Accounts, progress, and study instrumentation**
Supabase auth (anonymous-first, with optional account), progress tracking, and a study mode with consent screen, pre-test, post-test, and event logging (concept started/completed, check attempts, time on step, detours, drop-off point). Include a CSV export for analysis. Store no personal data beyond what's needed; research IDs must be pseudonymous.
*Done when:* a full study session can be run and exported.

**M9 — Polish and deploy**
Accessibility audit, performance, empty and error states, Playwright tests for the main flows, deployment, and an optional "run on real IBM hardware" button with a queue-status UI.
*Done when:* deployed, all tests green, and the README includes screenshots.

---

## 9. Engineering standards

- **Small, reviewable steps.** Commit after each meaningful change with clear messages.
- **Tests for all logic:** simulator, path engine, validators, puzzle checker, and LLM routing (with mocked providers).
- **Readable over clever.** This code is part of my portfolio; a reviewer should understand it quickly. Add brief docstrings and comments explaining *why*, not *what*.
- **Document decisions** in `docs/decisions.md` (a short entry per significant choice).
- **Don't invent** APIs, model names, or library features. Check the docs. If unsure, ask me.
- **Ask before:** adding new paid services, changing the stack, deleting content, or making any change to study data collection.

---

## 10. Out of scope (for now)

Social features, leaderboards, streaks, a general-purpose chatbot mode, content beyond the concept map, native mobile apps, and payments.

---

## 11. First task

Read this whole brief. Then, in plan mode:
1. Summarize your understanding in 5–7 bullets, including the tutor-not-chatbot rule.
2. List any questions or ambiguities.
3. Propose the plan for **Milestone 0 only**.

Wait for my approval before writing any code.
