"use client";

import { useMemo, useState } from "react";
import {
  ClassicalCircuit,
  ClassicalGateType,
  collisions,
  GATE_ARITY,
  PRESETS,
  simulateSuperposition,
  simulateTruthTable,
  toReversible,
  truthTable,
  validateCircuit,
} from "@/lib/translator";
import { MAX_QUBITS } from "@/lib/quantum";
import CircuitDiagram from "@/components/interactives/CircuitDiagram";
import CheckQuestion from "@/components/lesson/CheckQuestion";
import Callout from "@/components/ui/Callout";
import { Button } from "@/components/ui/Button";

type Stage =
  "build" | "classical" | "reversible" | "simulate" | "superposition";
const STAGES: { id: Stage; label: string }[] = [
  { id: "build", label: "1. Build" },
  { id: "classical", label: "2. Run it backwards?" },
  { id: "reversible", label: "3. Make it reversible" },
  { id: "simulate", label: "4. Simulate" },
  { id: "superposition", label: "5. Superposition" },
];

const bits = (xs: number[]) => xs.join("");

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[16rem] text-sm">
        <thead>
          <tr className="text-ink-muted text-left">
            {head.map((h) => (
              <th key={h} className="py-1.5 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r, i) => (
            <tr key={i} className="border-border border-t">
              {r.map((c, j) => (
                <td key={j} className="py-1.5 pr-4">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Build a custom circuit: add gates on existing wires, pick outputs. */
function Builder({
  circuit,
  onChange,
}: {
  circuit: ClassicalCircuit;
  onChange: (c: ClassicalCircuit) => void;
}) {
  const wires = [...circuit.inputs, ...circuit.gates.map((g) => g.output)];
  const [type, setType] = useState<ClassicalGateType>("AND");
  const [a, setA] = useState(wires[0]);
  const [b, setB] = useState(wires[1] ?? wires[0]);
  const full = circuit.inputs.length + circuit.gates.length >= MAX_QUBITS;

  const add = () => {
    const output = `w${circuit.gates.length + 1}`;
    const inputs = GATE_ARITY[type] === 1 ? [a] : [a, b];
    onChange({
      ...circuit,
      name: "Your circuit",
      gates: [...circuit.gates, { type, inputs, output }],
      outputs: [output],
    });
  };

  const select = (value: string, set: (v: string) => void, label: string) => (
    <label className="flex flex-col text-sm">
      <span className="text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="border-border bg-surface min-h-11 rounded-lg border px-2 font-mono"
      >
        {wires.map((w) => (
          <option key={w}>{w}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="border-border bg-surface space-y-3 rounded-xl border p-4">
      <p className="font-semibold">Or build your own (inputs a and b)</p>
      <ol className="space-y-1 font-mono text-sm">
        {circuit.gates.map((g) => (
          <li key={g.output}>
            {g.output} ={" "}
            {g.inputs.length === 1
              ? `NOT ${g.inputs[0]}`
              : `${g.inputs[0]} ${g.type} ${g.inputs[1]}`}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          <span className="text-ink-muted">Gate</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ClassicalGateType)}
            className="border-border bg-surface min-h-11 rounded-lg border px-2 font-mono"
          >
            {(["AND", "OR", "XOR", "NOT"] as const).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {select(a, setA, "Input")}
        {GATE_ARITY[type] === 2 && select(b, setB, "Input")}
        <Button variant="secondary" onClick={add} disabled={full}>
          Add gate
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            onChange({
              ...circuit,
              gates: circuit.gates.slice(0, -1),
              outputs:
                circuit.gates.length > 1
                  ? [circuit.gates[circuit.gates.length - 2].output]
                  : [],
            })
          }
          disabled={!circuit.gates.length}
        >
          Remove last
        </Button>
      </div>
      {circuit.gates.length > 0 && (
        <fieldset>
          <legend className="text-ink-muted text-sm">Outputs</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {circuit.gates.map((g) => (
              <label
                key={g.output}
                className="flex items-center gap-1.5 font-mono text-sm"
              >
                <input
                  type="checkbox"
                  checked={circuit.outputs.includes(g.output)}
                  onChange={(e) =>
                    onChange({
                      ...circuit,
                      outputs: e.target.checked
                        ? [...circuit.outputs, g.output]
                        : circuit.outputs.filter((o) => o !== g.output),
                    })
                  }
                />
                {g.output}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {full && (
        <p className="text-ink-muted text-sm">
          That&apos;s the most this simulator can hold ({MAX_QUBITS} qubits).
        </p>
      )}
    </div>
  );
}

export default function Translator() {
  const [circuit, setCircuit] = useState<ClassicalCircuit>(PRESETS.half_adder);
  const [stage, setStage] = useState<Stage>("build");

  const error = useMemo(() => {
    try {
      validateCircuit(circuit);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [circuit]);

  const index = STAGES.findIndex((s) => s.id === stage);
  const next = () => setStage(STAGES[index + 1].id);
  const choose = (c: ClassicalCircuit) => {
    setCircuit(c);
    setStage("build");
  };

  const table = error ? [] : truthTable(circuit);
  const lost = error ? [] : collisions(circuit);
  const rev = error ? null : toReversible(circuit);
  const labels = rev
    ? Object.entries(rev.qubitOf)
        .sort((x, y) => x[1] - y[1])
        .map(([w]) => w)
    : [];
  const head = [...circuit.inputs, "→", ...circuit.outputs];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="text-accent text-sm font-semibold tracking-wide uppercase">
          Classical → Quantum Translator
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Can a quantum computer run an ordinary logic circuit?
        </h1>
        <p className="text-ink-muted text-lg leading-relaxed">
          Not directly. Build a classical circuit and see why, then turn it into
          one a quantum computer can run.
        </p>
      </header>

      <nav aria-label="Translator steps">
        <ol className="flex flex-wrap gap-2">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={i > index || !!error}
                onClick={() => setStage(s.id)}
                aria-current={s.id === stage ? "step" : undefined}
                className={`min-h-9 rounded-full px-3 text-sm ${
                  s.id === stage
                    ? "bg-accent-soft text-accent font-semibold"
                    : i < index
                      ? "text-ink"
                      : "text-ink-muted"
                } disabled:opacity-50`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {stage === "build" && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Pick a classical circuit</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESETS).map(([key, p]) => (
              <Button
                key={key}
                variant={circuit.name === p.name ? "primary" : "secondary"}
                onClick={() => choose(p)}
              >
                {p.name}
              </Button>
            ))}
            <Button
              variant={circuit.name === "Your circuit" ? "primary" : "ghost"}
              onClick={() =>
                choose({
                  name: "Your circuit",
                  inputs: ["a", "b"],
                  gates: [],
                  outputs: [],
                })
              }
            >
              Start from scratch
            </Button>
          </div>
          <Builder key={circuit.name} circuit={circuit} onChange={setCircuit} />
          {error ? (
            <p role="alert" className="bg-danger-soft rounded-lg p-3">
              {error}
            </p>
          ) : (
            <Button onClick={next}>Next: can it run backwards?</Button>
          )}
        </section>
      )}

      {stage === "classical" && !error && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            {circuit.name}: the classical truth table
          </h2>
          <Table
            head={head}
            rows={table.map((r) => [...r.inputs, "→", ...r.outputs])}
          />
          {lost.length ? (
            <Callout kind="breaks" title="It can't run backwards">
              Different inputs give the same output:{" "}
              {lost
                .map(
                  (g) =>
                    `${g.map((r) => bits(r.inputs)).join(", ")} all give ${bits(g[0].outputs)}`,
                )
                .join("; ")}
              . From the output you can&apos;t recover the input, so information
              is destroyed. Every quantum gate is reversible (it can be undone),
              so a quantum computer can&apos;t do this as it is.
            </Callout>
          ) : (
            <Callout kind="note" title="This one is reversible">
              Every output comes from exactly one input, so no information is
              lost. The translator still writes the result to a fresh qubit, the
              same recipe it uses for every gate.
            </Callout>
          )}
          <Button onClick={next}>Make it reversible</Button>
        </section>
      )}

      {stage === "reversible" && rev && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            The reversible (quantum) version
          </h2>
          <p className="text-ink-muted leading-relaxed">
            The trick: keep the inputs, and write each result onto a fresh qubit
            that starts at 0. {rev.numQubits} qubits in total.
          </p>
          <CircuitDiagram
            numQubits={rev.numQubits}
            ops={rev.ops}
            labels={labels}
          />
          <ol className="space-y-2">
            {rev.steps.map((s) => (
              <li
                key={s.gate.output}
                className="bg-surface-muted rounded-lg p-3 text-[0.95rem] leading-relaxed"
              >
                <span className="font-mono font-semibold">
                  {s.gate.type} →{" "}
                  {s.ops
                    .map((o) => (o.gate === "TOFFOLI" ? "Toffoli" : o.gate))
                    .join(" + ")}
                </span>
                <br />
                {s.explanation}
              </li>
            ))}
          </ol>
          <Button onClick={next}>Simulate it</Button>
        </section>
      )}

      {stage === "simulate" && rev && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            Does the quantum version give the same answers?
          </h2>
          <p className="text-ink-muted">
            Each row runs the quantum circuit on the simulator, starting from
            that input.
          </p>
          <Table
            head={[circuit.inputs.join(""), "classical", "quantum", ""]}
            rows={simulateTruthTable(circuit).map((r) => [
              bits(r.inputs),
              bits(r.expected),
              bits(r.outputs),
              r.matches ? "✓ match" : "✗",
            ])}
          />
          <p className="bg-success-soft rounded-lg p-3">
            ✓ Every row matches, and the inputs come out unchanged, so nothing
            was lost.
          </p>
          <Button onClick={next}>What if the input is in superposition?</Button>
        </section>
      )}

      {stage === "superposition" && rev && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Now feed it a superposition</h2>
          <p className="leading-relaxed">
            Put an H on each input first, so every input is (|0⟩+|1⟩)/√2.
            Here&apos;s every result you could get when measuring all the
            qubits:
          </p>
          <Table
            head={[...circuit.inputs, "→", ...circuit.outputs, "chance"]}
            rows={simulateSuperposition(circuit).map((r) => [
              ...r.inputs,
              "→",
              ...r.outputs,
              `${Math.round(r.probability * 100)}%`,
            ])}
          />
          <Callout
            kind="note"
            title="Every row at once… but you only get to see one"
          >
            The circuit acted on all {table.length} inputs in a single run, and
            every result is correct. But a measurement hands you just one row,
            at random. Superposition alone isn&apos;t a speed-up; quantum
            algorithms need interference to make the useful answer the likely
            one.
          </Callout>
          <CheckQuestion
            check={{
              question:
                "You run the circuit once on the superposition and measure. How many rows of the truth table do you learn?",
              options: [
                "All of them at once",
                "Exactly one, chosen at random",
                "None",
              ],
              answer: 1,
              explanation:
                "The measurement collapses the state to one row. To learn the whole table you'd need to run it many times, just like a classical computer.",
            }}
            altExplanation="Look at the table above: each line is one possible measurement result. A single measurement gives a single line."
            onContinue={() => setStage("build")}
            continueLabel="Try another circuit"
          />
        </section>
      )}
    </main>
  );
}
