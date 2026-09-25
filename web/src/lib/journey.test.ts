import { describe, expect, test } from "vitest";
import {
  JourneyState,
  ancestors,
  completeCurrent,
  currentConcept,
  MAX_DIAGNOSTIC_QUESTIONS,
  newJourney,
  nextDiagnosticConcept,
  startDetour,
  stepsAfterCurrent,
} from "./journey";

const PREREQS = {
  bits: [],
  kets: [],
  qubit: ["bits", "kets"],
  superposition: ["qubit"],
  measurement: ["superposition"],
  cnot: ["measurement", "bits"],
  entanglement: ["cnot"],
};
const PATH = [
  "bits",
  "kets",
  "qubit",
  "superposition",
  "measurement",
  "cnot",
  "entanglement",
];

describe("journey progress", () => {
  test("walks the path, reporting steps left", () => {
    let j: JourneyState = {
      ...newJourney("q"),
      path: ["a", "b", "c"],
      phase: "lesson",
    };
    expect(currentConcept(j)).toBe("a");
    expect(stepsAfterCurrent(j)).toBe(2);
    j = completeCurrent(j);
    expect(currentConcept(j)).toBe("b");
    expect(j.phase).toBe("map");
    j = completeCurrent(completeCurrent(j));
    expect(j.phase).toBe("reward");
    expect(currentConcept(j)).toBeUndefined();
  });

  test("detours are visited then popped without advancing the path", () => {
    let j: JourneyState = {
      ...newJourney("q"),
      path: ["a", "b"],
      phase: "lesson",
    };
    j = startDetour(j, "prereq");
    expect(currentConcept(j)).toBe("prereq");
    j = completeCurrent(j);
    expect(currentConcept(j)).toBe("a");
    expect(j.completed).toEqual([]);
  });
});

describe("diagnostic planning", () => {
  const hasDiagnostic = () => true;
  const plan = (answers: Record<string, boolean>) =>
    nextDiagnosticConcept({
      path: PATH,
      targets: ["entanglement"],
      prereqs: PREREQS,
      hasDiagnostic,
      answers,
    });

  test("ancestors are transitive", () => {
    expect(ancestors("cnot", PREREQS)).toEqual(
      new Set(["measurement", "superposition", "qubit", "bits", "kets"]),
    );
  });

  test("starts closest to the goal and never asks about the target", () => {
    expect(plan({})).toBe("cnot");
  });

  test("passing a concept skips everything under it", () => {
    expect(plan({ cnot: true })).toBeNull();
  });

  test("failing a concept moves down to its prerequisites", () => {
    expect(plan({ cnot: false })).toBe("measurement");
    expect(plan({ cnot: false, measurement: true })).toBeNull();
    expect(
      plan({ cnot: false, measurement: false, superposition: false }),
    ).toBe("qubit");
  });

  test("the check is capped", () => {
    const longPath = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const answers: Record<string, boolean> = {};
    let next: string | null;
    while (
      (next = nextDiagnosticConcept({
        path: longPath,
        targets: ["c11"],
        prereqs: {},
        hasDiagnostic,
        answers,
      }))
    ) {
      answers[next] = false;
    }
    expect(Object.keys(answers)).toHaveLength(MAX_DIAGNOSTIC_QUESTIONS);
  });
});
