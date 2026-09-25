# Qurious

**Learn quantum computing by starting from the question you're curious about.**

Most quantum computing courses start with "bit vs. qubit" and build up slowly, and many learners give up before reaching anything interesting. Qurious works the other way around. You pick a question, such as *"Can a quantum computer break my Bitcoin?"* The app works out which ideas that question depends on, skips the ones you already know, and teaches only the path to the answer, using short explanations, interactive visuals and puzzles.

Qurious is a **tutor, not a chatbot**. What gets taught comes from a reviewed concept map and authored lessons. The language model only personalizes the content and answers follow-ups from it.

> Status: **Milestone 0 (setup)**. The apps run with a placeholder page and a health check.

## Repository layout

```
Qurious/
├── web/         Next.js (App Router) + TypeScript + Tailwind: the learner-facing app
├── api/         FastAPI (Python): path engine, content, tutor layer, study data
├── content/     Concept map and entry questions as YAML (version-controlled)
├── docs/        Design decisions (docs/decisions.md)
└── reference/   Private course material. Gitignored, never committed
```

## Prerequisites

- **Node.js 20.9+** (22 LTS or newer is recommended)
- **Conda** (or any Python **3.11+** environment; 3.12 is what we use)

## Setup

### 1. Environment variables
```bash
cp .env.example .env              # backend keys; all optional for now
cp web/.env.example web/.env.local  # only if the API isn't on localhost:8000
```

### 2. API (http://localhost:8000)
```bash
conda create -n qurious python=3.12
conda activate qurious
cd api
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```
Check it: `curl localhost:8000/health` should return `{"status":"ok","version":"0.1.0"}`.

### 3. Web app (http://localhost:3000)
```bash
cd web
npm install
npm run dev
```
The home page shows **API: Connected** when the backend is running.

## Checks

| | Command (run inside the folder) |
| --- | --- |
| **web** | `npm run lint && npm run typecheck && npm test && npm run format:check && npm run build` |
| **api** | `ruff check . && ruff format --check . && pytest` |

## Tech stack

Next.js · TypeScript · Tailwind CSS · Framer Motion · react-three-fiber · React Flow · dnd-kit · KaTeX · a custom TypeScript state-vector simulator · FastAPI · Qiskit / Aer · NetworkX · sentence-transformers + ChromaDB · Groq (Gemini fallback) · Supabase

Libraries beyond M0 are added in the milestone that needs them. See `docs/decisions.md` for the reasoning behind each choice.
