"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { Button, buttonClass } from "@/components/ui/Button";

interface RouteResult {
  status: "mapped" | "partial" | "off_topic";
  message: string;
  targets: string[];
  target_titles: string[];
  uncovered: string[];
}

/**
 * v2 (behind NEXT_PUBLIC_FEATURE_FREE_TEXT): type any question. The server maps it onto
 * existing concepts only, says honestly what isn't covered, and offers a real path. It never
 * answers the question directly.
 */
export default function FreeTextQuestion() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await apiRequest<RouteResult>("/tutor/route", {
          method: "POST",
          body: JSON.stringify({ text }),
          timeoutMs: 30_000,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-border bg-surface space-y-3 rounded-2xl border p-5">
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="free-text" className="font-semibold">
          Or ask your own question{" "}
          <span className="text-ink-muted text-sm font-normal">(beta)</span>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="free-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="e.g. Could entanglement let us build a faster-than-light phone?"
            className="border-border bg-bg min-h-11 flex-1 rounded-lg border px-3"
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? "Finding a path…" : "Find my path"}
          </Button>
        </div>
      </form>
      <div aria-live="polite">
        {error && <p className="bg-danger-soft rounded-lg p-3">{error}</p>}
        {result && (
          <div className="bg-surface-muted space-y-3 rounded-lg p-4">
            <p className="leading-relaxed">{result.message}</p>
            {result.status !== "off_topic" && result.targets.length > 0 && (
              <Link
                href={`/explore?targets=${result.targets.join(",")}&q=${encodeURIComponent(text)}`}
                className={buttonClass("primary")}
              >
                Start the path to: {result.target_titles.join(", ")}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
