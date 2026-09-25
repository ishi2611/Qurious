"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Number of heads in n flips of a coin with P(heads) = p. */
function countHeads(n: number, p: number): number {
  let heads = 0;
  for (let i = 0; i < n; i++) if (Math.random() < p) heads++;
  return heads;
}

/** A weighted coin: set the bias, flip many times, and watch the fraction settle. */
export default function CoinSampler({
  initial_p = 0.5,
}: {
  initial_p?: number;
}) {
  const [p, setP] = useState(initial_p);
  const [heads, setHeads] = useState(0);
  const [tails, setTails] = useState(0);
  const total = heads + tails;

  const flip = (n: number) => {
    const h = countHeads(n, p);
    setHeads((x) => x + h);
    setTails((x) => x + n - h);
  };

  const reset = () => {
    setHeads(0);
    setTails(0);
  };

  const frac = total ? heads / total : 0;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="flex justify-between text-sm font-medium">
          Chance of heads{" "}
          <span className="font-mono">{Math.round(p * 100)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(p * 100)}
          onChange={(e) => {
            setP(Number(e.target.value) / 100);
            reset();
          }}
          className="mt-1 w-full accent-[var(--accent-solid)]"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {[10, 100, 1000].map((n) => (
          <Button key={n} variant="secondary" onClick={() => flip(n)}>
            Flip {n}×
          </Button>
        ))}
        <Button variant="ghost" onClick={reset} disabled={!total}>
          Reset
        </Button>
      </div>
      <div aria-live="polite" className="space-y-2">
        <div
          className="bg-surface-muted flex h-8 overflow-hidden rounded-lg"
          role="img"
          aria-label={`${heads} heads, ${tails} tails`}
        >
          <div
            className="bg-zero transition-[width] duration-200"
            style={{ width: `${frac * 100}%` }}
          />
          <div
            className="hatch-one transition-[width] duration-200"
            style={{ width: `${total ? (1 - frac) * 100 : 0}%` }}
          />
        </div>
        <p className="text-[0.95rem]">
          {total === 0 ? (
            "No flips yet."
          ) : (
            <>
              <span className="font-mono">{heads}</span> heads,{" "}
              <span className="font-mono">{tails}</span> tails out of{" "}
              <span className="font-mono">{total}</span>: heads came up{" "}
              <strong className="font-mono">{(frac * 100).toFixed(1)}%</strong>{" "}
              of the time (the true chance is {Math.round(p * 100)}%).
            </>
          )}
        </p>
      </div>
    </div>
  );
}
