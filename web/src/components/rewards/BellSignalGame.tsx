"use client";

import { useState } from "react";
import { fractionOfOnes, runRounds } from "@/lib/bell";
import { Button } from "@/components/ui/Button";

const PAIRS_PER_BIT = 40;

interface Attempt {
  message: number[];
  bobFractions: number[];
  decoded: number[];
}

/**
 * Reward for "Is entanglement faster than light?": the learner tries to send a 4-bit message to
 * Bob using only their choice of measurement basis on shared Bell pairs (0/1 basis for "0",
 * +/− basis for "1"), with Bob decoding from his results. It can't work, and the learner
 * sees exactly why.
 */
export default function BellSignalGame() {
  const [message, setMessage] = useState<number[]>([1, 0, 1, 1]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const send = () => {
    const bobFractions = message.map((bit) =>
      fractionOfOnes(
        runRounds("phi+", bit ? "X" : "Z", "Z", PAIRS_PER_BIT).map(
          (r) => r.bob,
        ),
      ),
    );
    // Bob's best strategy from his own data: guess "1" if he saw more 1s than 0s.
    const decoded = bobFractions.map((f) => (f > 0.5 ? 1 : 0));
    setAttempts((a) =>
      [{ message: [...message], bobFractions, decoded }, ...a].slice(0, 5),
    );
  };

  const last = attempts[0];
  const correct = last
    ? last.decoded.filter((b, i) => b === last.message[i]).length
    : 0;
  const totalBits = attempts.reduce((s, a) => s + a.message.length, 0);
  const totalCorrect = attempts.reduce(
    (s, a) => s + a.decoded.filter((b, i) => b === a.message[i]).length,
    0,
  );

  return (
    <div className="space-y-5">
      <p className="leading-relaxed">
        You and Bob share a big supply of entangled pairs. For each bit of your
        message you&apos;ll measure {PAIRS_PER_BIT} of your qubits: in the{" "}
        <strong>0/1 basis</strong> to send a 0, or the{" "}
        <strong>+/− basis</strong> to send a 1. Bob measures his halves and
        tries to read your message from his results. He can use any strategy he
        likes.
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Your message (tap a bit to flip it)
        </legend>
        <div className="flex gap-2">
          {message.map((bit, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Bit ${i + 1}: ${bit}. Tap to flip.`}
              onClick={() =>
                setMessage((m) => m.map((b, k) => (k === i ? 1 - b : b)))
              }
              className={`flex h-14 w-12 items-center justify-center rounded-lg border-2 font-mono text-xl font-semibold ${
                bit
                  ? "border-one bg-one-soft text-one"
                  : "border-zero bg-zero-soft text-zero"
              }`}
            >
              {bit}
            </button>
          ))}
        </div>
      </fieldset>

      <Button onClick={send}>Send the message</Button>

      <div aria-live="polite">
        {last && (
          <div className="border-border bg-surface space-y-3 rounded-xl border p-4">
            <p className="font-mono text-lg">
              You sent {last.message.join("")} → Bob read{" "}
              {last.decoded.join("")}
            </p>
            <ul className="text-ink-muted space-y-1 text-sm">
              {last.bobFractions.map((f, i) => (
                <li key={i}>
                  Bit {i + 1}: Bob saw 1 in {Math.round(f * 100)}% of his{" "}
                  {PAIRS_PER_BIT} results
                </li>
              ))}
            </ul>
            <p>
              {correct} of {last.message.length} bits right this time.{" "}
              {attempts.length > 1 &&
                `Across ${attempts.length} tries: ${Math.round((totalCorrect / totalBits) * 100)}% correct, about what a coin flip would get.`}
            </p>
          </div>
        )}
      </div>

      {attempts.length >= 2 && (
        <div className="bg-success-soft rounded-xl p-4 leading-relaxed">
          <p className="font-semibold">
            You&apos;ve found the answer to your question.
          </p>
          <p className="mt-1">
            However you choose to measure, Bob&apos;s results are a fair coin,
            around 50% ones every time. The correlations are real (compare notes
            and they appear), but comparing notes means sending your results the
            ordinary way. Entanglement can&apos;t carry a message faster than
            light.
          </p>
        </div>
      )}
    </div>
  );
}
