"use client";

import { useState } from "react";
import { Operation, probabilities, runCircuit } from "@/lib/quantum";
import ProbabilityBars from "@/components/ui/ProbabilityBars";
import Ket from "@/components/ui/Ket";

const INPUTS: { label: string; prep: Operation[] }[] = [
  { label: "0", prep: [] },
  { label: "1", prep: [{ gate: "X", qubits: [0] }] },
  { label: "+", prep: [{ gate: "H", qubits: [0] }] },
  {
    label: "−",
    prep: [
      { gate: "X", qubits: [0] },
      { gate: "H", qubits: [0] },
    ],
  },
];

/** Feed states into a CNOT "copier" and compare the output with what two real copies would give. */
export default function CloningAttempt() {
  const [choice, setChoice] = useState(0);
  const input = INPUTS[choice];
  const copier = runCircuit({
    numQubits: 2,
    ops: [...input.prep, { gate: "CNOT", qubits: [0, 1] }],
  });
  // Two genuine copies: prepare the same state on both qubits independently.
  const ideal = runCircuit({
    numQubits: 2,
    ops: [...input.prep, ...input.prep.map((op) => ({ ...op, qubits: [1] }))],
  });
  const got = probabilities(copier);
  const want = probabilities(ideal);
  const matches = got.every((p, i) => Math.abs(p - want[i]) < 1e-9);

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          State to copy (on q0; q1 starts blank as |0⟩)
        </legend>
        <div className="flex flex-wrap gap-2">
          {INPUTS.map((inp, i) => (
            <label
              key={inp.label}
              className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-4 ${
                choice === i
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name="clone-input"
                className="sr-only"
                checked={choice === i}
                onChange={() => setChoice(i)}
              />
              <Ket label={inp.label} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <section>
          <h4 className="mb-2 text-sm font-semibold">
            What the CNOT copier produces
          </h4>
          <ProbabilityBars probabilities={got} numQubits={2} />
        </section>
        <section>
          <h4 className="mb-2 text-sm font-semibold">
            What two real copies of <Ket label={input.label} /> would give
          </h4>
          <ProbabilityBars probabilities={want} numQubits={2} />
        </section>
      </div>
      <p
        aria-live="polite"
        className={`rounded-lg p-3 text-[0.95rem] ${matches ? "bg-success-soft" : "bg-danger-soft"}`}
      >
        {matches ? (
          <>
            <span aria-hidden="true">✓ </span>Copied perfectly. For{" "}
            <Ket label={input.label} /> the copier works.
          </>
        ) : (
          <>
            <span aria-hidden="true">✗ </span>Not a copy. Two copies would
            sometimes read 01 or 10, but the copier only ever gives 00 or 11. It
            made an entangled pair instead.
          </>
        )}
      </p>
    </div>
  );
}
