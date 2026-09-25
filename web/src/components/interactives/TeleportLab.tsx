"use client";

import { useMemo, useState } from "react";
import { blochVector } from "@/lib/quantum";
import {
  bobBlindVector,
  fidelity,
  runTeleportation,
  TeleportSnapshot,
} from "@/lib/teleport";
import BlochMini from "./BlochMini";
import { Button } from "@/components/ui/Button";

const STEPS = [
  {
    title: "1. Alice's unknown qubit",
    text: "Alice has a qubit in some state |ψ⟩. You set it with the sliders; Alice herself doesn't need to know it.",
  },
  {
    title: "2. Share an entangled pair",
    text: "Ahead of time, Alice and Bob made a Bell pair and each took one half. Bob's half is just a fair coin on its own.",
  },
  {
    title: "3. Alice entangles and measures",
    text: "Alice applies CNOT (her unknown qubit controls her half of the pair), then H, then measures both of her qubits. She gets two random bits.",
  },
  {
    title: "4. Alice sends two ordinary bits",
    text: "She sends Bob the two bits by any normal channel: phone, radio, light. Until they arrive, Bob's qubit tells him nothing.",
  },
  {
    title: "5. Bob corrects",
    text: "Bob applies X if the second bit is 1, then Z if the first bit is 1. His qubit is now exactly |ψ⟩.",
  },
] as const;

/**
 * Guided teleportation, used both in the lesson (mode "guided") and as the reward for
 * "Is quantum teleportation real teleportation?" (mode "reward", which adds a fidelity check).
 */
export default function TeleportLab({
  mode = "guided",
}: {
  mode?: "guided" | "reward";
}) {
  const [theta, setTheta] = useState(70);
  const [phi, setPhi] = useState(40);
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);

  const snapshots: TeleportSnapshot[] = useMemo(
    () => runTeleportation((theta * Math.PI) / 180, (phi * Math.PI) / 180),
    // `run` re-randomizes Alice's measurement results on each new run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theta, phi, run],
  );

  const original = blochVector(snapshots[0].state, 0);
  const bits = snapshots[3].bits!;
  const stageIndex = [0, 1, 3, 3, 4][step];
  const current = snapshots[stageIndex];
  const aliceVec = blochVector(current.state, 0);
  // Before step 5, show what Bob can actually know without Alice's bits.
  const bobVec =
    step < 4 ? bobBlindVector(snapshots) : blochVector(current.state, 2);
  const f = fidelity(original, blochVector(snapshots[4].state, 2));

  const restart = () => {
    setStep(0);
    setRun((r) => r + 1);
  };

  return (
    <div className="space-y-5">
      <fieldset
        disabled={step > 0}
        className="grid gap-3 disabled:opacity-60 sm:grid-cols-2"
      >
        <legend className="sr-only">Choose Alice&apos;s state</legend>
        <label>
          <span className="flex justify-between text-sm font-medium">
            Tilt (θ) <span className="font-mono">{theta}°</span>
          </span>
          <input
            type="range"
            min={0}
            max={180}
            value={theta}
            onChange={(e) => setTheta(Number(e.target.value))}
            className="w-full accent-[var(--accent-solid)]"
          />
        </label>
        <label>
          <span className="flex justify-between text-sm font-medium">
            Phase (φ) <span className="font-mono">{phi}°</span>
          </span>
          <input
            type="range"
            min={0}
            max={359}
            value={phi}
            onChange={(e) => setPhi(Number(e.target.value))}
            className="w-full accent-[var(--accent-solid)]"
          />
        </label>
      </fieldset>

      <div className="border-border bg-surface grid grid-cols-3 items-start gap-2 rounded-xl border p-3">
        <div className="text-center">
          <p className="text-ink-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            Original |ψ⟩
          </p>
          <BlochMini vector={original} label="target" />
        </div>
        <div className="text-center">
          <p className="text-ink-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            Alice&apos;s qubit
          </p>
          <BlochMini vector={aliceVec} label="Alice" />
        </div>
        <div className="text-center">
          <p className="text-ink-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            Bob&apos;s qubit
          </p>
          <BlochMini vector={bobVec} label="Bob" />
        </div>
      </div>

      <ol className="space-y-2">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-lg p-3 ${i === step ? "bg-accent-soft" : i < step ? "opacity-70" : "opacity-40"}`}
          >
            <p className="font-semibold">{s.title}</p>
            {i <= step && (
              <p className="mt-0.5 text-[0.95rem] leading-relaxed">{s.text}</p>
            )}
            {i === 3 && step >= 3 && (
              <p className="mt-1 font-mono text-[0.95rem]">
                Alice&apos;s bits: m₁ = {bits.m1}, m₂ = {bits.m2} → Bob will
                apply{" "}
                {[bits.m2 ? "X" : null, bits.m1 ? "Z" : null]
                  .filter(Boolean)
                  .join(" then ") || "nothing"}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2" aria-live="polite">
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Next step</Button>
        ) : (
          <Button onClick={restart}>Teleport again</Button>
        )}
        {step > 0 && step < STEPS.length - 1 && (
          <Button variant="ghost" onClick={restart}>
            Start over
          </Button>
        )}
      </div>

      {step === STEPS.length - 1 && (
        <p
          className={`rounded-lg p-3 text-[0.95rem] ${mode === "reward" ? "bg-success-soft" : "bg-surface-muted"}`}
        >
          Bob&apos;s qubit matches the original with fidelity{" "}
          <strong className="font-mono">{(f * 100).toFixed(1)}%</strong>.
          Alice&apos;s qubit ended up as a plain |{bits.m1}⟩: her copy is gone,
          so nothing was cloned.
          {mode === "reward" &&
            " You just teleported a qubit. Try a different state, and notice Bob's arrow is always a dot until the bits arrive."}
        </p>
      )}
    </div>
  );
}
