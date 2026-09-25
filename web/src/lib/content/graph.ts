import type { Concept } from "./types";
import { ancestors, PrereqMap } from "@/lib/journey";

export const prereqMap = (concepts: Record<string, Concept>): PrereqMap =>
  Object.fromEntries(
    Object.values(concepts).map((c) => [c.id, c.prerequisites]),
  );

/** Every concept a question's path could include: its targets and all their prerequisites. */
export function conceptsForTargets(
  targets: string[],
  concepts: Record<string, Concept>,
): string[] {
  const prereqs = prereqMap(concepts);
  const ids = new Set(targets);
  for (const t of targets) for (const a of ancestors(t, prereqs)) ids.add(a);
  return [...ids];
}
