"use client";

import { useState } from "react";
import Ket from "@/components/ui/Ket";
import ProbabilityBars from "@/components/ui/ProbabilityBars";

const fmt = (x: number) => (Math.abs(x) < 0.005 ? "0.00" : x.toFixed(2));

function Signed({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-2">
      <Ket label={label} className="text-sm" />
      <div className="bg-surface-muted relative h-3 rounded-full">
        <div
          className="bg-ink-muted absolute top-0 left-1/2 h-full w-px"
          aria-hidden="true"
        />
        <div
          className={`absolute top-0 h-full rounded-full ${label === "0" ? "bg-zero" : "hatch-one"}`}
          style={{
            left: value >= 0 ? "50%" : `${50 + value * 50}%`,
            width: `${Math.abs(value) * 50}%`,
          }}
        />
      </div>
      <span className="text-right font-mono text-sm tabular-nums">
        {fmt(value)}
      </span>
    </div>
  );
}

/**
 * A dial sets real amplitudes α = cos t, β = sin t (so they're always normalized, and can be
 * negative). Shows the signed amplitudes and, separately, their squares, the probabilities.
 */
export default function AmplitudeBars() {
  const [deg, setDeg] = useState(45);
  const t = (deg * Math.PI) / 180;
  const alpha = Math.cos(t);
  const beta = Math.sin(t);

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="flex justify-between text-sm font-medium">
          Dial <span className="font-mono">{deg}°</span>
        </span>
        <input
          type="range"
          min={0}
          max={359}
          value={deg}
          onChange={(e) => setDeg(Number(e.target.value))}
          className="mt-1 w-full accent-[var(--accent-solid)]"
        />
      </label>
      <p className="text-center font-mono text-lg" aria-live="polite">
        |ψ⟩ = <span className="text-zero">{fmt(alpha)}</span>|0⟩{" "}
        {beta < 0 ? "−" : "+"}{" "}
        <span className="text-one">{fmt(Math.abs(beta))}</span>|1⟩
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <section>
          <h4 className="mb-2 text-sm font-semibold">
            Amplitudes (can be negative)
          </h4>
          <div className="space-y-1.5">
            <Signed value={alpha} label="0" />
            <Signed value={beta} label="1" />
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-sm font-semibold">
            Probabilities (amplitude²)
          </h4>
          <ProbabilityBars
            probabilities={[alpha * alpha, beta * beta]}
            numQubits={1}
          />
        </section>
      </div>
      <p className="text-ink-muted text-sm">
        Check: {fmt(alpha)}² + {fmt(beta)}² ={" "}
        {(alpha * alpha + beta * beta).toFixed(2)}. The squares always add up to
        1.
      </p>
    </div>
  );
}
