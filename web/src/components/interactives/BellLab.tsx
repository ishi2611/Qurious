"use client";

import { useState } from "react";
import {
  agreement,
  Basis,
  BELL_LABELS,
  BellKind,
  fractionOfOnes,
  Round,
  runRounds,
} from "@/lib/bell";
import { Button } from "@/components/ui/Button";

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm ${
              value === o.value
                ? "border-accent bg-accent-soft text-accent font-semibold"
                : "border-border bg-surface"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const BASES: { value: Basis; label: string }[] = [
  { value: "Z", label: "0/1 basis" },
  { value: "X", label: "+/− basis" },
];

function Tally({ rounds }: { rounds: Round[] }) {
  const counts = { "00": 0, "01": 0, "10": 0, "11": 0 } as Record<
    string,
    number
  >;
  for (const r of rounds) counts[`${r.alice}${r.bob}`]++;
  return (
    <table className="w-full text-sm">
      <caption className="text-ink-muted mb-1 text-left">
        {rounds.length} pairs · results agree{" "}
        {Math.round(agreement(rounds) * 100)}% of the time
      </caption>
      <thead>
        <tr className="text-ink-muted text-left">
          <th className="py-1 font-medium">Alice, Bob</th>
          <th className="py-1 font-medium">Count</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {Object.entries(counts).map(([k, v]) => (
          <tr key={k} className="border-border border-t">
            <td className="py-1">
              {k[0]}, {k[1]}
            </td>
            <td className="py-1 tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Correlations mode: choose a Bell state and bases, run many pairs, and look at the joint results. */
function Correlations() {
  const [kind, setKind] = useState<BellKind>("phi+");
  const [basis, setBasis] = useState<Basis>("Z");
  const [rounds, setRounds] = useState<Round[]>([]);
  return (
    <div className="space-y-4">
      <Segmented
        label="Bell state"
        value={kind}
        onChange={(v) => {
          setKind(v);
          setRounds([]);
        }}
        options={(Object.keys(BELL_LABELS) as BellKind[]).map((k) => ({
          value: k,
          label: BELL_LABELS[k],
        }))}
      />
      <Segmented
        label="Both measure in the"
        value={basis}
        onChange={(v) => {
          setBasis(v);
          setRounds([]);
        }}
        options={BASES}
      />
      <Button onClick={() => setRounds(runRounds(kind, basis, basis, 100))}>
        Measure 100 pairs
      </Button>
      <div aria-live="polite">
        {rounds.length > 0 && <Tally rounds={rounds} />}
      </div>
    </div>
  );
}

type AliceChoice = Basis | "none";

interface Batch {
  alice: AliceChoice;
  rounds: Round[];
}

/**
 * No-signal mode: you are Alice. Each batch you pick how (or whether) to measure. Bob always
 * measures in the 0/1 basis and only sees his own results, until you "compare notes."
 */
function NoSignal() {
  const [choice, setChoice] = useState<AliceChoice>("Z");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [compared, setCompared] = useState(false);

  const run = () => {
    // Alice not measuring is simulated as a Z measurement whose result nobody looks at;
    // Bob's statistics are identical either way.
    const rounds = runRounds("phi+", choice === "none" ? "Z" : choice, "Z", 50);
    setBatches((b) => [...b, { alice: choice, rounds }]);
    setCompared(false);
  };

  const label = (c: AliceChoice) =>
    c === "Z" ? "0/1 basis" : c === "X" ? "+/− basis" : "didn't measure";

  return (
    <div className="space-y-4">
      <Segmented
        label="You are Alice. For the next 50 pairs, you will…"
        value={choice}
        onChange={setChoice}
        options={[
          { value: "Z", label: "measure 0/1" },
          { value: "X", label: "measure +/−" },
          { value: "none", label: "not measure" },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={run}>Run 50 pairs</Button>
        <Button
          variant="secondary"
          onClick={() => setCompared(true)}
          disabled={!batches.length || compared}
        >
          Compare notes with Bob
        </Button>
        <Button
          variant="ghost"
          onClick={() => setBatches([])}
          disabled={!batches.length}
        >
          Clear
        </Button>
      </div>

      {batches.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm" aria-live="polite">
            <thead>
              <tr className="text-ink-muted text-left">
                <th className="py-1 font-medium">Batch</th>
                <th className="py-1 font-medium">Alice</th>
                <th className="py-1 font-medium">What Bob sees: his 1s</th>
                {compared && <th className="py-1 font-medium">Agreement</th>}
              </tr>
            </thead>
            <tbody>
              {batches.map((b, i) => (
                <tr key={i} className="border-border border-t">
                  <td className="py-1.5 font-mono">{i + 1}</td>
                  <td className="py-1.5">{label(b.alice)}</td>
                  <td className="py-1.5 font-mono tabular-nums">
                    {Math.round(
                      fractionOfOnes(b.rounds.map((r) => r.bob)) * 100,
                    )}
                    %
                  </td>
                  {compared && (
                    <td className="py-1.5 font-mono tabular-nums">
                      {b.alice === "none"
                        ? "n/a"
                        : `${Math.round(agreement(b.rounds) * 100)}%`}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[0.95rem]">
            {compared
              ? "With both lists side by side, the pattern appears: same basis → results match every time; different bases → about 50%. But that took both lists."
              : "Bob's column hovers around 50% no matter what you choose. From his side, nothing changes."}
          </p>
        </div>
      )}
    </div>
  );
}

export default function BellLab({
  mode = "correlations",
}: {
  mode?: "correlations" | "no_signal";
}) {
  return mode === "no_signal" ? <NoSignal /> : <Correlations />;
}
