/**
 * A small state-vector simulator (up to MAX_QUBITS qubits) that runs in the browser,
 * so visuals update instantly with no server round trip.
 *
 * Qubit ordering is BIG-ENDIAN, matching standard textbook notation: in |q0 q1 … q(n−1)⟩,
 * q0 is the leftmost (most significant) bit. So for 2 qubits, index 1 is |01⟩, meaning
 * q0 = 0 and q1 = 1. (Qiskit is little-endian; the cross-check script reverses bits.)
 */
import { Complex, ONE, ZERO, abs2, add, c, conj, mul } from "./complex";
import {
  ARITY,
  FIXED_GATES,
  Matrix2,
  Operation,
  isRotation,
  isSingleQubit,
  rotation,
} from "./gates";

export const MAX_QUBITS = 5;

export interface Circuit {
  numQubits: number;
  ops: Operation[];
}

/** Amplitudes of all 2^n basis states, indexed big-endian. */
export type StateVector = Complex[];

export interface BlochVector {
  x: number;
  y: number;
  z: number;
}

/** Bit mask for qubit q in an n-qubit big-endian index. */
const maskFor = (q: number, n: number) => 1 << (n - 1 - q);

export const numQubitsOf = (state: StateVector) => Math.log2(state.length);

/** |00…0⟩ */
export function zeroState(numQubits: number): StateVector {
  assertQubitCount(numQubits);
  const state = Array.from({ length: 2 ** numQubits }, () => ZERO);
  state[0] = ONE;
  return state;
}

/** Basis-state label for an index, e.g. 5 with 3 qubits → "101". */
export const basisLabel = (index: number, numQubits: number) =>
  index.toString(2).padStart(numQubits, "0");

function assertQubitCount(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUBITS) {
    throw new RangeError(
      `Circuits must have between 1 and ${MAX_QUBITS} qubits (got ${n})`,
    );
  }
}

/** Check that an operation makes sense for an n-qubit circuit, with a readable error if not. */
export function validateOperation(op: Operation, numQubits: number) {
  const arity = ARITY[op.gate];
  if (arity === undefined) throw new Error(`Unknown gate "${op.gate}"`);
  if (op.qubits.length !== arity) {
    throw new Error(
      `${op.gate} needs ${arity} qubit(s), got ${op.qubits.length}`,
    );
  }
  for (const q of op.qubits) {
    if (!Number.isInteger(q) || q < 0 || q >= numQubits) {
      throw new RangeError(
        `${op.gate} uses qubit ${q}, but the circuit has ${numQubits}`,
      );
    }
  }
  if (new Set(op.qubits).size !== op.qubits.length) {
    throw new Error(`${op.gate} can't use the same qubit twice`);
  }
  if (isRotation(op.gate) && !Number.isFinite(op.theta)) {
    throw new Error(`${op.gate} needs a numeric angle theta`);
  }
}

/**
 * Apply a 2×2 matrix to `target`, but only on basis states where every control qubit is 1.
 * With no controls this is an ordinary single-qubit gate. CNOT, CZ, and Toffoli are all
 * expressed this way, which keeps one well-tested code path for every controlled gate.
 */
function applyControlled(
  state: StateVector,
  matrix: Matrix2,
  target: number,
  controls: number[],
): StateVector {
  const n = numQubitsOf(state);
  const tMask = maskFor(target, n);
  const cMask = controls.reduce((m, q) => m | maskFor(q, n), 0);
  const out = state.slice();
  for (let i = 0; i < state.length; i++) {
    // Visit each (|…0…⟩, |…1…⟩) pair once, from its target=0 member.
    if (i & tMask || (i & cMask) !== cMask) continue;
    const j = i | tMask;
    const a0 = state[i];
    const a1 = state[j];
    out[i] = add(mul(matrix[0][0], a0), mul(matrix[0][1], a1));
    out[j] = add(mul(matrix[1][0], a0), mul(matrix[1][1], a1));
  }
  return out;
}

function applySwap(state: StateVector, a: number, b: number): StateVector {
  const n = numQubitsOf(state);
  const ma = maskFor(a, n);
  const mb = maskFor(b, n);
  const out = state.slice();
  for (let i = 0; i < state.length; i++) {
    const bitA = (i & ma) !== 0;
    const bitB = (i & mb) !== 0;
    if (bitA !== bitB) out[i ^ ma ^ mb] = state[i];
  }
  return out;
}

/** Apply one operation and return the new state (the input is not modified). */
export function applyOperation(state: StateVector, op: Operation): StateVector {
  const n = numQubitsOf(state);
  validateOperation(op, n);
  const { gate, qubits } = op;

  if (isSingleQubit(gate))
    return applyControlled(state, FIXED_GATES[gate], qubits[0], []);
  if (isRotation(gate))
    return applyControlled(state, rotation(gate, op.theta!), qubits[0], []);

  switch (gate) {
    case "CNOT":
      return applyControlled(state, FIXED_GATES.X, qubits[1], [qubits[0]]);
    case "CZ":
      return applyControlled(state, FIXED_GATES.Z, qubits[1], [qubits[0]]);
    case "TOFFOLI":
      return applyControlled(state, FIXED_GATES.X, qubits[2], [
        qubits[0],
        qubits[1],
      ]);
    case "SWAP":
      return applySwap(state, qubits[0], qubits[1]);
  }
  throw new Error(`Unhandled gate ${gate}`);
}

/** Run a whole circuit from |00…0⟩ (or from `initial`, if given). */
export function runCircuit(
  circuit: Circuit,
  initial?: StateVector,
): StateVector {
  assertQubitCount(circuit.numQubits);
  let state = initial ?? zeroState(circuit.numQubits);
  if (state.length !== 2 ** circuit.numQubits) {
    throw new Error("Initial state size doesn't match the number of qubits");
  }
  for (const op of circuit.ops) state = applyOperation(state, op);
  return state;
}

/** Probability of each basis state (Born rule). */
export const probabilities = (state: StateVector): number[] => state.map(abs2);

/** Probability that measuring `qubit` gives 1. */
export function probabilityOfOne(state: StateVector, qubit: number): number {
  const m = maskFor(qubit, numQubitsOf(state));
  return state.reduce((sum, amp, i) => (i & m ? sum + abs2(amp) : sum), 0);
}

/**
 * Bloch vector of one qubit, from its reduced density matrix ρ.
 * For a qubit that's entangled with others this vector is shorter than 1,
 * which is exactly the "you can't describe it on its own" effect we want to show.
 */
export function blochVector(state: StateVector, qubit: number): BlochVector {
  const m = maskFor(qubit, numQubitsOf(state));
  let rho00 = 0;
  let rho11 = 0;
  let rho01 = c(0); // Σ a(…0…) · conj(a(…1…))
  for (let i = 0; i < state.length; i++) {
    if (i & m) {
      rho11 += abs2(state[i]);
    } else {
      rho00 += abs2(state[i]);
      rho01 = add(rho01, mul(state[i], conj(state[i | m])));
    }
  }
  return { x: 2 * rho01.re, y: -2 * rho01.im, z: rho00 - rho11 };
}

// ---------------------------------------------------------------------------
// Randomness and measurement
// ---------------------------------------------------------------------------

/** A random-number source returning floats in [0, 1). */
export type Rng = () => number;

/** Small seeded PRNG (mulberry32) so sampling is reproducible in tests and study sessions. */
export function seededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickIndex(probs: number[], r: number): number {
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r < acc) return i;
  }
  return probs.length - 1; // guard against rounding leaving acc just under 1
}

/**
 * Measure all qubits `shots` times. Returns counts keyed by basis label, e.g. {"00": 507, "11": 493}.
 * Only outcomes that occurred are included.
 */
export function sampleCounts(
  state: StateVector,
  shots: number,
  rng: Rng = Math.random,
): Record<string, number> {
  const n = numQubitsOf(state);
  const probs = probabilities(state);
  const counts: Record<string, number> = {};
  for (let s = 0; s < shots; s++) {
    const label = basisLabel(pickIndex(probs, rng()), n);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

/**
 * Measure a single qubit: pick an outcome with the Born rule, then collapse the state
 * (zero the other branch and renormalize).
 */
export function measureQubit(
  state: StateVector,
  qubit: number,
  rng: Rng = Math.random,
): { outcome: 0 | 1; state: StateVector } {
  const p1 = probabilityOfOne(state, qubit);
  const outcome: 0 | 1 = rng() < p1 ? 1 : 0;
  const m = maskFor(qubit, numQubitsOf(state));
  const norm = Math.sqrt(outcome ? p1 : 1 - p1);
  const collapsed = state.map((amp, i) =>
    Boolean(i & m) === Boolean(outcome)
      ? c(amp.re / norm, amp.im / norm)
      : ZERO,
  );
  return { outcome, state: collapsed };
}

/** Maximum absolute difference between two probability distributions. */
export function maxProbabilityDiff(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  return a.reduce((m, p, i) => Math.max(m, Math.abs(p - b[i])), 0);
}
