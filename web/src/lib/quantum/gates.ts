import { Complex, c, expi } from "./complex";

/** A 2×2 matrix as [[a, b], [c, d]], acting on column vectors (α, β). */
export type Matrix2 = [[Complex, Complex], [Complex, Complex]];

export type SingleQubitGate =
  "I" | "X" | "Y" | "Z" | "H" | "S" | "Sdg" | "T" | "Tdg";
export type RotationGate = "RX" | "RY" | "RZ";
export type MultiQubitGate = "CNOT" | "CZ" | "SWAP" | "TOFFOLI";
export type GateName = SingleQubitGate | RotationGate | MultiQubitGate;

/**
 * One operation in a circuit.
 * - Single-qubit and rotation gates: `qubits = [target]`.
 * - CNOT / CZ: `qubits = [control, target]`.
 * - TOFFOLI: `qubits = [control1, control2, target]`.
 * - SWAP: `qubits = [a, b]`.
 * - Rotations take their angle (radians) in `theta`.
 */
export interface Operation {
  gate: GateName;
  qubits: number[];
  theta?: number;
}

const S2 = Math.SQRT1_2;

export const FIXED_GATES: Record<SingleQubitGate, Matrix2> = {
  I: [
    [c(1), c(0)],
    [c(0), c(1)],
  ],
  X: [
    [c(0), c(1)],
    [c(1), c(0)],
  ],
  Y: [
    [c(0), c(0, -1)],
    [c(0, 1), c(0)],
  ],
  Z: [
    [c(1), c(0)],
    [c(0), c(-1)],
  ],
  H: [
    [c(S2), c(S2)],
    [c(S2), c(-S2)],
  ],
  S: [
    [c(1), c(0)],
    [c(0), c(0, 1)],
  ],
  Sdg: [
    [c(1), c(0)],
    [c(0), c(0, -1)],
  ],
  T: [
    [c(1), c(0)],
    [c(0), expi(Math.PI / 4)],
  ],
  Tdg: [
    [c(1), c(0)],
    [c(0), expi(-Math.PI / 4)],
  ],
};

/**
 * Rotation gates, using the standard convention R_P(θ) = exp(−iθP/2)
 * (the same one Qiskit uses, so the cross-check compares like with like).
 */
export function rotation(gate: RotationGate, theta: number): Matrix2 {
  const cos = Math.cos(theta / 2);
  const sin = Math.sin(theta / 2);
  switch (gate) {
    case "RX":
      return [
        [c(cos), c(0, -sin)],
        [c(0, -sin), c(cos)],
      ];
    case "RY":
      return [
        [c(cos), c(-sin)],
        [c(sin), c(cos)],
      ];
    case "RZ":
      return [
        [expi(-theta / 2), c(0)],
        [c(0), expi(theta / 2)],
      ];
  }
}

/** How many qubits each gate acts on. */
export const ARITY: Record<GateName, number> = {
  I: 1,
  X: 1,
  Y: 1,
  Z: 1,
  H: 1,
  S: 1,
  Sdg: 1,
  T: 1,
  Tdg: 1,
  RX: 1,
  RY: 1,
  RZ: 1,
  CNOT: 2,
  CZ: 2,
  SWAP: 2,
  TOFFOLI: 3,
};

export const isRotation = (gate: GateName): gate is RotationGate =>
  gate === "RX" || gate === "RY" || gate === "RZ";

export const isSingleQubit = (gate: GateName): gate is SingleQubitGate =>
  gate in FIXED_GATES;
