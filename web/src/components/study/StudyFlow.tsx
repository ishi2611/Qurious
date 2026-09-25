"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import {
  CONSENT_VERSION,
  loadStudy,
  saveStudy,
  STUDY_CONTACT,
  STUDY_ENABLED,
  StudyState,
} from "@/lib/study";
import { Button, buttonClass } from "@/components/ui/Button";
import AssessmentRunner from "./AssessmentRunner";

function Consent({ onJoined }: { onJoined: (s: StudyState) => void }) {
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ participant_id: string }>(
        "/study/participants",
        {
          method: "POST",
          body: JSON.stringify({
            consent_version: CONSENT_VERSION,
            agreed,
            study_code: code.trim(),
          }),
        },
      );
      onJoined({
        participantId: res.participant_id,
        phase: "pre",
        joinedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface space-y-3 rounded-2xl border p-5 leading-relaxed sm:p-6">
        <h2 className="text-lg font-semibold">About this study</h2>
        <p>
          We&apos;re studying whether learning quantum computing{" "}
          <em>starting from a question</em> helps people understand it. Taking
          part means: a short quiz (about 5 minutes), using Qurious as normal,
          and the same quiz again at the end.
        </p>
        <h3 className="font-semibold">What we record</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your quiz answers, and how long each question took.</li>
          <li>
            What you do in lessons: which steps you open, your answers to checks
            and puzzles, detours, time on each step, and where you stop.
          </li>
          <li>The date and version of this consent form.</li>
        </ul>
        <h3 className="font-semibold">What we don&apos;t record</h3>
        <p>
          No name, email, IP address or device details. You get a random
          research id instead, and it can&apos;t be linked back to you.
        </p>
        <h3 className="font-semibold">Your choices</h3>
        <p>
          Taking part is voluntary. You can stop at any time, and you can
          withdraw on the last screen of the study, which deletes everything
          recorded under your research id.
        </p>
        <p className="text-ink-muted text-sm">
          Questions about the study:{" "}
          {STUDY_CONTACT ||
            "[researcher contact to be added before the study opens]"}{" "}
          · Consent form {CONSENT_VERSION}
        </p>
      </section>

      <label className="block max-w-xs">
        <span className="text-sm font-medium">
          Study code (if you were given one)
        </span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={40}
          className="border-border bg-surface mt-1 block min-h-11 w-full rounded-lg border px-3 font-mono"
        />
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5"
        />
        <span>
          I&apos;m 18 or older, I&apos;ve read the information above, and I
          agree to take part.
        </span>
      </label>
      {error && (
        <p role="alert" className="bg-danger-soft rounded-lg p-3">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={join} disabled={!agreed || busy}>
          {busy ? "Joining…" : "Join the study"}
        </Button>
        <Link href="/" className={buttonClass("ghost")}>
          No thanks, just use Qurious
        </Link>
      </div>
    </div>
  );
}

function Withdraw({
  participantId,
  onWithdrawn,
}: {
  participantId: string;
  onWithdrawn: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withdraw = async () => {
    try {
      await apiRequest(`/study/participants/${participantId}`, {
        method: "DELETE",
      });
      onWithdrawn();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't withdraw. Please try again.",
      );
    }
  };
  return (
    <div className="border-border rounded-xl border p-4">
      {!confirming ? (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Withdraw from the study
        </Button>
      ) : (
        <div className="space-y-3">
          <p>
            This permanently deletes everything recorded under {participantId}.
            Are you sure?
          </p>
          <div className="flex gap-2">
            <Button onClick={withdraw}>Yes, delete my data</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudyFlow() {
  const [study, setStudy] = useState<StudyState | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore from storage after mount
    setStudy(loadStudy());
  }, []);

  const update = (next: StudyState | null) => {
    saveStudy(next);
    setStudy(next);
  };

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <p className="text-accent text-sm font-semibold tracking-wide uppercase">
        Qurious learning study
      </p>
      {children}
    </main>
  );

  if (!STUDY_ENABLED) {
    return shell(
      <>
        <h1 className="text-3xl font-semibold tracking-tight">
          The study isn&apos;t running right now
        </h1>
        <p className="text-ink-muted">
          You can still use every part of Qurious as normal.
        </p>
        <Link href="/" className={buttonClass("primary")}>
          Browse questions
        </Link>
      </>,
    );
  }
  if (study === undefined)
    return shell(<p className="text-ink-muted">Loading…</p>);

  if (!study) {
    return shell(
      <>
        <h1 className="text-3xl font-semibold tracking-tight">
          Help us study how people learn quantum computing
        </h1>
        <Consent onJoined={update} />
      </>,
    );
  }

  if (study.phase === "pre" || study.phase === "post") {
    return shell(
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          {study.phase === "pre"
            ? "Before you start: a short quiz"
            : "One last thing: the same quiz again"}
        </h1>
        <AssessmentRunner
          key={study.phase}
          participantId={study.participantId}
          test={study.phase}
          onDone={() =>
            update({
              ...study,
              phase: study.phase === "pre" ? "learning" : "done",
            })
          }
        />
      </>,
    );
  }

  if (study.phase === "learning") {
    return shell(
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          Now, learn something
        </h1>
        <p className="leading-relaxed">
          Pick a question and follow it to the end. Take your time and use
          Qurious the way you normally would. When you&apos;re done (or ready to
          stop), come back here for the final quiz.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className={buttonClass("primary")}>
            Choose a question
          </Link>
          <Button
            variant="secondary"
            onClick={() => update({ ...study, phase: "post" })}
          >
            I&apos;m finished: take the final quiz
          </Button>
        </div>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Thank you!</h1>
      <p className="leading-relaxed">
        That&apos;s everything. Your research id is{" "}
        <span className="font-mono font-semibold">{study.participantId}</span>.
        Keep it if you might want to ask about or withdraw your data later.
      </p>
      <Link href="/" className={buttonClass("secondary")}>
        Keep exploring Qurious
      </Link>
      <Withdraw
        participantId={study.participantId}
        onWithdrawn={() => update(null)}
      />
    </>,
  );
}
