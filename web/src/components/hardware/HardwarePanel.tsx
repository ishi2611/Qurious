"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { basisLabel, Circuit, probabilities, runCircuit } from "@/lib/quantum";
import { Button } from "@/components/ui/Button";
import Ket from "@/components/ui/Ket";

interface Job {
  job_id: string;
  backend: string;
  pending_jobs: number | null;
}

interface JobState {
  status:
    "INITIALIZING" | "QUEUED" | "RUNNING" | "DONE" | "ERROR" | "CANCELLED";
  backend: string;
  counts: Record<string, number>;
  error: string | null;
}

const STEPS = ["Submitted", "Queued", "Running", "Done"] as const;
const stepIndex = (s: JobState["status"] | undefined) =>
  s === "DONE" ? 3 : s === "RUNNING" ? 2 : s === "QUEUED" ? 1 : 0;

/**
 * Send the current circuit to a real IBM quantum computer (if the server has a token), show
 * where it is in the queue, and compare the noisy hardware results with the ideal simulation.
 */
export default function HardwarePanel({ circuit }: { circuit: Circuit }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [state, setState] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The circuit that was actually sent (the learner may keep editing while it runs).
  const [ran, setRan] = useState<Circuit | null>(null);

  useEffect(() => {
    apiRequest<{ available: boolean; reason: string | null }>(
      "/hardware/status",
    )
      .then((s) => {
        setAvailable(s.available);
        setReason(s.reason);
      })
      .catch(() => setAvailable(false));
  }, []);

  // Poll every 5 s until the job finishes.
  useEffect(() => {
    if (
      !job ||
      state?.status === "DONE" ||
      state?.status === "ERROR" ||
      state?.status === "CANCELLED"
    )
      return;
    const timer = setInterval(() => {
      apiRequest<JobState>(`/hardware/jobs/${job.job_id}`)
        .then(setState)
        .catch((e) =>
          setError(
            e instanceof ApiError ? e.message : "Couldn't check the job.",
          ),
        );
    }, 5000);
    return () => clearInterval(timer);
  }, [job, state?.status]);

  const submit = async () => {
    setError(null);
    setState(null);
    setRan(circuit);
    try {
      setJob(
        await apiRequest<Job>("/hardware/jobs", {
          method: "POST",
          body: JSON.stringify({
            num_qubits: circuit.numQubits,
            ops: circuit.ops,
          }),
        }),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't submit the job.");
    }
  };

  if (available === null) return null;

  if (!available) {
    return (
      <section className="border-border text-ink-muted rounded-xl border border-dashed p-4 text-sm">
        <p className="text-ink font-semibold">Run on a real quantum computer</p>
        <p className="mt-1">Not available on this server. {reason}</p>
      </section>
    );
  }

  const ideal = ran ? probabilities(runCircuit(ran)) : [];
  const total = state
    ? Object.values(state.counts).reduce((a, b) => a + b, 0)
    : 0;
  const current = stepIndex(state?.status);

  return (
    <section className="border-border bg-surface space-y-4 rounded-xl border p-4">
      <div>
        <p className="font-semibold">Run on a real IBM quantum computer</p>
        <p className="text-ink-muted mt-1 text-sm">
          Your circuit runs 256 times on real hardware. Jobs wait in a shared
          queue, which can take from seconds to hours.
        </p>
      </div>
      <Button
        onClick={submit}
        disabled={
          !circuit.ops.length || (!!job && current < 3 && !state?.error)
        }
      >
        {job && current < 3 ? "Running…" : "Send this circuit"}
      </Button>
      {error && (
        <p role="alert" className="bg-danger-soft rounded-lg p-3 text-sm">
          {error}
        </p>
      )}
      {job && (
        <div aria-live="polite" className="space-y-3">
          <ol className="flex flex-wrap gap-2 text-sm">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === current ? "step" : undefined}
                className={`rounded-full px-3 py-1 ${i <= current ? "bg-accent-soft text-accent font-semibold" : "bg-surface-muted text-ink-muted"}`}
              >
                {i < current ? "✓ " : ""}
                {s}
              </li>
            ))}
          </ol>
          <p className="text-ink-muted text-sm">
            On{" "}
            <span className="font-mono">{state?.backend ?? job.backend}</span>
            {job.pending_jobs !== null &&
              current < 2 &&
              ` · about ${job.pending_jobs} jobs were ahead in the queue`}
          </p>
          {state?.error && (
            <p className="bg-danger-soft rounded-lg p-3 text-sm">
              {state.error}
            </p>
          )}
          {state?.status === "DONE" && ran && (
            <div className="space-y-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-muted text-left">
                    <th className="py-1 font-medium">Result</th>
                    <th className="py-1 font-medium">Ideal</th>
                    <th className="py-1 font-medium">Real hardware</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {ideal.map((p, i) => {
                    const label = basisLabel(i, ran.numQubits);
                    const n = state.counts[label] ?? 0;
                    return (
                      <tr key={label} className="border-border border-t">
                        <td className="py-1">
                          <Ket label={label} />
                        </td>
                        <td className="py-1">{Math.round(p * 100)}%</td>
                        <td className="py-1">
                          {total ? Math.round((n / total) * 100) : 0}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-sm leading-relaxed">
                The small differences are real-world noise: qubits interact with
                their surroundings and gates aren&apos;t perfect. That&apos;s
                why today&apos;s machines need error correction to scale.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
