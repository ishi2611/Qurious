"use client";

import { useState } from "react";
import type { Circuit } from "@/lib/quantum";
import CircuitSandbox from "@/components/interactives/CircuitSandbox";
import HardwarePanel from "./HardwarePanel";

/** A free circuit builder (no puzzle), with the option to run the circuit on real hardware. */
export default function Playground() {
  const [numQubits, setNumQubits] = useState(2);
  const [circuit, setCircuit] = useState<Circuit>({ numQubits: 2, ops: [] });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-accent text-sm font-semibold tracking-wide uppercase">
          Playground
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Build any circuit
        </h1>
        <p className="text-ink-muted text-lg">
          No goal, no checks: just gates and results. Everything here uses ideas
          from the lessons.
        </p>
      </header>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Qubits</legend>
        <div className="flex gap-2">
          {[1, 2, 3].map((n) => (
            <label
              key={n}
              className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border ${
                numQubits === n
                  ? "border-accent bg-accent-soft text-accent font-semibold"
                  : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={numQubits === n}
                onChange={() => {
                  setNumQubits(n);
                  setCircuit({ numQubits: n, ops: [] });
                }}
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>
      <CircuitSandbox
        key={numQubits}
        numQubits={numQubits}
        allowedGates={[
          "X",
          "Y",
          "Z",
          "H",
          "S",
          "T",
          "CNOT",
          "CZ",
          "SWAP",
          "TOFFOLI",
        ]}
        showBloch
        onChange={setCircuit}
      />
      <HardwarePanel circuit={circuit} />
    </main>
  );
}
