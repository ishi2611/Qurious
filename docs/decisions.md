# Decisions

One short entry per significant choice: what we decided, and why. Newest at the bottom.

---

### 2026-09-24 · Monorepo with separate `web/` and `api/`
One repository holds the Next.js app, the FastAPI backend, the YAML content and the docs. The content is shared by both sides: the web app renders lessons, and the API builds paths and retrieval from them. Keeping everything in one repo means one commit can change a lesson and its code together. No monorepo tool (Turborepo, Nx) is used: there are only two apps in different languages, so plain folders are simpler.

### 2026-09-24 · Next.js 16 with the App Router
Next.js 16.3 is the current release (`create-next-app@latest`). The project uses the App Router, a `src/` directory, strict TypeScript and Tailwind CSS v4. Next 16 ships its docs in `node_modules/next/dist/docs/` (see `web/AGENTS.md`), and we check them instead of relying on older Next.js knowledge.

### 2026-09-24 · npm, not pnpm
npm was already installed, and the web app is a single package. pnpm's advantages (workspaces, disk space) don't matter at this size.

### 2026-09-24 · Python 3.12 in a dedicated conda env (`qurious`)
The brief asks for Python 3.11+. The system Python is 3.14, which Qiskit, torch (pulled in by sentence-transformers) and ChromaDB may not fully support yet. 3.12 is well supported by all of them. A dedicated env keeps this project's packages separate from other research environments.

### 2026-09-24 · Ruff for Python linting and formatting; ESLint + Prettier for the web app
Ruff replaces flake8, isort and black with a single fast tool. On the web side, Prettier handles formatting (with the Tailwind class-sorting plugin), `eslint-config-prettier` stops ESLint and Prettier from disagreeing, and `eslint-config-next` covers React and Next.js rules.

### 2026-09-24 · Vitest with jsdom 26 (for now)
We follow the Next.js docs' Vitest setup. The newest jsdom (27) depends on a package that needs Node 20.19+ (for `require()` of ES modules), and the dev machine has Node 20.17, so jsdom is pinned to 26. **To do:** upgrade Node to the current LTS (Node 20 reached end-of-life in April 2026), then unpin jsdom.

### 2026-09-24 · `httpx2` for FastAPI's TestClient
Starlette 1.x deprecates `httpx` in its test client in favor of `httpx2`, maintained by the Pydantic team. We use `httpx2` to avoid the deprecation warning.

### 2026-09-24 · Backend settings via pydantic-settings, all optional in M0
The API reads the repo-root `.env` with `pydantic-settings`. All keys default to empty, so the API starts without any accounts. Each later feature validates the keys it needs when it's used, instead of blocking startup.

### 2026-09-24 · Simulator: big-endian qubit order, immutable states, Qiskit rotation convention
The TypeScript simulator (`web/src/lib/quantum/`) orders qubits big-endian (q0 is the leftmost bit of |q0 q1 …⟩) because that's how the course material and most textbooks write states. Learners will read kets on screen, so they must match. Qiskit is little-endian, and the cross-check script reverses bits before comparing. Rotations use R_P(θ) = exp(−iθP/2), the same as Qiskit, so amplitudes (not just probabilities) can be compared. Every controlled gate (CNOT, CZ, Toffoli) goes through one "apply a 2×2 matrix only where all controls are 1" routine, so there's one well-tested path instead of one per gate. Operations return new arrays rather than mutating, which keeps React state updates simple.

### 2026-09-24 · Cross-checking against Qiskit-Aer compares full amplitudes
`scripts/sim-crosscheck.sh` runs random circuits (every gate, 1–5 qubits) through both simulators and compares amplitudes, which also checks phases, not only probabilities. The Aer run uses `transpile(..., optimization_level=0)`: at higher levels Qiskit may remove SWAP gates and record them as a qubit relabeling, which permutes the saved statevector. That made 22 of the first 50 circuits look wrong even though the simulator was correct. `api/tests/test_crosscheck.py` guards against this regression.

### 2026-09-24 · Content schema: stubs vs. authored lessons, separate diagnostic questions
Concepts have `status: stub | draft | reviewed`. A stub is only a node in the map, so the path engine and the v2 question router can use all 31 concepts before every lesson is written. Authored lessons must have every section. The validator refuses to enable a question whose path passes through a stub, so learners can't reach a dead end. Diagnostic questions (the quick check before a path) are separate from the lesson's own checks, so a learner never sees the same question twice. `question_hooks` lets a lesson carry a hand-written hook per entry question, which works without any LLM and is the fallback when personalization is unavailable. `reviewer_notes` holds the author's uncertainties for the content owner, since YAML comments aren't machine-visible.

### 2026-09-24 · Puzzles are proven solvable, and can require specific gates
The validator runs a breadth-first search over each circuit puzzle's allowed gates (states deduplicated up to global phase) and fails if no solution exists. This caught a real bug: the CNOT puzzle could be solved with two X gates and no CNOT. `required_gates` now makes a puzzle count only if it uses the gate it's teaching. The small NumPy simulator used for this is tested against Qiskit.

### 2026-09-24 · Path engine prunes prerequisites that only known concepts need
`learning_path` walks down from the targets but stops at concepts the learner already knows, so knowing "entanglement" skips everything that only entanglement needed, while prerequisites still needed elsewhere stay. Ties in the topological order are broken by depth in the full map, then by id, so identical inputs always give identical paths (important for a study).

### 2026-09-24 · The API refuses to start with invalid content
`GET /concepts`, `GET /questions` and `POST /path` load and validate the content once per process. If validation fails, the endpoints raise instead of serving a broken map.

### 2026-09-24 · Math is validated with KaTeX itself
Math rendering is checked by rendering every block with KaTeX in strict mode (`npm run content:math`), the same library the lesson player uses, rather than approximating it in Python. `scripts/validate-content.sh` runs both halves of the validator.

### 2026-09-24 · Design system: warm neutrals, one indigo accent, cyan/amber for |0⟩/|1⟩, light by default
The full proposal is in `docs/design-system.md`, and a live version is at `/design` (pending the owner's approval). Every text color pair was checked with the WCAG contrast formula (lowest 4.77:1). |1⟩ bars are hatched as well as amber, so 0/1 never relies on color alone. The theme is applied by an inline `<head>` script before first paint (the pattern from the bundled Next.js guide), defaulting to **light**, with Dark and System one click away.

### 2026-09-24 · Library versions: `motion`, `@xyflow/react`, `@dnd-kit/core`
Framer Motion is now published as `motion` (import from `motion/react`); React Flow as `@xyflow/react` (v12). For drag-and-drop we use the stable `@dnd-kit/core` 6.x, not the pre-1.0 `@dnd-kit/react`. The circuit builder also supports tap-a-gate-then-tap-a-wire, which works with keyboard and touch without dragging.

### 2026-09-24 · Bloch-sphere labels are projected DOM spans, not drei `<Html>`
drei's `<Html>` re-creates its React root when the canvas container mounts, but doesn't re-render into the new root, so the first label (|0⟩) came out empty. The labels are now plain spans positioned every frame by projecting their 3D points through the camera: simpler, and they can't go missing.

### 2026-09-24 · The web app reads content YAML directly; paths come from the API
Lesson pages are statically generated from `content/` at build time (fast, and they work even if the API is asleep). The ordered path always comes from the Python path engine (`POST /path`, by target concepts), as the brief specifies. The preview screen says "waking up the server" after 3 seconds, because free hosting sleeps.

### 2026-09-24 · Adaptive quick check
The diagnostic asks about the path's concepts closest to the goal first, never asks about anything under a concept the learner just passed, and stops after 6 questions. The known concepts are then sent to the path engine, which prunes what only they needed. Learners can skip the check entirely ("I'm new to this").

### 2026-09-24 · Entanglement physics lives in tested modules
`lib/bell.ts` and `lib/teleport.ts` hold the Bell-lab and teleportation logic outside the UI, so it is unit-tested: no-signaling holds exactly (Bob's P(1) = 1/2 for every Bell state and every choice Alice makes), and Bob recovers the state for all four measurement outcomes across several input states.

### 2026-09-24 · End-to-end tests run on separate ports
Playwright runs a production build on 3100 (web) and 8100 (API), so tests never interfere with a developer's `npm run dev` / `uvicorn` on 3000 / 8000. The two journey tests answer every check from the YAML answer key and must reach the reward with no page errors, on both a desktop and a phone viewport.
