"use client";

import Link from "next/link";
import { FormEvent, useId, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/Button";
import { WithKets } from "@/components/ui/Ket";

interface TutorAnswer {
  answer: string;
  supported: boolean;
  sources: { concept_id: string; title: string; section: string }[];
  suggestion: { concept_id: string; title: string } | null;
}

interface Exchange {
  question: string;
  reply: TutorAnswer | { error: string };
}

/**
 * "Ask about this step." Answers come only from Qurious's lesson content (retrieved on the
 * server). When the lessons don't cover something, the tutor says so instead of improvising.
 */
export default function TutorPanel({
  conceptId,
  questionId,
}: {
  conceptId: string;
  questionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Exchange[]>([]);
  const id = useId();

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    try {
      const reply = await apiRequest<TutorAnswer>("/tutor/ask", {
        method: "POST",
        body: JSON.stringify({
          concept_id: conceptId,
          question_id: questionId,
          message,
        }),
        timeoutMs: 30_000,
      });
      track({ type: "tutor_question", conceptId, supported: reply.supported });
      setHistory((h) => [...h, { question: message, reply }]);
      setText("");
    } catch (err) {
      setHistory((h) => [
        ...h,
        {
          question: message,
          reply: {
            error:
              err instanceof ApiError
                ? err.message
                : "The tutor is unavailable right now.",
          },
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="border-border border-t pt-4">
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Ask about this step
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="border-border bg-surface space-y-3 rounded-xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id={`${id}-title`} className="font-semibold">
            Ask about this step
          </h2>
          <p className="text-ink-muted text-sm">
            Answers come only from Qurious&apos;s lessons. If something
            isn&apos;t covered, the tutor will say so.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => setOpen(false)}
          aria-label="Close the tutor"
        >
          ✕
        </Button>
      </div>

      <ul className="space-y-3" aria-live="polite">
        {history.map((ex, i) => (
          <li key={i} className="space-y-1.5">
            <p className="text-sm font-semibold">You: {ex.question}</p>
            {"error" in ex.reply ? (
              <p className="bg-danger-soft rounded-lg p-3 text-sm">
                {ex.reply.error}
              </p>
            ) : (
              <div
                className={`rounded-lg p-3 ${ex.reply.supported ? "bg-surface-muted" : "bg-caution-soft text-caution-ink"}`}
              >
                <p className="leading-relaxed">
                  <WithKets text={ex.reply.answer} />
                </p>
                {ex.reply.supported && ex.reply.sources.length > 0 && (
                  <p className="text-ink-muted mt-2 text-xs">
                    From:{" "}
                    {ex.reply.sources
                      .map((s) => `${s.title} (${s.section})`)
                      .join(" · ")}
                  </p>
                )}
                {ex.reply.suggestion && (
                  <p className="mt-2 text-sm">
                    Related lesson:{" "}
                    <Link
                      className="text-accent underline underline-offset-4"
                      href={`/learn/${ex.reply.suggestion.concept_id}`}
                    >
                      {ex.reply.suggestion.title}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-input`} className="sr-only">
          Your question about this step
        </label>
        <input
          id={`${id}-input`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="e.g. Why does squaring the amplitude give a probability?"
          className="border-border bg-bg min-h-11 flex-1 rounded-lg border px-3"
        />
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </form>
    </section>
  );
}
