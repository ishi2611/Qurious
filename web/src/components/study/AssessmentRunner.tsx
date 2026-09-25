"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { WithKets } from "@/components/ui/Ket";
import { Button } from "@/components/ui/Button";

interface Item {
  id: string;
  question: string;
  options: string[];
}

/**
 * The pre/post-test: one question per screen, no feedback (so the test doesn't teach), time
 * per item recorded. Answers are graded on the server; the browser never sees the key.
 */
export default function AssessmentRunner({
  participantId,
  test,
  onDone,
}: {
  participantId: string;
  test: "pre" | "post";
  onDone: () => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [answers, setAnswers] = useState<
    { item_id: string; choice: number; ms: number }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shownAt = useRef(0);
  const name = useId();

  useEffect(() => {
    apiRequest<{ items: Item[] }>("/study/assessment")
      .then((res) => {
        setItems(res.items);
        shownAt.current = Date.now();
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Couldn't load the quiz."),
      );
  }, []);

  if (error)
    return (
      <p role="alert" className="bg-danger-soft rounded-lg p-4">
        {error}
      </p>
    );
  if (!items) return <p className="text-ink-muted">Loading the quiz…</p>;

  const item = items[index];
  const last = index === items.length - 1;

  const next = async () => {
    if (choice === null) return;
    const all = [
      ...answers,
      { item_id: item.id, choice, ms: Date.now() - shownAt.current },
    ];
    setAnswers(all);
    setChoice(null);
    shownAt.current = Date.now();
    if (!last) {
      setIndex(index + 1);
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/study/tests", {
        method: "POST",
        body: JSON.stringify({
          participant_id: participantId,
          test,
          answers: all,
        }),
      });
      onDone();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't save your answers. Please try again.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-ink-muted text-sm">
        Question {index + 1} of {items.length}. It&apos;s fine to guess; this
        measures the app, not you.
      </p>
      <fieldset>
        <legend className="mb-3 text-lg leading-snug font-semibold">
          <WithKets text={item.question} />
        </legend>
        <div className="space-y-2">
          {item.options.map((option, i) => (
            <label
              key={i}
              className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${
                choice === i
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name={`${name}-${item.id}`}
                checked={choice === i}
                onChange={() => setChoice(i)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current font-mono text-sm"
              >
                {"ABCDE"[i]}
              </span>
              <span className="pt-0.5">
                <WithKets text={option} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button onClick={next} disabled={choice === null || saving}>
        {last ? (saving ? "Saving…" : "Finish") : "Next"}
      </Button>
    </div>
  );
}
