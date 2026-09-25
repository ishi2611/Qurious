import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { parse } from "yaml";
import type { Concept, Question } from "./types";

/**
 * Reads /content at build or request time on the server. The content is validated by the
 * Python validator (scripts/validate-content.sh) before it is committed; here we only fill in
 * defaults so optional fields are always present.
 */
const CONTENT_DIR = path.resolve(process.cwd(), "..", "content");

function readFolder<T>(folder: string): T[] {
  const dir = path.join(CONTENT_DIR, folder);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => parse(readFileSync(path.join(dir, f), "utf8")) as T);
}

function withConceptDefaults(raw: Partial<Concept>): Concept {
  return {
    prerequisites: [],
    hook: "",
    question_hooks: {},
    math: [],
    checks: [],
    diagnostic: [],
    alt_explanation: "",
    common_misconceptions: [],
    ...raw,
    intuition: raw.intuition ?? null,
    interactive: raw.interactive
      ? {
          type: raw.interactive.type,
          props: raw.interactive.props ?? {},
          caption: raw.interactive.caption ?? "",
        }
      : null,
    puzzle: raw.puzzle
      ? { ...raw.puzzle, hints: raw.puzzle.hints ?? [] }
      : null,
  } as Concept;
}

export const getConcepts = cache((): Record<string, Concept> => {
  const concepts =
    readFolder<Partial<Concept>>("concepts").map(withConceptDefaults);
  return Object.fromEntries(concepts.map((c) => [c.id, c]));
});

export const getConcept = (id: string): Concept | undefined =>
  getConcepts()[id];

export const getQuestions = cache((): Question[] =>
  readFolder<Question>("questions")
    .map((q) => ({ ...q, enabled: q.enabled ?? false, order: q.order ?? 0 }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
);

export const getQuestion = (id: string): Question | undefined =>
  getQuestions().find((q) => q.id === id);
