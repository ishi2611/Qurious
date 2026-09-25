"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  applyOperation,
  blochVector,
  c,
  expi,
  GateName,
  measureQubit,
  probabilities,
  StateVector,
} from "@/lib/quantum";
import ProbabilityBars from "@/components/ui/ProbabilityBars";
import { Button } from "@/components/ui/Button";

const BlochScene = dynamic(() => import("./BlochScene"), {
  ssr: false,
  loading: () => (
    <div className="text-ink-muted flex h-full items-center justify-center text-sm">
      Loading the sphere…
    </div>
  ),
});

export interface BlochSphereProps {
  /** "polar" shows only the north–south angle; "full" adds the phase angle. */
  mode?: "polar" | "full";
  gates?: GateName[];
  show_probabilities?: boolean;
  allow_measure?: boolean;
}

const DEG = Math.PI / 180;

/** cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩ */
function stateFromAngles(theta: number, phi: number): StateVector {
  const e = expi(phi);
  const s = Math.sin(theta / 2);
  return [c(Math.cos(theta / 2)), c(e.re * s, e.im * s)];
}

function anglesFromState(state: StateVector) {
  const v = blochVector(state, 0);
  const theta = Math.acos(Math.max(-1, Math.min(1, v.z)));
  let phi = Math.atan2(v.y, v.x);
  if (phi < 0) phi += 2 * Math.PI;
  // At the poles the phase is meaningless; keep it at 0 so the slider doesn't jump around.
  if (Math.sin(theta) < 1e-6) phi = 0;
  return { theta, phi };
}

export default function BlochSphere({
  mode = "polar",
  gates = [],
  show_probabilities = true,
  allow_measure = false,
}: BlochSphereProps) {
  const [state, setState] = useState<StateVector>(() => stateFromAngles(0, 0));
  const [lastResult, setLastResult] = useState<string | null>(null);
  const { theta, phi } = useMemo(() => anglesFromState(state), [state]);
  const vector = blochVector(state, 0);
  const probs = probabilities(state);

  const setAngles = (t: number, p: number) => {
    setState(stateFromAngles(t, p));
    setLastResult(null);
  };

  const apply = (gate: GateName) => {
    setState((s) => applyOperation(s, { gate, qubits: [0] }));
    setLastResult(null);
  };

  const measure = () => {
    const { outcome, state: after } = measureQubit(state, 0);
    setState(after);
    setLastResult(
      `You measured ${outcome}. The qubit is now |${outcome}⟩, so the arrow jumped to the ${outcome ? "south" : "north"} pole.`,
    );
  };

  const description = `Arrow ${Math.round(theta / DEG)}° down from |0⟩${
    mode === "full"
      ? `, turned ${Math.round(phi / DEG)}° around the equator`
      : ""
  }. Chance of reading 0: ${Math.round(probs[0] * 100)}%.`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
        <div
          className="bg-surface-muted aspect-square w-full max-w-xs justify-self-center rounded-xl"
          role="img"
          aria-label={`Bloch sphere. ${description}`}
        >
          <BlochScene vector={vector} />
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="flex justify-between text-sm font-medium">
              Tilt from |0⟩ (θ){" "}
              <span className="font-mono">{Math.round(theta / DEG)}°</span>
            </span>
            <input
              type="range"
              min={0}
              max={180}
              step={1}
              value={Math.round(theta / DEG)}
              onChange={(e) => setAngles(Number(e.target.value) * DEG, phi)}
              className="mt-1 w-full accent-[var(--accent-solid)]"
            />
          </label>
          {mode === "full" && (
            <label className="block">
              <span className="flex justify-between text-sm font-medium">
                Phase (φ){" "}
                <span className="font-mono">{Math.round(phi / DEG)}°</span>
              </span>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={Math.round(phi / DEG) % 360}
                onChange={(e) => setAngles(theta, Number(e.target.value) * DEG)}
                className="mt-1 w-full accent-[var(--accent-solid)]"
              />
            </label>
          )}
          {gates.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Apply a gate"
            >
              {gates.map((g) => (
                <Button
                  key={g}
                  variant="secondary"
                  onClick={() => apply(g)}
                  className="font-mono"
                >
                  {g}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {allow_measure && <Button onClick={measure}>Measure</Button>}
            <Button variant="ghost" onClick={() => setAngles(0, 0)}>
              Reset to |0⟩
            </Button>
          </div>
        </div>
      </div>

      {show_probabilities && (
        <ProbabilityBars
          probabilities={probs}
          numQubits={1}
          caption={description}
        />
      )}
      <p aria-live="polite" className="text-ink min-h-6 text-[0.95rem]">
        {lastResult}
      </p>
    </div>
  );
}
