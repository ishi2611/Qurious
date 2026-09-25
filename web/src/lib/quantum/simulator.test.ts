import { describe, expect, test } from "vitest";
import { approxEqual, c, expi } from "./complex";
import { Operation } from "./gates";
import {
  applyOperation,
  basisLabel,
  blochVector,
  measureQubit,
  probabilities,
  probabilityOfOne,
  runCircuit,
  sampleCounts,
  seededRng,
  zeroState,
  StateVector,
} from "./simulator";

const run = (numQubits: number, ops: Operation[]) =>
  runCircuit({ numQubits, ops });
const S2 = Math.SQRT1_2;

function expectState(actual: StateVector, expected: [number, number][]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((amp, i) => {
    const want = c(expected[i][0], expected[i][1]);
    expect(
      approxEqual(amp, want),
      `amplitude ${i}: got ${JSON.stringify(amp)}`,
    ).toBe(true);
  });
}

function expectProbs(actual: number[], expected: number[]) {
  actual.forEach((p, i) => expect(p).toBeCloseTo(expected[i], 10));
}

describe("basics", () => {
  test("starts in |0…0⟩", () => {
    expectProbs(probabilities(zeroState(3)), [1, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("labels are big-endian", () => {
    expect(basisLabel(1, 3)).toBe("001");
    expect(basisLabel(4, 3)).toBe("100");
  });

  test("X on q0 of two qubits gives |10⟩ (q0 is the leftmost bit)", () => {
    expectProbs(
      probabilities(run(2, [{ gate: "X", qubits: [0] }])),
      [0, 0, 1, 0],
    );
  });

  test("rejects bad circuits with readable errors", () => {
    expect(() => run(0, [])).toThrow(/between 1 and 5/);
    expect(() => run(6, [])).toThrow(/between 1 and 5/);
    expect(() => run(1, [{ gate: "X", qubits: [1] }])).toThrow(/uses qubit 1/);
    expect(() => run(2, [{ gate: "CNOT", qubits: [0] }])).toThrow(
      /needs 2 qubit/,
    );
    expect(() => run(2, [{ gate: "CNOT", qubits: [1, 1] }])).toThrow(
      /same qubit twice/,
    );
    expect(() => run(1, [{ gate: "RX", qubits: [0] }])).toThrow(/angle/);
  });

  test("does not mutate the input state", () => {
    const start = zeroState(1);
    applyOperation(start, { gate: "X", qubits: [0] });
    expectState(start, [
      [1, 0],
      [0, 0],
    ]);
  });
});

describe("single-qubit gates", () => {
  test("H|0⟩ = |+⟩ and H·H = I", () => {
    expectState(run(1, [{ gate: "H", qubits: [0] }]), [
      [S2, 0],
      [S2, 0],
    ]);
    expectState(
      run(1, [
        { gate: "H", qubits: [0] },
        { gate: "H", qubits: [0] },
      ]),
      [
        [1, 0],
        [0, 0],
      ],
    );
  });

  test("Y|0⟩ = i|1⟩", () => {
    expectState(run(1, [{ gate: "Y", qubits: [0] }]), [
      [0, 0],
      [0, 1],
    ]);
  });

  test("Z flips the sign of |1⟩ only", () => {
    expectState(
      run(1, [
        { gate: "X", qubits: [0] },
        { gate: "Z", qubits: [0] },
      ]),
      [
        [0, 0],
        [-1, 0],
      ],
    );
  });

  test("T·T = S, S·S = Z, and T·T† = I", () => {
    const one: Operation = { gate: "X", qubits: [0] };
    const tt = run(1, [
      one,
      { gate: "T", qubits: [0] },
      { gate: "T", qubits: [0] },
    ]);
    const s = run(1, [one, { gate: "S", qubits: [0] }]);
    expectState(
      tt,
      s.map((a) => [a.re, a.im]),
    );
    expectState(
      run(1, [one, { gate: "S", qubits: [0] }, { gate: "S", qubits: [0] }]),
      [
        [0, 0],
        [-1, 0],
      ],
    );
    expectState(
      run(1, [one, { gate: "T", qubits: [0] }, { gate: "Tdg", qubits: [0] }]),
      [
        [0, 0],
        [1, 0],
      ],
    );
  });

  test("rotations follow R(θ) = exp(−iθP/2)", () => {
    // RX(π)|0⟩ = −i|1⟩
    expectState(run(1, [{ gate: "RX", qubits: [0], theta: Math.PI }]), [
      [0, 0],
      [0, -1],
    ]);
    // RY(π/2)|0⟩ = |+⟩
    expectState(run(1, [{ gate: "RY", qubits: [0], theta: Math.PI / 2 }]), [
      [S2, 0],
      [S2, 0],
    ]);
    // RZ(θ)|+⟩ = (e^{−iθ/2}|0⟩ + e^{iθ/2}|1⟩)/√2
    const theta = 0.7;
    const out = run(1, [
      { gate: "H", qubits: [0] },
      { gate: "RZ", qubits: [0], theta },
    ]);
    const a = expi(-theta / 2);
    const b = expi(theta / 2);
    expectState(out, [
      [a.re * S2, a.im * S2],
      [b.re * S2, b.im * S2],
    ]);
  });
});

describe("multi-qubit gates", () => {
  test("H then CNOT makes the Bell state (|00⟩ + |11⟩)/√2", () => {
    const bell = run(2, [
      { gate: "H", qubits: [0] },
      { gate: "CNOT", qubits: [0, 1] },
    ]);
    expectProbs(probabilities(bell), [0.5, 0, 0, 0.5]);
  });

  test("CNOT flips the target only when the control is 1", () => {
    expectProbs(
      probabilities(run(2, [{ gate: "CNOT", qubits: [0, 1] }])),
      [1, 0, 0, 0],
    );
    expectProbs(
      probabilities(
        run(2, [
          { gate: "X", qubits: [0] },
          { gate: "CNOT", qubits: [0, 1] },
        ]),
      ),
      [0, 0, 0, 1],
    );
    // Reversed roles: control q1, target q0
    expectProbs(
      probabilities(
        run(2, [
          { gate: "X", qubits: [1] },
          { gate: "CNOT", qubits: [1, 0] },
        ]),
      ),
      [0, 0, 0, 1],
    );
  });

  test("CZ adds a −1 phase to |11⟩ only", () => {
    const state = run(2, [
      { gate: "H", qubits: [0] },
      { gate: "H", qubits: [1] },
      { gate: "CZ", qubits: [0, 1] },
    ]);
    expectState(state, [
      [0.5, 0],
      [0.5, 0],
      [0.5, 0],
      [-0.5, 0],
    ]);
  });

  test("SWAP exchanges qubits: |10⟩ → |01⟩", () => {
    expectProbs(
      probabilities(
        run(2, [
          { gate: "X", qubits: [0] },
          { gate: "SWAP", qubits: [0, 1] },
        ]),
      ),
      [0, 1, 0, 0],
    );
  });

  test("SWAP equals three CNOTs", () => {
    const prep: Operation[] = [
      { gate: "RY", qubits: [0], theta: 0.4 },
      { gate: "RX", qubits: [1], theta: 1.3 },
    ];
    const swap = run(2, [...prep, { gate: "SWAP", qubits: [0, 1] }]);
    const cnots = run(2, [
      ...prep,
      { gate: "CNOT", qubits: [0, 1] },
      { gate: "CNOT", qubits: [1, 0] },
      { gate: "CNOT", qubits: [0, 1] },
    ]);
    expectState(
      swap,
      cnots.map((a) => [a.re, a.im]),
    );
  });

  test("Toffoli computes AND into the target (full truth table)", () => {
    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        const ops: Operation[] = [];
        if (a) ops.push({ gate: "X", qubits: [0] });
        if (b) ops.push({ gate: "X", qubits: [1] });
        ops.push({ gate: "TOFFOLI", qubits: [0, 1, 2] });
        const state = run(3, ops);
        expect(probabilityOfOne(state, 2)).toBeCloseTo(a & b, 10);
      }
    }
  });

  test("gates act on the right qubit in a 5-qubit register", () => {
    const state = run(5, [{ gate: "X", qubits: [3] }]);
    expect(probabilities(state)[0b00010]).toBeCloseTo(1, 10);
  });
});

describe("Bloch vectors", () => {
  const cases: [string, Operation[], [number, number, number]][] = [
    ["|0⟩", [], [0, 0, 1]],
    ["|1⟩", [{ gate: "X", qubits: [0] }], [0, 0, -1]],
    ["|+⟩", [{ gate: "H", qubits: [0] }], [1, 0, 0]],
    [
      "|−⟩",
      [
        { gate: "X", qubits: [0] },
        { gate: "H", qubits: [0] },
      ],
      [-1, 0, 0],
    ],
    [
      "|+i⟩",
      [
        { gate: "H", qubits: [0] },
        { gate: "S", qubits: [0] },
      ],
      [0, 1, 0],
    ],
  ];
  test.each(cases)("%s", (_name, ops, [x, y, z]) => {
    const v = blochVector(run(1, ops), 0);
    expect(v.x).toBeCloseTo(x, 10);
    expect(v.y).toBeCloseTo(y, 10);
    expect(v.z).toBeCloseTo(z, 10);
  });

  test("a qubit in a Bell pair has a zero-length Bloch vector", () => {
    const bell = run(2, [
      { gate: "H", qubits: [0] },
      { gate: "CNOT", qubits: [0, 1] },
    ]);
    const v = blochVector(bell, 1);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(0, 10);
  });
});

describe("measurement", () => {
  test("sampling is reproducible with a seed and matches the Born rule", () => {
    const plus = run(1, [{ gate: "H", qubits: [0] }]);
    const a = sampleCounts(plus, 4000, seededRng(42));
    const b = sampleCounts(plus, 4000, seededRng(42));
    expect(a).toEqual(b);
    expect(a["0"] / 4000).toBeGreaterThan(0.45);
    expect(a["0"] / 4000).toBeLessThan(0.55);
  });

  test("a Bell pair only ever gives 00 or 11", () => {
    const bell = run(2, [
      { gate: "H", qubits: [0] },
      { gate: "CNOT", qubits: [0, 1] },
    ]);
    const counts = sampleCounts(bell, 1000, seededRng(7));
    expect(Object.keys(counts).sort()).toEqual(["00", "11"]);
  });

  test("measuring one qubit of a Bell pair collapses the other", () => {
    const bell = run(2, [
      { gate: "H", qubits: [0] },
      { gate: "CNOT", qubits: [0, 1] },
    ]);
    const rng = seededRng(3);
    for (let i = 0; i < 20; i++) {
      const { outcome, state } = measureQubit(bell, 0, rng);
      expect(probabilityOfOne(state, 1)).toBeCloseTo(outcome, 10);
      expect(probabilities(state).reduce((s, p) => s + p, 0)).toBeCloseTo(
        1,
        10,
      );
    }
  });
});

test("random circuits preserve total probability (every gate is unitary)", () => {
  const rng = seededRng(2026);
  const gates = [
    "X",
    "Y",
    "Z",
    "H",
    "S",
    "T",
    "RX",
    "RY",
    "RZ",
    "CNOT",
    "CZ",
    "SWAP",
  ] as const;
  for (let trial = 0; trial < 50; trial++) {
    const n = 2 + Math.floor(rng() * 4);
    const ops: Operation[] = [];
    for (let k = 0; k < 20; k++) {
      const gate = gates[Math.floor(rng() * gates.length)];
      const q0 = Math.floor(rng() * n);
      const q1 = (q0 + 1 + Math.floor(rng() * (n - 1))) % n;
      const twoQubit = gate === "CNOT" || gate === "CZ" || gate === "SWAP";
      ops.push({
        gate,
        qubits: twoQubit ? [q0, q1] : [q0],
        theta: rng() * 2 * Math.PI,
      });
    }
    const total = probabilities(run(n, ops)).reduce((s, p) => s + p, 0);
    expect(total).toBeCloseTo(1, 9);
  }
});
