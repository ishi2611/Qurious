"use client";

import { useId, useState } from "react";
import type { Check } from "@/lib/content/types";
import { WithKets } from "@/components/ui/Ket";
import { Button } from "@/components/ui/Button";

const LETTERS = ["A", "B", "C", "D", "E"];

/**
 * One multiple-choice check. Correct → explanation and Continue. Wrong → the lesson's
 * alternate explanation (if given), then a retry of the same question.
 */
export default function CheckQuestion({
  check,
  altExplanation,
  onResult,
  onContinue,
  continueLabel = "Continue",
  mode = "lesson",
}: {
  check: Check;
  altExplanation?: string;
  onResult?: (correct: boolean, attempt: number) => void;
  onContinue: () => void;
  continueLabel?: string;
  /** "diagnostic": one attempt, then show the answer and move on (no retry). */
  mode?: "lesson" | "diagnostic";
}) {
  const diagnostic = mode === "diagnostic";
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const name = useId();
  const correct = submitted && selected === check.answer;

  const submit = () => {
    if (selected === null) return;
    const attempt = attempts + 1;
    setAttempts(attempt);
    setSubmitted(true);
    onResult?.(selected === check.answer, attempt);
  };

  const retry = () => {
    setSelected(null);
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-3 text-lg leading-snug font-semibold">
          <WithKets text={check.question} />
        </legend>
        <div className="space-y-2">
          {check.options.map((option, i) => {
            const isSelected = selected === i;
            const showRight =
              submitted && (correct || diagnostic) && i === check.answer;
            const showWrong = submitted && isSelected && !correct;
            return (
              <label
                key={i}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
                  showRight
                    ? "border-success bg-success-soft"
                    : showWrong
                      ? "border-danger bg-danger-soft"
                      : isSelected
                        ? "border-accent bg-accent-soft"
                        : "border-border bg-surface hover:border-ink-muted/40"
                } ${submitted ? "cursor-default" : ""}`}
              >
                <input
                  type="radio"
                  name={name}
                  value={i}
                  checked={isSelected}
                  disabled={submitted}
                  onChange={() => setSelected(i)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current font-mono text-sm"
                >
                  {showRight ? "✓" : showWrong ? "✗" : LETTERS[i]}
                </span>
                <span className="pt-0.5 leading-snug">
                  <WithKets text={option} />
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite" className="space-y-3">
        {submitted && correct && (
          <div className="bg-success-soft rounded-xl p-4">
            <p className="text-success font-semibold">✓ Correct</p>
            <p className="mt-1 leading-relaxed">
              <WithKets text={check.explanation} />
            </p>
          </div>
        )}
        {submitted && !correct && diagnostic && (
          <div className="bg-surface-muted rounded-xl p-4">
            <p className="font-semibold">
              No problem, we&apos;ll cover this on your path.
            </p>
            <p className="mt-1 leading-relaxed">
              <WithKets text={check.explanation} />
            </p>
          </div>
        )}
        {submitted && !correct && !diagnostic && (
          <div className="bg-danger-soft space-y-3 rounded-xl p-4">
            <p className="text-danger font-semibold">✗ Not quite</p>
            {altExplanation && (
              <div>
                <p className="text-sm font-semibold">
                  Here&apos;s another way to see it
                </p>
                <p className="mt-1 leading-relaxed">
                  <WithKets text={altExplanation} />
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!submitted && (
          <Button onClick={submit} disabled={selected === null}>
            Check answer
          </Button>
        )}
        {submitted && !correct && !diagnostic && (
          <Button onClick={retry}>Try again</Button>
        )}
        {submitted && (correct || diagnostic) && (
          <Button onClick={onContinue}>{continueLabel}</Button>
        )}
      </div>
    </div>
  );
}
