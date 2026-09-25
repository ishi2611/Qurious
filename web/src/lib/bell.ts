/**
 * Bell-pair experiments used by the Bell lab and the "beat the speed of light" reward.
 * Qubit 0 is Alice's, qubit 1 is Bob's. Measuring in the X (+/−) basis is done the standard
 * way: apply H, then measure in the 0/1 basis (0 means "+", 1 means "−").
 */
import {
  Operation,
  probabilityOfOne,
  Rng,
  runCircuit,
  sampleCounts,
  StateVector,
} from "@/lib/quantum";

export type BellKind = "phi+" | "phi-" | "psi+" | "psi-";
export type Basis = "Z" | "X";

export const BELL_LABELS: Record<BellKind, string> = {
  "phi+": "Φ⁺",
  "phi-": "Φ⁻",
  "psi+": "Ψ⁺",
  "psi-": "Ψ⁻",
};

/** Circuit preparing each Bell state from |00⟩. */
export function bellOps(kind: BellKind): Operation[] {
  const ops: Operation[] = [];
  if (kind === "psi+" || kind === "psi-") ops.push({ gate: "X", qubits: [1] });
  ops.push({ gate: "H", qubits: [0] }, { gate: "CNOT", qubits: [0, 1] });
  if (kind === "phi-" || kind === "psi-") ops.push({ gate: "Z", qubits: [0] });
  return ops;
}

function basisChange(basis: Basis, qubit: number): Operation[] {
  return basis === "X" ? [{ gate: "H", qubits: [qubit] }] : [];
}

/** The pair's state just before both qubits are read in the 0/1 basis. */
export function stateForBases(
  kind: BellKind,
  alice: Basis,
  bob: Basis,
): StateVector {
  return runCircuit({
    numQubits: 2,
    ops: [...bellOps(kind), ...basisChange(alice, 0), ...basisChange(bob, 1)],
  });
}

/**
 * Exact probability that Bob reads 1, given what Alice does. This is the no-signaling
 * statement in code: it is 1/2 whatever Alice's basis, and Alice not measuring at all is
 * the same as her measuring and not telling anyone.
 */
export function bobProbabilityOfOne(
  kind: BellKind,
  alice: Basis | "none",
  bob: Basis,
): number {
  return probabilityOfOne(
    stateForBases(kind, alice === "none" ? "Z" : alice, bob),
    1,
  );
}

export interface Round {
  alice: 0 | 1;
  bob: 0 | 1;
}

/** Run `n` fresh pairs, both measured in the given bases. */
export function runRounds(
  kind: BellKind,
  alice: Basis,
  bob: Basis,
  n: number,
  rng: Rng = Math.random,
): Round[] {
  const state = stateForBases(kind, alice, bob);
  const rounds: Round[] = [];
  for (let i = 0; i < n; i++) {
    const [label] = Object.keys(sampleCounts(state, 1, rng));
    rounds.push({
      alice: Number(label[0]) as 0 | 1,
      bob: Number(label[1]) as 0 | 1,
    });
  }
  return rounds;
}

export const agreement = (rounds: Round[]) =>
  rounds.length
    ? rounds.filter((r) => r.alice === r.bob).length / rounds.length
    : 0;

export const fractionOfOnes = (bits: number[]) =>
  bits.length ? bits.filter((b) => b === 1).length / bits.length : 0;
