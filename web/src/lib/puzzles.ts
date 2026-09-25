/**
 * Checks a learner's circuit against a circuit-goal puzzle and explains what's off.
 * Mirrors api/app/content/puzzles.py (same tolerance, same global-phase rule), which the
 * content validator uses to prove every puzzle is solvable.
 */
import type { CircuitGoalPuzzle } from "@/lib/content/types";
import {
  basisLabel,
  Circuit,
  probabilities,
  runCircuit,
  StateVector,
} from "@/lib/quantum";

export const PROBABILITY_TOLERANCE = 1e-6;

export type PuzzleFeedback =
  | { solved: true; message: string }
  | { solved: false; reason: PuzzleFailure; message: string };

export type PuzzleFailure =
  | "empty"
  | "too_many_gates"
  | "missing_required_gate"
  | "wrong_probabilities"
  | "wrong_phase";

const pct = (p: number) => `${Math.round(p * 1000) / 10}%`;

/** Target probability for every basis state (labels missing from the puzzle mean 0). */
export function targetDistribution(puzzle: CircuitGoalPuzzle): number[] {
  const n = puzzle.num_qubits;
  return Array.from(
    { length: 2 ** n },
    (_, i) => puzzle.target_probabilities[basisLabel(i, n)] ?? 0,
  );
}

/** |⟨target|state⟩| — equals 1 exactly when the states match up to a global phase. */
function overlapWithTarget(
  state: StateVector,
  puzzle: CircuitGoalPuzzle,
): number {
  const n = puzzle.num_qubits;
  const target = Array.from({ length: 2 ** n }, (_, i) => {
    const [re, im] = puzzle.target_amplitudes?.[basisLabel(i, n)] ?? [0, 0];
    return { re, im };
  });
  const norm = Math.sqrt(
    target.reduce((s, a) => s + a.re * a.re + a.im * a.im, 0),
  );
  let re = 0;
  let im = 0;
  target.forEach((t, i) => {
    // conj(t) · state[i]
    const s = state[i];
    re += (t.re * s.re + t.im * s.im) / norm;
    im += (t.re * s.im - t.im * s.re) / norm;
  });
  return Math.hypot(re, im);
}

export function checkPuzzle(
  puzzle: CircuitGoalPuzzle,
  circuit: Circuit,
): PuzzleFeedback {
  const used = circuit.ops.map((op) => op.gate);
  if (used.length === 0) {
    return {
      solved: false,
      reason: "empty",
      message: "Add some gates first. The qubits start in |0…0⟩.",
    };
  }
  if (puzzle.max_gates && used.length > puzzle.max_gates) {
    return {
      solved: false,
      reason: "too_many_gates",
      message: `This one can be done in ${puzzle.max_gates} gate${puzzle.max_gates === 1 ? "" : "s"}. You used ${used.length}.`,
    };
  }
  const missing = (puzzle.required_gates ?? []).filter(
    (g) => !used.includes(g),
  );
  if (missing.length) {
    return {
      solved: false,
      reason: "missing_required_gate",
      message: `The goal is reachable, but this puzzle is about ${missing.join(" and ")}. Try a solution that uses it.`,
    };
  }

  const state = runCircuit(circuit);
  const probs = probabilities(state);
  const target = targetDistribution(puzzle);
  const n = puzzle.num_qubits;
  // Report the outcome that is furthest off; on a tie, the one that shows up too often,
  // since "you get |1⟩ every time" is easier to act on than "you never get |0⟩".
  const worst = probs
    .map((p, i) => ({ i, diff: p - target[i] }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.diff - a.diff)[0];

  if (Math.abs(worst.diff) > PROBABILITY_TOLERANCE) {
    const label = basisLabel(worst.i, n);
    const opener = Math.abs(worst.diff) < 0.15 ? "Close!" : "Not yet.";
    return {
      solved: false,
      reason: "wrong_probabilities",
      message: `${opener} |${label}⟩ comes up ${pct(probs[worst.i])} of the time; the goal is ${pct(target[worst.i])}.`,
    };
  }

  if (
    puzzle.target_amplitudes &&
    Math.abs(overlapWithTarget(state, puzzle) - 1) > PROBABILITY_TOLERANCE
  ) {
    return {
      solved: false,
      reason: "wrong_phase",
      message:
        "The odds are exactly right, but the phase isn't: your state has the same probabilities with a different sign or phase. Look at which gates change phase.",
    };
  }

  return {
    solved: true,
    message: "Solved! Your circuit produces exactly the target state.",
  };
}
