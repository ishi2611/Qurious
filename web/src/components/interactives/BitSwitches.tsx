"use client";

import { useState } from "react";

function Switch({
  name,
  value,
  onToggle,
}: {
  name: string;
  value: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value === 1}
      aria-label={`Input ${name}`}
      onClick={onToggle}
      className="flex flex-col items-center gap-1"
    >
      <span className="text-ink-muted text-sm">{name}</span>
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-xl border-2 font-mono text-2xl font-semibold transition-colors ${
          value
            ? "border-one bg-one-soft text-one"
            : "border-zero bg-zero-soft text-zero"
        }`}
      >
        {value}
      </span>
      <span className="text-ink-muted text-xs">tap to flip</span>
    </button>
  );
}

/** Two input bits, their AND and XOR, and which inputs share the same AND output. */
export default function BitSwitches() {
  const [bits, setBits] = useState<[number, number]>([0, 0]);
  const [a, b] = bits;
  const and = a & b;
  const xor = a ^ b;
  const sameAnd = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ].filter(([x, y]) => (x & y) === and);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-center gap-6">
        <Switch
          name="a"
          value={a}
          onToggle={() => setBits(([x, y]) => [1 - x, y])}
        />
        <Switch
          name="b"
          value={b}
          onToggle={() => setBits(([x, y]) => [x, 1 - y])}
        />
        <span aria-hidden="true" className="text-ink-muted text-2xl">
          →
        </span>
        <dl className="grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-2 font-mono">
          <dt className="text-ink-muted text-sm">a AND b</dt>
          <dd
            className={`text-2xl font-semibold ${and ? "text-one" : "text-zero"}`}
          >
            {and}
          </dd>
          <dt className="text-ink-muted text-sm">a XOR b</dt>
          <dd
            className={`text-2xl font-semibold ${xor ? "text-one" : "text-zero"}`}
          >
            {xor}
          </dd>
        </dl>
      </div>
      <p
        className="bg-surface-muted rounded-lg p-3 text-[0.95rem]"
        aria-live="polite"
      >
        AND gives <span className="font-mono font-semibold">{and}</span> for{" "}
        {sameAnd.length === 1
          ? "only one input: "
          : `${sameAnd.length} different inputs: `}
        <span className="font-mono">
          {sameAnd.map(([x, y]) => `${x}${y}`).join(", ")}
        </span>
        .
        {sameAnd.length > 1 &&
          " From the output alone, you can't tell which one it was."}
      </p>
    </div>
  );
}
