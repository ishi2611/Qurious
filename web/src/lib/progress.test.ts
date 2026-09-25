import { expect, test } from "vitest";
import { newJourney } from "./journey";
import { mergeJourneys } from "./progress";

test("merging keeps the most recently updated journey per question", () => {
  const older = {
    ...newJourney("q1"),
    completed: ["a"],
    updatedAt: "2026-09-01T00:00:00Z",
  };
  const newer = {
    ...newJourney("q1"),
    completed: ["a", "b"],
    updatedAt: "2026-09-20T00:00:00Z",
  };
  const other = { ...newJourney("q2"), updatedAt: "2026-09-10T00:00:00Z" };
  expect(mergeJourneys({ q1: older }, { q1: newer, q2: other })).toEqual({
    q1: newer,
    q2: other,
  });
  expect(mergeJourneys({ q1: newer }, { q1: older })).toEqual({ q1: newer });
});
