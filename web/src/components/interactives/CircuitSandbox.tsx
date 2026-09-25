"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ARITY,
  blochVector,
  Circuit,
  GateName,
  Operation,
  probabilities,
  runCircuit,
} from "@/lib/quantum";
import type { CircuitGoalPuzzle, PuzzleGate } from "@/lib/content/types";
import { checkPuzzle, PuzzleFeedback } from "@/lib/puzzles";
import ProbabilityBars from "@/components/ui/ProbabilityBars";
import BlochMini from "./BlochMini";
import { Button } from "@/components/ui/Button";

export interface CircuitSandboxProps {
  numQubits: number;
  allowedGates: PuzzleGate[];
  initialOps?: Operation[];
  showBloch?: boolean;
  /** When set, the sandbox becomes a puzzle with a Check button. */
  puzzle?: CircuitGoalPuzzle;
  onCheck?: (feedback: PuzzleFeedback, circuit: Circuit) => void;
  /** Called on every change, e.g. for the translator or telemetry. */
  onChange?: (circuit: Circuit) => void;
  maxOps?: number;
}

const GATE_HELP: Record<string, string> = {
  X: "X: flips |0⟩ ↔ |1⟩",
  Y: "Y: flip plus a phase",
  Z: "Z: flips the sign of |1⟩",
  H: "H: makes (or undoes) a 50/50 superposition",
  S: "S: quarter turn of phase",
  T: "T: eighth turn of phase",
  CNOT: "CNOT: flips the target when the control is 1",
  CZ: "CZ: flips the sign of |11⟩",
  SWAP: "SWAP: exchanges two qubits",
  TOFFOLI: "Toffoli: flips the target when both controls are 1",
};

type Glyph = "control" | "target" | "swap";

function GateGlyph({ kind }: { kind: Glyph }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 bg-transparent"
      aria-hidden="true"
    >
      {kind === "control" && (
        <circle cx="12" cy="12" r="5" fill="currentColor" />
      )}
      {kind === "target" && (
        <g fill="var(--surface)" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" />
        </g>
      )}
      {kind === "swap" && (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/** Qubits for a multi-qubit gate dropped on wire q: q is the first control, the rest follow. */
function placement(gate: GateName, q: number, n: number): number[] {
  const arity = ARITY[gate];
  return Array.from({ length: arity }, (_, k) => (q + k) % n);
}

function PaletteGate({
  gate,
  selected,
  disabled,
  onSelect,
}: {
  gate: PuzzleGate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${gate}`,
      data: { gate },
      disabled,
    });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={GATE_HELP[gate]}
      disabled={disabled}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={`flex h-11 min-w-11 touch-none items-center justify-center rounded-lg border px-2 font-mono text-sm font-semibold transition-colors ${
        selected
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-ink hover:bg-surface-muted"
      } ${isDragging ? "z-10 shadow-lg" : ""} disabled:opacity-40`}
    >
      {gate === "TOFFOLI" ? "CCX" : gate}
      <span className="sr-only">. {GATE_HELP[gate]}</span>
    </button>
  );
}

function Wire({
  q,
  numQubits,
  ops,
  armed,
  onPlace,
  onRemove,
  onFlip,
}: {
  q: number;
  numQubits: number;
  ops: Operation[];
  armed: GateName | null;
  onPlace: (q: number) => void;
  onRemove: (index: number) => void;
  onFlip: (index: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `wire-${q}`, data: { q } });
  return (
    <div
      ref={setNodeRef}
      className={`relative flex h-14 items-center gap-1 rounded-lg px-1 transition-colors ${
        isOver ? "bg-accent-soft" : ""
      }`}
    >
      <span className="text-ink-muted w-14 shrink-0 font-mono text-sm">
        q{q} <span className="text-zero">|0⟩</span>
      </span>
      <div className="relative flex flex-1 items-center gap-1">
        <div
          className="bg-ink-muted/60 absolute inset-x-0 top-1/2 h-px"
          aria-hidden="true"
        />
        {ops.map((op, i) => {
          const role = op.qubits.indexOf(q);
          const involved = role !== -1;
          const multi = op.qubits.length > 1;
          // Standard circuit notation: ● control, ⊕ target, × for SWAP, ● on both wires for CZ.
          const glyph: Glyph | null = !multi
            ? null
            : op.gate === "SWAP"
              ? "swap"
              : op.gate === "CZ" || role < op.qubits.length - 1
                ? "control"
                : "target";
          return (
            <div
              key={i}
              className="relative z-[1] flex w-11 shrink-0 justify-center"
            >
              {involved ? (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  onContextMenu={(e) => {
                    if (multi) {
                      e.preventDefault();
                      onFlip(i);
                    }
                  }}
                  aria-label={`${op.gate} on ${op.qubits.map((x) => `q${x}`).join(", ")}, step ${i + 1}. Activate to remove.`}
                  className={`flex h-10 w-10 items-center justify-center rounded-md font-mono text-sm font-semibold ${
                    glyph
                      ? "text-accent"
                      : "border-accent/40 bg-surface text-ink shadow-card border"
                  } hover:bg-danger-soft`}
                >
                  {glyph ? <GateGlyph kind={glyph} /> : op.gate}
                </button>
              ) : multi &&
                q > Math.min(...op.qubits) &&
                q < Math.max(...op.qubits) ? (
                <div className="bg-accent h-14 w-0.5" aria-hidden="true" />
              ) : (
                <div className="h-10 w-10" aria-hidden="true" />
              )}
              {/* Vertical connector between the qubits of a multi-qubit gate */}
              {multi && involved && q !== Math.max(...op.qubits) && (
                <div
                  className="bg-accent absolute top-1/2 left-1/2 h-14 w-0.5 -translate-x-1/2"
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onPlace(q)}
          disabled={!armed}
          aria-label={
            armed
              ? `Place ${armed} on q${q}`
              : `Wire q${q}: choose a gate first`
          }
          className={`relative z-[1] ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed text-lg ${
            armed
              ? "border-accent text-accent hover:bg-accent-soft"
              : "border-border text-ink-muted/60"
          }`}
        >
          +
        </button>
      </div>
      {numQubits > 0 && <span className="sr-only">End of wire q{q}</span>}
    </div>
  );
}

/**
 * Drag-and-drop circuit builder with live probabilities. Gates can also be placed by
 * clicking/tapping a gate and then a wire's "+" slot, which works with a keyboard too.
 */
export default function CircuitSandbox({
  numQubits,
  allowedGates,
  initialOps = [],
  showBloch = false,
  puzzle,
  onCheck,
  onChange,
  maxOps = 12,
}: CircuitSandboxProps) {
  const [ops, setOps] = useState<Operation[]>(initialOps);
  const [armed, setArmed] = useState<GateName | null>(null);
  const [feedback, setFeedback] = useState<PuzzleFeedback | null>(null);
  const [failures, setFailures] = useState(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const circuit: Circuit = useMemo(
    () => ({ numQubits, ops }),
    [numQubits, ops],
  );
  const state = useMemo(() => runCircuit(circuit), [circuit]);
  const probs = probabilities(state);

  const update = (next: Operation[]) => {
    setOps(next);
    setFeedback(null);
    onChange?.({ numQubits, ops: next });
  };

  const place = (gate: GateName, q: number) => {
    if (ops.length >= maxOps) return;
    if (ARITY[gate] > numQubits) return;
    update([...ops, { gate, qubits: placement(gate, q, numQubits) }]);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const gate = e.active.data.current?.gate as GateName | undefined;
    const q = e.over?.data.current?.q as number | undefined;
    if (gate && q !== undefined) place(gate, q);
  };

  const flip = (i: number) =>
    update(
      ops.map((op, k) =>
        k === i ? { ...op, qubits: [...op.qubits].reverse() } : op,
      ),
    );

  const check = () => {
    if (!puzzle) return;
    const result = checkPuzzle(puzzle, circuit);
    setFeedback(result);
    if (!result.solved && result.reason !== "empty") setFailures((f) => f + 1);
    onCheck?.(result, circuit);
  };

  const hint =
    puzzle && failures > 0
      ? puzzle.hints[Math.min(failures, puzzle.hints.length) - 1]
      : undefined;

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div>
          <p className="text-ink-muted mb-2 text-sm" id="palette-help">
            Drag a gate onto a wire, or tap a gate and then a{" "}
            <span className="font-mono">+</span>.
            {numQubits > 1 &&
              " Two-qubit gates use the wire you choose as the control; right-click one to swap its control and target."}
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="toolbar"
            aria-label="Gates"
            aria-describedby="palette-help"
          >
            {allowedGates.map((g) => (
              <PaletteGate
                key={g}
                gate={g}
                selected={armed === g}
                disabled={ARITY[g] > numQubits}
                onSelect={() => setArmed(armed === g ? null : g)}
              />
            ))}
          </div>
        </div>

        <div
          className="border-border bg-surface overflow-x-auto rounded-xl border p-2"
          aria-label="Circuit"
        >
          {Array.from({ length: numQubits }, (_, q) => (
            <Wire
              key={q}
              q={q}
              numQubits={numQubits}
              ops={ops}
              armed={armed}
              onPlace={(qq) => armed && place(armed, qq)}
              onRemove={(i) => update(ops.filter((_, k) => k !== i))}
              onFlip={flip}
            />
          ))}
        </div>
      </DndContext>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => update(ops.slice(0, -1))}
          disabled={!ops.length}
        >
          Undo
        </Button>
        <Button
          variant="secondary"
          onClick={() => update(initialOps)}
          disabled={ops === initialOps}
        >
          Reset
        </Button>
        {ops.some((op) => op.qubits.length === 2) && (
          <Button
            variant="ghost"
            onClick={() =>
              flip(ops.findLastIndex((op) => op.qubits.length === 2))
            }
          >
            Swap last control ↔ target
          </Button>
        )}
      </div>

      <div
        className={`grid gap-4 ${showBloch ? "sm:grid-cols-[1fr_auto]" : ""}`}
      >
        <ProbabilityBars
          probabilities={probs}
          numQubits={numQubits}
          caption="Chance of each result if you measured all qubits now."
        />
        {showBloch && (
          <div className="flex justify-center gap-3">
            {Array.from({ length: numQubits }, (_, q) => (
              <BlochMini
                key={q}
                vector={blochVector(state, q)}
                label={`q${q}`}
              />
            ))}
          </div>
        )}
      </div>

      {puzzle && (
        <div className="space-y-2">
          <Button onClick={check}>Check my circuit</Button>
          <div aria-live="polite">
            {feedback && (
              <p
                className={`rounded-lg p-3 text-[0.95rem] ${
                  feedback.solved
                    ? "bg-success-soft text-success"
                    : "bg-surface-muted text-ink"
                }`}
              >
                <span aria-hidden="true">{feedback.solved ? "✓ " : "↻ "}</span>
                {feedback.message}
              </p>
            )}
            {!feedback?.solved && hint && (
              <p className="text-ink-muted mt-2 text-sm">
                <span className="font-semibold">Hint:</span> {hint}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
