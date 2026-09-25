import { describe, expect, test } from "vitest";
import type { CircuitGoalPuzzle } from "@/lib/content/types";
import { checkPuzzle } from "./puzzles";

const S2 = Math.SQRT1_2;

const puzzle = (p: Partial<CircuitGoalPuzzle>): CircuitGoalPuzzle => ({
  type: "circuit_goal",
  prompt: "p",
  num_qubits: 1,
  allowed_gates: ["H", "X"],
  target_probabilities: { "0": 0.5, "1": 0.5 },
  hints: [],
  ...p,
});

describe("checkPuzzle", () => {
  test("solves the 50/50 puzzle with H", () => {
    const r = checkPuzzle(puzzle({}), {
      numQubits: 1,
      ops: [{ gate: "H", qubits: [0] }],
    });
    expect(r.solved).toBe(true);
  });

  test("an empty circuit gets a nudge, not a failure message", () => {
    const r = checkPuzzle(puzzle({}), { numQubits: 1, ops: [] });
    expect(r).toMatchObject({ solved: false, reason: "empty" });
  });

  test("wrong probabilities say which outcome is off and by how much", () => {
    const r = checkPuzzle(puzzle({}), {
      numQubits: 1,
      ops: [{ gate: "X", qubits: [0] }],
    });
    expect(r).toMatchObject({ solved: false, reason: "wrong_probabilities" });
    expect(r.message).toBe(
      "Not yet. |1⟩ comes up 100% of the time; the goal is 50%.",
    );
  });

  test("phase is checked when target amplitudes are given (|+⟩ vs |−⟩)", () => {
    const plus = puzzle({
      target_amplitudes: { "0": [S2, 0], "1": [S2, 0] },
    });
    const minus = checkPuzzle(plus, {
      numQubits: 1,
      ops: [
        { gate: "X", qubits: [0] },
        { gate: "H", qubits: [0] },
      ],
    });
    expect(minus).toMatchObject({ solved: false, reason: "wrong_phase" });
    // |+⟩ times a global phase (e.g. from Z·X·Z …) still counts as solved.
    const plusState = checkPuzzle(plus, {
      numQubits: 1,
      ops: [{ gate: "H", qubits: [0] }],
    });
    expect(plusState.solved).toBe(true);
  });

  test("global phase is ignored: −|1⟩ matches a |1⟩ target", () => {
    const one = puzzle({
      allowed_gates: ["X", "Z"],
      target_probabilities: { "1": 1 },
      target_amplitudes: { "1": [1, 0] },
    });
    const r = checkPuzzle(one, {
      numQubits: 1,
      ops: [
        { gate: "X", qubits: [0] },
        { gate: "Z", qubits: [0] },
      ],
    });
    expect(r.solved).toBe(true);
  });

  test("required gates and gate limits are enforced", () => {
    const cnot = puzzle({
      num_qubits: 2,
      allowed_gates: ["X", "CNOT"],
      required_gates: ["CNOT"],
      max_gates: 2,
      target_probabilities: { "11": 1 },
    });
    const noCnot = checkPuzzle(cnot, {
      numQubits: 2,
      ops: [
        { gate: "X", qubits: [0] },
        { gate: "X", qubits: [1] },
      ],
    });
    expect(noCnot).toMatchObject({ reason: "missing_required_gate" });
    const tooMany = checkPuzzle(cnot, {
      numQubits: 2,
      ops: [
        { gate: "X", qubits: [0] },
        { gate: "X", qubits: [0] },
        { gate: "X", qubits: [0] },
      ],
    });
    expect(tooMany).toMatchObject({ reason: "too_many_gates" });
    const good = checkPuzzle(cnot, {
      numQubits: 2,
      ops: [
        { gate: "X", qubits: [0] },
        { gate: "CNOT", qubits: [0, 1] },
      ],
    });
    expect(good.solved).toBe(true);
  });

  test("Bell-pair puzzle", () => {
    const bell = puzzle({
      num_qubits: 2,
      allowed_gates: ["H", "CNOT"],
      target_probabilities: { "00": 0.5, "11": 0.5 },
    });
    const r = checkPuzzle(bell, {
      numQubits: 2,
      ops: [
        { gate: "H", qubits: [0] },
        { gate: "CNOT", qubits: [0, 1] },
      ],
    });
    expect(r.solved).toBe(true);
  });
});
