import { describe, expect, test } from "vitest";
import { blochVector, probabilities, seededRng } from "@/lib/quantum";
import {
  agreement,
  BellKind,
  bobProbabilityOfOne,
  runRounds,
  stateForBases,
} from "./bell";
import { bobBlindVector, fidelity, runTeleportation } from "./teleport";

const KINDS: BellKind[] = ["phi+", "phi-", "psi+", "psi-"];

describe("Bell states", () => {
  test("each circuit makes the right Bell state", () => {
    const expected: Record<BellKind, number[]> = {
      "phi+": [0.5, 0, 0, 0.5],
      "phi-": [0.5, 0, 0, 0.5],
      "psi+": [0, 0.5, 0.5, 0],
      "psi-": [0, 0.5, 0.5, 0],
    };
    for (const kind of KINDS) {
      probabilities(stateForBases(kind, "Z", "Z")).forEach((p, i) =>
        expect(p).toBeCloseTo(expected[kind][i], 10),
      );
    }
  });

  test("Φ⁺ and Φ⁻ look alike in Z⊗Z but differ in X⊗X", () => {
    // Φ⁺ always agrees in X⊗X; Φ⁻ always disagrees.
    expect(agreement(runRounds("phi+", "X", "X", 200, seededRng(1)))).toBe(1);
    expect(agreement(runRounds("phi-", "X", "X", 200, seededRng(1)))).toBe(0);
  });

  test("no-signaling: Bob's odds are exactly 1/2 whatever Alice does", () => {
    for (const kind of KINDS) {
      for (const alice of ["Z", "X", "none"] as const) {
        for (const bob of ["Z", "X"] as const) {
          expect(bobProbabilityOfOne(kind, alice, bob)).toBeCloseTo(0.5, 12);
        }
      }
    }
  });

  test("mismatched bases give no correlation (about 50% agreement)", () => {
    const a = agreement(runRounds("phi+", "X", "Z", 4000, seededRng(9)));
    expect(a).toBeGreaterThan(0.46);
    expect(a).toBeLessThan(0.54);
  });
});

describe("teleportation", () => {
  // measureQubit picks outcome 1 when rng() < P(1). Both of Alice's measurements have
  // P(1) = 1/2, so rng values 0.1 and 0.9 force outcomes 1 and 0.
  const forced = (m1: 0 | 1, m2: 0 | 1) => {
    const values = [m1 ? 0.1 : 0.9, m2 ? 0.1 : 0.9];
    return () => values.shift()!;
  };

  test.each([
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const)(
    "Bob recovers the state for Alice's result m1=%i, m2=%i",
    (m1, m2) => {
      for (const [theta, phi] of [
        [0, 0],
        [Math.PI, 0],
        [Math.PI / 2, 0],
        [1.1, 2.3],
        [2.5, 5.9],
      ]) {
        const steps = runTeleportation(theta, phi, forced(m1, m2));
        expect(steps[3].bits).toEqual({ m1, m2 });
        const original = blochVector(steps[0].state, 0);
        const bob = blochVector(steps[4].state, 2);
        expect(fidelity(original, bob)).toBeCloseTo(1, 10);
      }
    },
  );

  test("before the bits arrive, Bob's qubit carries no information", () => {
    const steps = runTeleportation(1.1, 2.3, seededRng(5));
    const v = bobBlindVector(steps);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(0, 10);
  });

  test("Alice no longer has the state after measuring (no-cloning)", () => {
    const steps = runTeleportation(1.1, 2.3, seededRng(5));
    const original = blochVector(steps[0].state, 0);
    const alice = blochVector(steps[4].state, 0);
    // Her qubit is now |0⟩ or |1⟩ (a measurement result), not the original state.
    expect(Math.abs(alice.z)).toBeCloseTo(1, 10);
    expect(fidelity(original, alice)).toBeLessThan(0.99);
  });
});
