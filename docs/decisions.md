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
