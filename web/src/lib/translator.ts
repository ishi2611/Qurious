/**
 * Classical → quantum translator.
 *
 * A classical circuit is a tiny netlist: named input bits, then gates that each produce a new
 * wire, then a choice of output wires. Classical gates like AND can't run on a quantum computer
 * as they are, because they throw information away (irreversible), while every quantum gate
 * can be undone. The standard fix: keep the inputs, and write each gate's result onto a fresh
 * qubit that starts at 0.
 *
 *   NOT a    → CNOT(a → t), X(t)            t = ¬a
 *   a AND b  → Toffoli(a, b → t)            t = a·b
 *   a XOR b  → CNOT(a → t), CNOT(b → t)     t = a ⊕ b
 *   a OR b   → CNOT(a → t), CNOT(b → t), Toffoli(a, b → t)    t = a ⊕ b ⊕ ab
 */
import {
  basisLabel,
  MAX_QUBITS,
  Operation,
  probabilities,
  runCircuit,
} from "@/lib/quantum";

export type ClassicalGateType = "NOT" | "AND" | "OR" | "XOR";

export interface ClassicalGate {
  type: ClassicalGateType;
  inputs: string[]; // wire names; NOT takes one input, the others two
  output: string; // name of the new wire this gate creates
}

export interface ClassicalCircuit {
  name: string;
  inputs: string[];
  gates: ClassicalGate[];
  outputs: string[];
}

export const GATE_ARITY: Record<ClassicalGateType, number> = {
  NOT: 1,
  AND: 2,
  OR: 2,
  XOR: 2,
};

const EVAL: Record<ClassicalGateType, (x: number[]) => number> = {
  NOT: ([a]) => 1 - a,
  AND: ([a, b]) => a & b,
  OR: ([a, b]) => a | b,
  XOR: ([a, b]) => a ^ b,
};

export const PRESETS: Record<string, ClassicalCircuit> = {
  not: {
    name: "NOT",
    inputs: ["a"],
    gates: [{ type: "NOT", inputs: ["a"], output: "out" }],
    outputs: ["out"],
  },
  and: {
    name: "AND",
    inputs: ["a", "b"],
    gates: [{ type: "AND", inputs: ["a", "b"], output: "out" }],
    outputs: ["out"],
  },
  or: {
    name: "OR",
    inputs: ["a", "b"],
    gates: [{ type: "OR", inputs: ["a", "b"], output: "out" }],
    outputs: ["out"],
  },
  xor: {
    name: "XOR",
    inputs: ["a", "b"],
    gates: [{ type: "XOR", inputs: ["a", "b"], output: "out" }],
    outputs: ["out"],
  },
  half_adder: {
    name: "Half adder",
    inputs: ["a", "b"],
    gates: [
      { type: "XOR", inputs: ["a", "b"], output: "sum" },
      { type: "AND", inputs: ["a", "b"], output: "carry" },
    ],
    outputs: ["sum", "carry"],
  },
};

/** Throws a readable error if the netlist is malformed or too big to simulate. */
export function validateCircuit(c: ClassicalCircuit): void {
  const known = new Set(c.inputs);
  if (!c.inputs.length) throw new Error("Add at least one input.");
  for (const g of c.gates) {
    if (g.inputs.length !== GATE_ARITY[g.type]) {
      throw new Error(`${g.type} needs ${GATE_ARITY[g.type]} input(s).`);
    }
    for (const w of g.inputs) {
      if (!known.has(w))
        throw new Error(`Wire "${w}" is used before it exists.`);
    }
    if (known.has(g.output))
      throw new Error(`Wire "${g.output}" is defined twice.`);
    known.add(g.output);
  }
  if (!c.outputs.length) throw new Error("Choose at least one output.");
  for (const o of c.outputs)
    if (!known.has(o)) throw new Error(`Output "${o}" doesn't exist.`);
  const qubits = c.inputs.length + c.gates.length;
  if (qubits > MAX_QUBITS) {
    throw new Error(
      `The reversible version needs ${qubits} qubits; the simulator handles up to ${MAX_QUBITS}.`,
    );
  }
}

/** All input rows, e.g. for inputs [a, b]: [[0,0],[0,1],[1,0],[1,1]]. */
export function inputRows(n: number): number[][] {
  return Array.from({ length: 2 ** n }, (_, i) =>
    [...basisLabel(i, n)].map(Number),
  );
}

/** Evaluate the classical circuit on one input row; returns every wire's value. */
export function evaluate(
  c: ClassicalCircuit,
  row: number[],
): Record<string, number> {
  const values: Record<string, number> = {};
  c.inputs.forEach((w, i) => (values[w] = row[i]));
  for (const g of c.gates)
    values[g.output] = EVAL[g.type](g.inputs.map((w) => values[w]));
  return values;
}

export interface TruthRow {
  inputs: number[];
  outputs: number[];
}

export const truthTable = (c: ClassicalCircuit): TruthRow[] =>
  inputRows(c.inputs.length).map((inputs) => {
    const v = evaluate(c, inputs);
    return { inputs, outputs: c.outputs.map((o) => v[o]) };
  });

/**
 * Where the classical circuit loses information: groups of different inputs that give the
 * same outputs. Empty means it happens to be reversible (like NOT).
 */
export function collisions(c: ClassicalCircuit): TruthRow[][] {
  const groups = new Map<string, TruthRow[]>();
  for (const row of truthTable(c)) {
    const key = row.outputs.join("");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

export interface ReversibleCircuit {
  numQubits: number;
  /** Qubit index of every wire: inputs first, then one fresh qubit per gate. */
  qubitOf: Record<string, number>;
  ops: Operation[];
  /** One explanation per classical gate, in order. */
  steps: { gate: ClassicalGate; ops: Operation[]; explanation: string }[];
}

export function toReversible(c: ClassicalCircuit): ReversibleCircuit {
  validateCircuit(c);
  const qubitOf: Record<string, number> = {};
  c.inputs.forEach((w, i) => (qubitOf[w] = i));
  const steps: ReversibleCircuit["steps"] = [];
  c.gates.forEach((g, k) => {
    const t = c.inputs.length + k;
    qubitOf[g.output] = t;
    const [x, y] = g.inputs.map((w) => qubitOf[w]);
    let ops: Operation[];
    let explanation: string;
    switch (g.type) {
      case "NOT":
        ops = [
          { gate: "CNOT", qubits: [x, t] },
          { gate: "X", qubits: [t] },
        ];
        explanation = `Copy ${g.inputs[0]} onto a fresh qubit with CNOT, then flip it with X: ${g.output} = NOT ${g.inputs[0]}, and ${g.inputs[0]} is kept.`;
        break;
      case "AND":
        ops = [{ gate: "TOFFOLI", qubits: [x, y, t] }];
        explanation = `A Toffoli flips a fresh qubit only when both ${g.inputs[0]} and ${g.inputs[1]} are 1, so it ends up as ${g.inputs[0]} AND ${g.inputs[1]}. The inputs are kept, so nothing is lost.`;
        break;
      case "XOR":
        ops = [
          { gate: "CNOT", qubits: [x, t] },
          { gate: "CNOT", qubits: [y, t] },
        ];
        explanation = `Two CNOTs add ${g.inputs[0]} and ${g.inputs[1]} (mod 2) into a fresh qubit: that's XOR, with both inputs kept.`;
        break;
      case "OR":
        ops = [
          { gate: "CNOT", qubits: [x, t] },
          { gate: "CNOT", qubits: [y, t] },
          { gate: "TOFFOLI", qubits: [x, y, t] },
        ];
        explanation = `OR = a ⊕ b ⊕ (a AND b): two CNOTs give the XOR, and a Toffoli adds 1 back when both are 1.`;
        break;
    }
    steps.push({ gate: g, ops, explanation });
  });
  return {
    numQubits: c.inputs.length + c.gates.length,
    qubitOf,
    ops: steps.flatMap((s) => s.ops),
    steps,
  };
}

export interface SimulatedRow extends TruthRow {
  expected: number[];
  matches: boolean;
}

/** Run the reversible circuit on every basis input and read the output qubits. */
export function simulateTruthTable(c: ClassicalCircuit): SimulatedRow[] {
  const rev = toReversible(c);
  return truthTable(c).map((row) => {
    const prep: Operation[] = row.inputs.flatMap((bit, i) =>
      bit ? [{ gate: "X", qubits: [i] } as Operation] : [],
    );
    const probs = probabilities(
      runCircuit({ numQubits: rev.numQubits, ops: [...prep, ...rev.ops] }),
    );
    // Basis inputs give a single certain outcome; find it.
    const index = probs.findIndex((p) => p > 1 - 1e-9);
    const label = basisLabel(index, rev.numQubits);
    const outputs = c.outputs.map((o) => Number(label[rev.qubitOf[o]]));
    const inputsAfter = c.inputs.map((w) => Number(label[rev.qubitOf[w]]));
    return {
      inputs: row.inputs,
      expected: row.outputs,
      outputs,
      matches:
        outputs.every((b, i) => b === row.outputs[i]) &&
        inputsAfter.every((b, i) => b === row.inputs[i]),
    };
  });
}

/**
 * Put every input into (|0⟩+|1⟩)/√2 first. Returns each possible measurement row with its
 * probability: all input combinations appear, each paired with its correct outputs.
 */
export function simulateSuperposition(
  c: ClassicalCircuit,
): { inputs: number[]; outputs: number[]; probability: number }[] {
  const rev = toReversible(c);
  const hs: Operation[] = c.inputs.map((_, i) => ({ gate: "H", qubits: [i] }));
  const probs = probabilities(
    runCircuit({ numQubits: rev.numQubits, ops: [...hs, ...rev.ops] }),
  );
  return probs
    .map((p, index) => ({ p, label: basisLabel(index, rev.numQubits) }))
    .filter(({ p }) => p > 1e-9)
    .map(({ p, label }) => ({
      inputs: c.inputs.map((w) => Number(label[rev.qubitOf[w]])),
      outputs: c.outputs.map((o) => Number(label[rev.qubitOf[o]])),
      probability: p,
    }));
}
