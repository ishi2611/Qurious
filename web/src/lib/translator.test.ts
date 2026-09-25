import { describe, expect, test } from "vitest";
import {
  ClassicalCircuit,
  collisions,
  PRESETS,
  simulateSuperposition,
  simulateTruthTable,
  toReversible,
  truthTable,
  validateCircuit,
} from "./translator";

describe("classical truth tables", () => {
  test("gates compute what they should", () => {
    expect(truthTable(PRESETS.and).map((r) => r.outputs[0])).toEqual([
      0, 0, 0, 1,
    ]);
    expect(truthTable(PRESETS.or).map((r) => r.outputs[0])).toEqual([
      0, 1, 1, 1,
    ]);
    expect(truthTable(PRESETS.xor).map((r) => r.outputs[0])).toEqual([
      0, 1, 1, 0,
    ]);
    expect(truthTable(PRESETS.not).map((r) => r.outputs[0])).toEqual([1, 0]);
    expect(truthTable(PRESETS.half_adder).map((r) => r.outputs)).toEqual([
      [0, 0],
      [1, 0],
      [1, 0],
      [0, 1],
    ]);
  });

  test("irreversibility is detected where information is lost", () => {
    expect(collisions(PRESETS.and)).toHaveLength(1); // 00, 01, 10 → 0
    expect(collisions(PRESETS.and)[0]).toHaveLength(3);
    expect(collisions(PRESETS.half_adder)).toHaveLength(1); // 01 and 10 both → sum 1, carry 0
    expect(collisions(PRESETS.not)).toEqual([]); // NOT happens to be reversible
  });
});

describe("reversible translation", () => {
  test.each(Object.keys(PRESETS))(
    "%s: every simulated row matches the classical truth table",
    (key) => {
      const rows = simulateTruthTable(PRESETS[key]);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.outputs, `inputs ${row.inputs.join("")}`).toEqual(
          row.expected,
        );
        expect(row.matches).toBe(true);
      }
    },
  );

  test("uses the textbook gates: AND → Toffoli, XOR → CNOTs", () => {
    expect(toReversible(PRESETS.and).ops.map((o) => o.gate)).toEqual([
      "TOFFOLI",
    ]);
    expect(toReversible(PRESETS.xor).ops.map((o) => o.gate)).toEqual([
      "CNOT",
      "CNOT",
    ]);
    expect(toReversible(PRESETS.half_adder).numQubits).toBe(4);
  });

  test("a custom multi-gate circuit (a AND b) XOR (NOT a) translates correctly", () => {
    const custom: ClassicalCircuit = {
      name: "custom",
      inputs: ["a", "b"],
      gates: [
        { type: "AND", inputs: ["a", "b"], output: "w1" },
        { type: "NOT", inputs: ["a"], output: "w2" },
        { type: "XOR", inputs: ["w1", "w2"], output: "out" },
      ],
      outputs: ["out"],
    };
    expect(simulateTruthTable(custom).every((r) => r.matches)).toBe(true);
  });

  test("malformed or oversized circuits get readable errors", () => {
    expect(() =>
      validateCircuit({
        name: "x",
        inputs: ["a"],
        gates: [{ type: "AND", inputs: ["a"], output: "o" }],
        outputs: ["o"],
      }),
    ).toThrow(/needs 2/);
    expect(() =>
      validateCircuit({
        name: "x",
        inputs: ["a", "b"],
        gates: [{ type: "AND", inputs: ["a", "z"], output: "o" }],
        outputs: ["o"],
      }),
    ).toThrow(/before it exists/);
    const big: ClassicalCircuit = {
      name: "big",
      inputs: ["a", "b"],
      gates: ["w1", "w2", "w3", "w4"].map((w) => ({
        type: "XOR" as const,
        inputs: ["a", "b"],
        output: w,
      })),
      outputs: ["w4"],
    };
    expect(() => validateCircuit(big)).toThrow(/up to 5/);
  });
});

describe("superposition input", () => {
  test("every input row appears with equal probability, each with its correct outputs", () => {
    const rows = simulateSuperposition(PRESETS.half_adder);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.probability).toBeCloseTo(0.25, 10);
      const [a, b] = r.inputs;
      expect(r.outputs).toEqual([a ^ b, a & b]);
    }
  });
});
