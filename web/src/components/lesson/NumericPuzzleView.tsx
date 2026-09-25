"use client";

import { useId, useState } from "react";
import type { NumericPuzzle } from "@/lib/content/types";
import { WithKets } from "@/components/ui/Ket";
import { Button } from "@/components/ui/Button";

export function isNumericAnswerCorrect(
  puzzle: NumericPuzzle,
  input: string,
): boolean {
  // Accept "0.5", ".5", "1/2" and "50%".
  const text = input.trim().replace(",", ".");
  let value: number;
  if (/^-?\d+(\.\d+)?\s*%$/.test(text)) value = parseFloat(text) / 100;
  else if (/^-?\d+\s*\/\s*\d+$/.test(text)) {
    const [a, b] = text.split("/").map(Number);
    value = a / b;
  } else value = Number(text);
  return (
    Number.isFinite(value) &&
    Math.abs(value - puzzle.answer) <= puzzle.tolerance + 1e-12
  );
}

export default function NumericPuzzleView({
  puzzle,
  onAttempt,
}: {
  puzzle: NumericPuzzle;
  onAttempt?: (solved: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [failures, setFailures] = useState(0);
  const id = useId();

  const check = () => {
    const ok = isNumericAnswerCorrect(puzzle, value);
    setResult(ok);
    if (!ok) setFailures((f) => f + 1);
    onAttempt?.(ok);
  };

  const hint =
    failures > 0
      ? puzzle.hints[Math.min(failures, puzzle.hints.length) - 1]
      : undefined;

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-lg leading-snug font-semibold">
        <WithKets text={puzzle.prompt} />
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && value && check()}
          className="border-border bg-surface h-11 w-40 rounded-lg border px-3 font-mono text-lg"
          placeholder="Your answer"
        />
        <Button onClick={check} disabled={!value.trim()}>
          Check
        </Button>
      </div>
      <div aria-live="polite">
        {result === true && (
          <p className="bg-success-soft text-success rounded-lg p-3">
            ✓ Correct!
          </p>
        )}
        {result === false && (
          <p className="bg-surface-muted rounded-lg p-3">
            ↻ Not quite.{" "}
            {hint ? (
              <>
                <span className="font-semibold">Hint:</span> {hint}
              </>
            ) : (
              "Try again."
            )}
          </p>
        )}
      </div>
    </div>
  );
}
