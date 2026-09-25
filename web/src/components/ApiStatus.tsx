"use client";

import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api";

type Status = "checking" | "connected" | "unreachable";

const LABELS: Record<Status, string> = {
  checking: "Checking…",
  connected: "Connected",
  unreachable: "Not reachable. Is the API running on port 8000?",
};

// A dot plus a text label, so the status never relies on color alone.
const DOT: Record<Status, string> = {
  checking: "bg-zinc-400",
  connected: "bg-emerald-500",
  unreachable: "bg-red-500",
};

/** Small dev-facing indicator that the web app can talk to the FastAPI backend. */
export default function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((health) =>
        setStatus(health.status === "ok" ? "connected" : "unreachable"),
      )
      .catch(() => {
        if (!controller.signal.aborted) setStatus("unreachable");
      });
    return () => controller.abort();
  }, []);

  return (
    <p
      role="status"
      className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${DOT[status]}`}
      />
      API: {LABELS[status]}
    </p>
  );
}
