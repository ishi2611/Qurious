"use client";

import { useState } from "react";
import {
  c,
  measureQubit,
  probabilities,
  sampleCounts,
  StateVector,
} from "@/lib/quantum";
import ProbabilityBars from "@/components/ui/ProbabilityBars";
import { Button } from "@/components/ui/Button";

const prepare = (theta: number): StateVector => [
  c(Math.cos(theta / 2)),
  c(Math.sin(theta / 2)),
];

/**
 * Prepare a qubit, measure it (and watch the state collapse), measure again, or run many
 * fresh copies to see the Born-rule odds emerge.
 */
export default function MeasurementLab({
  initial_theta = Math.PI / 2,
}: {
  initial_theta?: number;
}) {
  const [theta, setTheta] = useState(initial_theta);
  const [state, setState] = useState<StateVector>(() => prepare(initial_theta));
  const [history, setHistory] = useState<number[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const collapsed = history.length > 0;
  const p0 = Math.cos(theta / 2) ** 2;

  const reset = (t = theta) => {
    setTheta(t);
    setState(prepare(t));
    setHistory([]);
    setCounts(null);
  };

  const measure = () => {
    const { outcome, state: after } = measureQubit(state, 0);
    setState(after);
    setHistory((h) => [...h, outcome]);
  };

  const manyCopies = () => {
    setCounts(sampleCounts(prepare(theta), 200));
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="flex justify-between text-sm font-medium">
          Prepared state{" "}
          <span className="font-mono">P(0) = {Math.round(p0 * 100)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={180}
          value={Math.round((theta * 180) / Math.PI)}
          onChange={(e) => reset((Number(e.target.value) * Math.PI) / 180)}
          className="mt-1 w-full accent-[var(--accent-solid)]"
        />
      </label>

      <ProbabilityBars
        probabilities={probabilities(state)}
        numQubits={1}
        highlight={collapsed ? history[history.length - 1] : undefined}
        caption={
          collapsed
            ? "The state after your measurement."
            : "The state before measuring."
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={measure}>
          {collapsed ? "Measure again" : "Measure"}
        </Button>
        <Button variant="secondary" onClick={() => reset()}>
          Prepare a fresh qubit
        </Button>
        <Button variant="ghost" onClick={manyCopies}>
          Measure 200 fresh copies
        </Button>
      </div>

      <div aria-live="polite" className="space-y-2 text-[0.95rem]">
        {collapsed && (
          <p>
            Results on this qubit:{" "}
            <span className="font-mono font-semibold">
              {history.join(", ")}
            </span>
            {history.length > 1 && history.every((x) => x === history[0])
              ? ". Same answer every time: after the first measurement, the qubit stays put."
              : "."}
          </p>
        )}
        {counts && (
          <p>
            200 fresh copies:{" "}
            <span className="font-mono">{counts["0"] ?? 0}</span> zeros and{" "}
            <span className="font-mono">{counts["1"] ?? 0}</span> ones, close to
            the predicted {Math.round(p0 * 100)}% / {Math.round((1 - p0) * 100)}
            %.
          </p>
        )}
      </div>
    </div>
  );
}
