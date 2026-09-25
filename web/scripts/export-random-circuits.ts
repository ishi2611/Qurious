/**
 * Generates random circuits, runs them through our simulator, and writes the results
 * to JSON so `api/scripts/crosscheck_simulator.py` can re-run them in Qiskit-Aer.
 *
 * Usage: npm run sim:export -- [outputPath] [count] [seed]
 */
import { writeFileSync } from "node:fs";
import { GateName, Operation } from "../src/lib/quantum/gates";
import {
  MAX_QUBITS,
  runCircuit,
  seededRng,
} from "../src/lib/quantum/simulator";

const [outPath = "sim-crosscheck.json", countArg = "50", seedArg = "20260924"] =
  process.argv.slice(2);
const rng = seededRng(Number(seedArg));
const pick = <T>(items: readonly T[]) =>
  items[Math.floor(rng() * items.length)];

const ONE_QUBIT: GateName[] = [
  "X",
  "Y",
  "Z",
  "H",
  "S",
  "Sdg",
  "T",
  "Tdg",
  "RX",
  "RY",
  "RZ",
];
const TWO_QUBIT: GateName[] = ["CNOT", "CZ", "SWAP"];

/** k distinct qubits out of n, in random order. */
function distinctQubits(n: number, k: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  const chosen: number[] = [];
  while (chosen.length < k)
    chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return chosen;
}

function randomOp(n: number): Operation {
  const roll = rng();
  if (n >= 3 && roll < 0.1)
    return { gate: "TOFFOLI", qubits: distinctQubits(n, 3) };
  if (n >= 2 && roll < 0.4)
    return { gate: pick(TWO_QUBIT), qubits: distinctQubits(n, 2) };
  const gate = pick(ONE_QUBIT);
  const op: Operation = { gate, qubits: distinctQubits(n, 1) };
  if (gate.startsWith("R")) op.theta = (rng() * 4 - 2) * Math.PI;
  return op;
}

const circuits = Array.from({ length: Number(countArg) }, (_, i) => {
  const numQubits = 1 + (i % MAX_QUBITS); // cover every size from 1 to 5 evenly
  const ops = Array.from({ length: 5 + Math.floor(rng() * 26) }, () =>
    randomOp(numQubits),
  );
  const state = runCircuit({ numQubits, ops });
  return { numQubits, ops, amplitudes: state.map((a) => [a.re, a.im]) };
});

writeFileSync(
  outPath,
  JSON.stringify({ convention: "big-endian", circuits }, null, 1),
);
console.log(`Wrote ${circuits.length} circuits to ${outPath}`);
