/**
 * A learner's journey from a question card to its reward: pure helpers plus local persistence.
 * The ordered path itself comes from the API's path engine (POST /path).
 */

export type Phase = "preview" | "diagnostic" | "map" | "lesson" | "reward";

export interface JourneyState {
  version: 1;
  questionId: string;
  phase: Phase;
  /** Ordered concept ids from the path engine (after the diagnostic). */
  path: string[];
  completed: string[];
  /** Concepts the learner showed they know in the quick check. */
  known: string[];
  /** Concepts currently being visited as detours, innermost last. */
  detours: string[];
  startedAt: string;
}

export const newJourney = (questionId: string): JourneyState => ({
  version: 1,
  questionId,
  phase: "preview",
  path: [],
  completed: [],
  known: [],
  detours: [],
  startedAt: new Date().toISOString(),
});

export const currentConcept = (j: JourneyState): string | undefined =>
  j.detours.length
    ? j.detours[j.detours.length - 1]
    : j.path.find((c) => !j.completed.includes(c));

/** Concepts left after the current one, for "N steps from your answer". */
export const stepsAfterCurrent = (j: JourneyState): number =>
  Math.max(0, j.path.filter((c) => !j.completed.includes(c)).length - 1);

/** Mark the current concept done: pops a detour, or advances along the path. */
export function completeCurrent(j: JourneyState): JourneyState {
  if (j.detours.length) return { ...j, detours: j.detours.slice(0, -1) };
  const current = currentConcept(j);
  if (!current) return j;
  const completed = [...j.completed, current];
  const done = j.path.every((c) => completed.includes(c));
  return { ...j, completed, phase: done ? "reward" : "map" };
}

export const startDetour = (
  j: JourneyState,
  conceptId: string,
): JourneyState => ({
  ...j,
  detours: [...j.detours, conceptId],
});

// ---------------------------------------------------------------------------------------
// Diagnostic planning
// ---------------------------------------------------------------------------------------

export type PrereqMap = Record<string, string[]>;

/** Every concept that `id` depends on, directly or indirectly. */
export function ancestors(id: string, prereqs: PrereqMap): Set<string> {
  const seen = new Set<string>();
  const stack = [...(prereqs[id] ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...(prereqs[next] ?? []));
  }
  return seen;
}

export const MAX_DIAGNOSTIC_QUESTIONS = 6;

/**
 * The next concept to ask a quick-check question about, or null when done.
 *
 * Candidates are the path's non-target concepts, closest to the goal first. Once a learner
 * passes a concept, we don't ask about anything underneath it (if you know entanglement, a
 * question about bits is a waste of your time). The path engine then drops what only the known
 * concepts needed. Capped so the check stays quick.
 */
export function nextDiagnosticConcept(opts: {
  path: string[];
  targets: string[];
  prereqs: PrereqMap;
  hasDiagnostic: (id: string) => boolean;
  answers: Record<string, boolean>;
}): string | null {
  const { path, targets, prereqs, hasDiagnostic, answers } = opts;
  if (Object.keys(answers).length >= MAX_DIAGNOSTIC_QUESTIONS) return null;
  const passed = Object.keys(answers).filter((id) => answers[id]);
  const covered = new Set(passed.flatMap((id) => [...ancestors(id, prereqs)]));
  const candidates = [...path].reverse().filter((id) => !targets.includes(id));
  return (
    candidates.find(
      (id) => !(id in answers) && !covered.has(id) && hasDiagnostic(id),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------------------
// Persistence (per-browser convenience; study data goes through telemetry, not here)
// ---------------------------------------------------------------------------------------

const key = (questionId: string) => `qurious.journey.v1.${questionId}`;

export function loadJourney(questionId: string): JourneyState | null {
  try {
    const raw = localStorage.getItem(key(questionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JourneyState;
    return parsed.version === 1 && parsed.questionId === questionId
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function saveJourney(j: JourneyState) {
  try {
    localStorage.setItem(key(j.questionId), JSON.stringify(j));
  } catch {
    // Storage unavailable: the journey still works for this visit.
  }
}

export function clearJourney(questionId: string) {
  try {
    localStorage.removeItem(key(questionId));
  } catch {
    // ignore
  }
}
