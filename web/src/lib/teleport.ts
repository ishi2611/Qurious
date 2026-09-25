/**
 * Quantum teleportation, step by step, on the simulator.
 * Qubits: q0 = C (Alice's unknown state), q1 = A (Alice's half of the pair), q2 = B (Bob's).
 */
import {
  applyOperation,
  BlochVector,
  blochVector,
  measureQubit,
  Operation,
  Rng,
  runCircuit,
  StateVector,
} from "@/lib/quantum";

export type TeleportStage =
  | "prepared" // Alice's qubit is |ψ⟩; Bob's qubit is untouched
  | "shared" // Alice and Bob share a Bell pair
  | "entangled" // Alice has applied CNOT(C→A) and H(C)
  | "measured" // Alice has measured C and A (bits m1, m2)
  | "corrected"; // Bob has applied X^m2, then Z^m1

export interface TeleportSnapshot {
  stage: TeleportStage;
  state: StateVector;
  bits?: { m1: 0 | 1; m2: 0 | 1 };
}

/** Ops that turn |0⟩ on qubit q into cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩ (up to global phase). */
export const prepareOps = (theta: number, phi: number, q = 0): Operation[] => [
  { gate: "RY", qubits: [q], theta },
  { gate: "RZ", qubits: [q], theta: phi },
];

const applyAll = (state: StateVector, ops: Operation[]) =>
  ops.reduce((s, op) => applyOperation(s, op), state);

export function runTeleportation(
  theta: number,
  phi: number,
  rng: Rng = Math.random,
): TeleportSnapshot[] {
  const prepared = runCircuit({ numQubits: 3, ops: prepareOps(theta, phi) });
  const shared = applyAll(prepared, [
    { gate: "H", qubits: [1] },
    { gate: "CNOT", qubits: [1, 2] },
  ]);
  const entangled = applyAll(shared, [
    { gate: "CNOT", qubits: [0, 1] },
    { gate: "H", qubits: [0] },
  ]);

  const first = measureQubit(entangled, 0, rng);
  const second = measureQubit(first.state, 1, rng);
  const bits = { m1: first.outcome, m2: second.outcome };

  const corrected = applyAll(second.state, [
    ...(bits.m2 ? [{ gate: "X", qubits: [2] } as Operation] : []),
    ...(bits.m1 ? [{ gate: "Z", qubits: [2] } as Operation] : []),
  ]);

  return [
    { stage: "prepared", state: prepared },
    { stage: "shared", state: shared },
    { stage: "entangled", state: entangled },
    { stage: "measured", state: second.state, bits },
    { stage: "corrected", state: corrected, bits },
  ];
}

/**
 * Bob's qubit as Bob himself can describe it before Alice's bits arrive. Nothing Alice does
 * locally changes Bob's reduced state (no-signaling), so it's the same as right after the
 * pair was shared: half of a Bell pair, a zero-length Bloch vector (a fair coin in every basis).
 */
export const bobBlindVector = (snapshots: TeleportSnapshot[]): BlochVector =>
  blochVector(snapshots[1].state, 2);

/** Fidelity of two pure single-qubit states from their Bloch vectors: (1 + a·b) / 2. */
export const fidelity = (a: BlochVector, b: BlochVector) =>
  (1 + a.x * b.x + a.y * b.y + a.z * b.z) / 2;
