"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Concept, Question } from "@/lib/content/types";
import { ApiError, fetchPath, PathResponse } from "@/lib/api";
import {
  clearJourney,
  completeCurrent,
  currentConcept,
  JourneyState,
  loadJourney,
  newJourney,
  nextDiagnosticConcept,
  PrereqMap,
  saveJourney,
  startDetour,
  stepsAfterCurrent,
} from "@/lib/journey";
import { track } from "@/lib/telemetry";
import { Button, buttonClass } from "@/components/ui/Button";
import { WithKets } from "@/components/ui/Ket";
import LessonPlayer from "@/components/lesson/LessonPlayer";
import CheckQuestion from "@/components/lesson/CheckQuestion";
import Reward from "@/components/rewards/Reward";
import TutorPanel from "@/components/tutor/TutorPanel";
import PathMap, { MapStop } from "./PathMap";
import { usePersonalizedHook } from "@/components/tutor/usePersonalizedHook";

export interface JourneyProps {
  question: Question;
  /** Every concept this question's path could include (targets and all their prerequisites). */
  concepts: Record<string, Concept>;
  prereqs: PrereqMap;
  titles: Record<string, string>;
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      {children}
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-accent text-sm font-semibold tracking-wide uppercase">
      {children}
    </p>
  );
}

function LessonStep({
  concept,
  journey,
  props,
  onComplete,
  onDetour,
}: {
  concept: Concept;
  journey: JourneyState;
  props: JourneyProps;
  onComplete: () => void;
  onDetour: (id: string) => void;
}) {
  const fallbackHook =
    concept.question_hooks[journey.questionId] ?? concept.hook;
  const hook = usePersonalizedHook(
    concept.id,
    journey.questionId,
    fallbackHook,
  );
  const isDetour = journey.detours.length > 0;
  return (
    <>
      {isDetour && (
        <div className="bg-accent-soft">
          <p className="mx-auto max-w-2xl px-4 py-2 text-sm sm:px-6">
            Detour: {concept.title}. You&apos;ll return to{" "}
            <strong>
              {
                props.titles[
                  journey.path.find((c) => !journey.completed.includes(c)) ?? ""
                ]
              }
            </strong>{" "}
            next.
          </p>
        </div>
      )}
      <LessonPlayer
        key={`${concept.id}-${journey.detours.length}`}
        concept={concept}
        hook={hook}
        questionId={journey.questionId}
        stepsAfter={isDetour ? undefined : stepsAfterCurrent(journey)}
        isDetour={isDetour}
        prerequisites={concept.prerequisites
          .filter((id) => props.concepts[id])
          .map((id) => ({ id, title: props.titles[id] }))}
        onComplete={onComplete}
        onDetour={onDetour}
        footer={
          <TutorPanel conceptId={concept.id} questionId={journey.questionId} />
        }
      />
    </>
  );
}

export default function Journey(props: JourneyProps) {
  const { question, concepts, prereqs, titles } = props;
  const [journey, setJourney] = useState<JourneyState | null>(null);
  const [fullPath, setFullPath] = useState<PathResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [pendingAnswer, setPendingAnswer] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const narrow = useIsNarrow();

  const update = useCallback((next: JourneyState) => {
    setJourney(next);
    saveJourney(next);
  }, []);

  // Resume a saved journey, or start a new one.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore from storage after mount
    setJourney(loadJourney(question.id) ?? newJourney(question.id));
  }, [question.id]);

  // The full path (nothing known yet) powers the preview's "N ideas" and the quick check.
  // State is only set in the promise callbacks, never synchronously in the effect.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => active && setSlow(true), 3000);
    fetchPath(question.targets)
      .then((res) => {
        if (!active) return;
        setFullPath(res);
        setError(null);
      })
      .catch(
        (e) =>
          active &&
          setError(e instanceof ApiError ? e.message : "Something went wrong."),
      )
      .finally(() => {
        clearTimeout(timer);
        if (active) setSlow(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [question.targets, attempt]);
  const loadFullPath = () => {
    setError(null);
    setAttempt((a) => a + 1);
  };

  const buildPath = async (known: string[]) => {
    try {
      setError(null);
      const res = await fetchPath(question.targets, known);
      const path = res.steps.map((s) => s.id);
      track({ type: "path_started", questionId: question.id, path });
      update({
        ...journey!,
        known,
        path,
        completed: [],
        detours: [],
        phase: path.length ? "map" : "reward",
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  };

  if (!journey)
    return (
      <Shell>
        <p className="text-ink-muted">Loading…</p>
      </Shell>
    );

  const errorBox = error && (
    <div role="alert" className="bg-danger-soft rounded-xl p-4">
      <p>{error}</p>
      <Button variant="secondary" className="mt-3" onClick={loadFullPath}>
        Try again
      </Button>
    </div>
  );

  // ----- Preview -----------------------------------------------------------------------
  if (journey.phase === "preview") {
    const ideas = fullPath?.steps.length;
    return (
      <Shell>
        <Eyebrow>Your question</Eyebrow>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {question.question}
        </h1>
        <div className="border-border bg-surface shadow-card rounded-xl border p-5">
          <p className="text-ink-muted mb-1 text-sm font-semibold">
            The short answer
          </p>
          <p className="text-lg leading-relaxed">
            <WithKets text={question.preview} />
          </p>
        </div>
        {errorBox}
        {!error && (
          <p className="text-lg" aria-live="polite">
            {ideas === undefined ? (
              slow ? (
                "Waking up the server, this can take up to a minute the first time…"
              ) : (
                "Working out your path…"
              )
            ) : (
              <>
                To really understand this you need{" "}
                <strong>{ideas} ideas</strong>, about {fullPath!.total_minutes}{" "}
                minutes. You may know some already. Ready?
              </>
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={!fullPath}
            onClick={() => {
              track({ type: "question_selected", questionId: question.id });
              update({ ...journey, phase: "diagnostic" });
            }}
          >
            Start with a quick check
          </Button>
          <Button
            variant="secondary"
            disabled={!fullPath}
            onClick={() => {
              track({ type: "question_selected", questionId: question.id });
              buildPath([]);
            }}
          >
            I&apos;m new to this, start from the beginning
          </Button>
        </div>
        <p className="text-ink-muted text-sm">
          The quick check asks a few questions so we can skip what you already
          know.
        </p>
      </Shell>
    );
  }

  // ----- Diagnostic --------------------------------------------------------------------
  if (journey.phase === "diagnostic") {
    const next = fullPath
      ? nextDiagnosticConcept({
          path: fullPath.steps.map((s) => s.id),
          targets: fullPath.targets,
          prereqs,
          hasDiagnostic: (id) => (concepts[id]?.diagnostic.length ?? 0) > 0,
          answers,
        })
      : null;
    const finish = () =>
      buildPath(Object.keys(answers).filter((id) => answers[id]));
    return (
      <Shell>
        <Eyebrow>
          Quick check · question {Object.keys(answers).length + (next ? 1 : 0)}
        </Eyebrow>
        {errorBox}
        {next ? (
          <>
            <CheckQuestion
              key={next}
              mode="diagnostic"
              check={concepts[next].diagnostic[0]}
              onResult={(correct) => {
                setPendingAnswer(correct);
                track({
                  type: "diagnostic_answered",
                  conceptId: next,
                  correct,
                });
              }}
              onContinue={() => {
                // Record on "Next", so the feedback stays on screen until the learner moves on.
                setAnswers((a) => ({ ...a, [next]: pendingAnswer ?? false }));
                setPendingAnswer(null);
              }}
              continueLabel="Next"
            />
            <Button variant="ghost" onClick={finish}>
              Skip the rest of the check
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-lg">
              Done. You already know{" "}
              {Object.values(answers).filter(Boolean).length} of the ideas we
              checked.
            </p>
            <Button onClick={finish}>Show my path</Button>
          </div>
        )}
      </Shell>
    );
  }

  // ----- Reward ------------------------------------------------------------------------
  if (journey.phase === "reward") {
    return (
      <RewardScreen
        question={question}
        learned={journey.completed.map((id) => titles[id])}
        onRestart={() => {
          clearJourney(question.id);
          setAnswers({});
          update(newJourney(question.id));
        }}
      />
    );
  }

  const conceptId = currentConcept(journey)!;
  const stops: MapStop[] = journey.path.map((id, i) => ({
    id,
    title: titles[id],
    status: journey.completed.includes(id)
      ? "done"
      : id === conceptId
        ? "current"
        : "todo",
    isGoal: i === journey.path.length - 1,
  }));
  const minutesLeft = journey.path
    .filter((id) => !journey.completed.includes(id))
    .reduce((s, id) => s + (concepts[id]?.estimated_minutes ?? 0), 0);
  const left = stepsAfterCurrent(journey) + 1;

  // ----- Map -----------------------------------------------------------------------------
  if (journey.phase === "map") {
    return (
      <Shell>
        <Eyebrow>
          {journey.completed.length ? "Nice work" : "Your path"}
        </Eyebrow>
        <h1 className="text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
          {left === 1
            ? "One step from your answer"
            : `${left} steps from your answer`}
        </h1>
        <p className="text-ink-muted">
          {question.question} · about {minutesLeft} minutes to go
          {journey.known.length > 0 &&
            ` · skipping ${journey.known.length} idea${journey.known.length > 1 ? "s" : ""} you already know`}
        </p>
        <PathMap stops={stops} vertical={narrow} />
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => update({ ...journey, phase: "lesson" })}>
            {journey.completed.length ? "Continue" : "Start"}:{" "}
            {titles[conceptId]}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clearJourney(question.id);
              setAnswers({});
              update(newJourney(question.id));
            }}
          >
            Start over
          </Button>
        </div>
      </Shell>
    );
  }

  // ----- Lesson --------------------------------------------------------------------------
  const concept = concepts[conceptId];
  return (
    <LessonStep
      concept={concept}
      journey={journey}
      props={props}
      onComplete={() => {
        const next = completeCurrent(journey);
        // After a detour, go straight back into the lesson we left.
        update(journey.detours.length ? { ...next, phase: "lesson" } : next);
        window.scrollTo({ top: 0 });
      }}
      onDetour={(id) => {
        update(startDetour(journey, id));
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

function RewardScreen({
  question,
  learned,
  onRestart,
}: {
  question: Question;
  learned: string[];
  onRestart: () => void;
}) {
  useEffect(() => {
    track({ type: "reward_reached", questionId: question.id });
  }, [question.id]);
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <Eyebrow>You made it</Eyebrow>
      <h1 className="text-3xl leading-tight font-semibold tracking-tight">
        {question.reward.title}
      </h1>
      <p className="text-ink-muted text-lg leading-relaxed">
        {question.reward.description}
      </p>
      {question.reward.type !== "coming_soon" && (
        <div className="border-border bg-surface shadow-card rounded-2xl border p-4 sm:p-6">
          <Reward type={question.reward.type} />
        </div>
      )}
      {learned.length > 0 && (
        <section className="bg-surface-muted rounded-xl p-5">
          <h2 className="font-semibold">
            On the way to &ldquo;{question.question}&rdquo; you learned
          </h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {learned.map((t) => (
              <li key={t}>✓ {t}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={buttonClass("primary")}>
          Choose another question
        </Link>
        <Button variant="ghost" onClick={onRestart}>
          Do this journey again
        </Button>
      </div>
    </main>
  );
}
