"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/Button";

/** Shown if a page crashes. Keeps the header, offers a retry, and never shows raw errors. */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <p className="text-danger text-sm font-semibold tracking-wide uppercase">
        Something went wrong
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        This page hit an error.
      </h1>
      <p className="text-ink-muted text-lg">
        Your progress is saved on this device. Try again, or pick up from the
        questions page.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/" className={buttonClass("secondary")}>
          Back to the questions
        </Link>
      </div>
    </main>
  );
}
