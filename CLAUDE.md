# Qurious: rules for working in this repo

Full spec: `PROJECT_BRIEF.md`. These are the rules that must never be broken.

## 1. Tutor, not chatbot
- The LLM never gives a full answer. At most a 2–3 sentence honest preview, then it routes the learner into a learning path.
- What gets taught comes from `content/` (the concept map + authored lessons), not from the LLM. The LLM may rephrase, connect content to the learner's question, and answer follow-ups **only from retrieved lesson content**. If the content doesn't support an answer, say "not covered yet" and point to a concept.
- In v2, free-text questions are classified into **existing concept ids only** (validated JSON). Always log the raw question and the mapping result.
- A feature that lets someone get answers without learning doesn't get built. Flag it to the owner instead.

## 2. Content ownership and accuracy
- The repo owner is the content owner. Every lesson I draft is `status: draft` until the owner reviews it.
- Physics accuracy is non-negotiable. When unsure, leave a comment in the YAML saying so. Never guess.
- Every analogy needs a `where_it_breaks` note. Every equation needs a plain-English line.
- Never say "a qubit is 0 and 1 at the same time" without explaining what that actually means.

## 3. Course slides
- The slides live in `reference/slides/`, and all of `reference/` is **gitignored**. They're the professor's material: never commit, publish or quote them in the app.
- Use them only to extract the list of essential concepts, their order and dependencies, and notation conventions, into `reference/slide_concepts.md`.
- All lesson text is original writing, not copied or closely paraphrased.

## 4. Ask before
- Adding paid services, changing the stack, deleting content, or **any** change to study data collection.
- Don't invent APIs, model names or library features. Check the docs first (for Next.js, `web/AGENTS.md` points to the bundled docs). LLM model names come from env vars.

## 5. Git
- Small, reviewable commits with clear messages, authored by the owner only. **No `Co-Authored-By` or any AI attribution lines.**
- **Never push.** The owner reviews and pushes.
- Never commit `.env` files or anything in `reference/`.

## 6. Process
- Build milestones in order (brief §8). At the end of each one: run all checks, summarize, list uncertainties, then **stop for review**.
- Record each significant decision in `docs/decisions.md`.
- Tests for all logic: simulator, path engine, validators, puzzle checker, LLM routing (mocked providers).
- Readable over clever. Add short docstrings and comments that explain *why*.

## Commands
```bash
# web (Next.js, in web/)
npm run dev | lint | typecheck | test | format | build
# api (FastAPI, in api/, conda env "qurious")
uvicorn app.main:app --reload --port 8000
ruff check . && ruff format --check . && pytest
```
