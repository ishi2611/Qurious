"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Concept } from "@/lib/content/types";
import { track } from "@/lib/telemetry";
import Callout from "@/components/ui/Callout";
import { WithKets } from "@/components/ui/Ket";
import { Button } from "@/components/ui/Button";
import Interactive from "@/components/interactives/Interactive";
import CircuitSandbox from "@/components/interactives/CircuitSandbox";
import CheckQuestion from "./CheckQuestion";
import MathLayers from "./MathLayers";
import NumericPuzzleView from "./NumericPuzzleView";

type Section =
  "hook" | "intuition" | "interactive" | "math" | "puzzle" | "check";

const SECTION_LABELS: Record<Section, string> = {
  hook: "Why it matters",
  intuition: "Intuition",
  interactive: "Try it",
  math: "The math",
  puzzle: "Puzzle",
  check: "Check",
};

export interface LessonPlayerProps {
  concept: Concept;
  /** The hook to show (already personalized for the learner's question, if any). */
  hook: string;
  questionId?: string;
  /** Concepts left after this one before the goal (0 = this is the last step). */
  stepsAfter?: number;
  prerequisites: { id: string; title: string }[];
  isDetour?: boolean;
  onComplete: () => void;
  onDetour?: (conceptId: string) => void;
  /** Extra panel (the tutor) shown below every section. */
  footer?: ReactNode;
}

function sectionsFor(concept: Concept): Section[] {
  return [
    "hook",
    "intuition",
    "interactive",
    ...(concept.math.length ? (["math"] as const) : []),
    ...(concept.puzzle ? (["puzzle"] as const) : []),
    "check",
  ];
}

export function progressLabel(stepsAfter: number): string {
  if (stepsAfter === 0) return "Last step before your answer";
  return `${stepsAfter + 1} steps from your answer`;
}

export default function LessonPlayer({
  concept,
  hook,
  questionId,
  stepsAfter,
  prerequisites,
  isDetour = false,
  onComplete,
  onDetour,
  footer,
}: LessonPlayerProps) {
  const sections = sectionsFor(concept);
  const [index, setIndex] = useState(0);
  const [checkIndex, setCheckIndex] = useState(0);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const startedAt = useRef(0);
  const sectionStartedAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const section = sections[index];

  useEffect(() => {
    startedAt.current = Date.now();
    sectionStartedAt.current = Date.now();
    track({
      type: "concept_started",
      conceptId: concept.id,
      questionId,
      detour: isDetour,
    });
  }, [concept.id, questionId, isDetour]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        track({
          type: "page_hidden",
          conceptId: concept.id,
          step: sections[index],
        });
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [concept.id, index, sections]);

  const goTo = (next: number) => {
    const now = Date.now();
    track({
      type: "step_viewed",
      conceptId: concept.id,
      step: sections[next],
      msOnPreviousStep: now - sectionStartedAt.current,
    });
    sectionStartedAt.current = now;
    setIndex(next);
    setShowWhy(false);
    // Move focus to the new screen's heading for keyboard and screen-reader users.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const finish = () => {
    track({
      type: "concept_completed",
      conceptId: concept.id,
      questionId,
      ms: Date.now() - startedAt.current,
    });
    onComplete();
  };

  const next = () => (index < sections.length - 1 ? goTo(index + 1) : finish());

  let body: ReactNode;
  switch (section) {
    case "hook":
      body = (
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">
            <WithKets text={hook} />
          </p>
          <p className="bg-surface-muted text-ink-muted rounded-lg p-3 text-[0.95rem]">
            <span className="text-ink font-semibold">
              The idea in one line:{" "}
            </span>
            <WithKets text={concept.summary} />
          </p>
        </div>
      );
      break;
    case "intuition":
      body = (
        <div className="space-y-4">
          <Callout kind="analogy">
            <WithKets text={concept.intuition!.analogy} />
          </Callout>
          <Callout kind="breaks">
            <WithKets text={concept.intuition!.where_it_breaks} />
          </Callout>
        </div>
      );
      break;
    case "interactive":
      body = (
        <div className="space-y-4">
          {concept.interactive!.caption && (
            <p className="text-ink-muted leading-relaxed">
              <WithKets text={concept.interactive!.caption} />
            </p>
          )}
          <Interactive
            type={concept.interactive!.type}
            props={concept.interactive!.props}
          />
        </div>
      );
      break;
    case "math":
      body = (
        <div className="space-y-4">
          <p className="text-ink-muted leading-relaxed">
            Optional. The math says the same thing precisely. Open as much or as
            little as you like.
          </p>
          <MathLayers
            layers={concept.math}
            onOpen={(level) =>
              track({ type: "math_opened", conceptId: concept.id, level })
            }
          />
        </div>
      );
      break;
    case "puzzle": {
      const puzzle = concept.puzzle!;
      body =
        puzzle.type === "circuit_goal" ? (
          <div className="space-y-4">
            <p className="text-lg leading-snug font-semibold">
              <WithKets text={puzzle.prompt} />
            </p>
            <CircuitSandbox
              numQubits={puzzle.num_qubits}
              allowedGates={puzzle.allowed_gates}
              puzzle={puzzle}
              onCheck={(fb) => {
                track({
                  type: "puzzle_attempt",
                  conceptId: concept.id,
                  solved: fb.solved,
                  reason: fb.solved ? undefined : fb.reason,
                });
                if (fb.solved) setPuzzleSolved(true);
              }}
            />
          </div>
        ) : (
          <NumericPuzzleView
            puzzle={puzzle}
            onAttempt={(solved) => {
              track({ type: "puzzle_attempt", conceptId: concept.id, solved });
              if (solved) setPuzzleSolved(true);
            }}
          />
        );
      break;
    }
    case "check":
      body = (
        <CheckQuestion
          key={checkIndex}
          check={concept.checks[checkIndex]}
          altExplanation={concept.alt_explanation}
          onResult={(correct, attempt) =>
            track({
              type: "check_attempt",
              conceptId: concept.id,
              checkIndex,
              correct,
              attempt,
            })
          }
          continueLabel={
            checkIndex < concept.checks.length - 1
              ? "Next question"
              : isDetour
                ? "Back to your path"
                : stepsAfter === 0
                  ? "See your answer"
                  : "Next step"
          }
          onContinue={() =>
            checkIndex < concept.checks.length - 1
              ? setCheckIndex((i) => i + 1)
              : finish()
          }
        />
      );
      break;
  }

  const showContinue = section !== "check";

  return (
    <article className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-accent font-semibold tracking-wide uppercase">
            {isDetour
              ? "Detour"
              : stepsAfter !== undefined
                ? progressLabel(stepsAfter)
                : "Lesson"}
          </p>
          {concept.status === "draft" && (
            <span
              className="bg-surface-muted text-ink-muted rounded-full px-2.5 py-0.5 text-xs"
              title="Awaiting review by the content owner"
            >
              Draft lesson
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {concept.title}
        </h1>
        <nav aria-label="Lesson sections">
          <ol className="flex gap-1.5">
            {sections.map((s, i) => (
              <li key={s} className="flex-1">
                <span
                  className={`block h-1.5 rounded-full ${i <= index ? "bg-accent" : "bg-border"}`}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {SECTION_LABELS[s]}
                  {i === index ? " (current)" : i < index ? " (done)" : ""}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <section aria-labelledby="section-heading" className="space-y-5">
        <h2
          id="section-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {SECTION_LABELS[section]}
          {section === "check" && concept.checks.length > 1 && (
            <span className="text-ink-muted font-normal">
              {" "}
              · question {checkIndex + 1} of {concept.checks.length}
            </span>
          )}
        </h2>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${section}-${checkIndex}`}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </section>

      <footer className="border-border flex flex-wrap items-center gap-2 border-t pt-5">
        {index > 0 && section !== "check" && (
          <Button variant="secondary" onClick={() => goTo(index - 1)}>
            Back
          </Button>
        )}
        {showContinue && (
          <Button onClick={next}>
            {section === "puzzle" && !puzzleSolved ? "Skip puzzle" : "Continue"}
          </Button>
        )}
        {section === "puzzle" && !puzzleSolved && (
          <span className="sr-only" aria-live="polite">
            You can skip the puzzle and come back to it later.
          </span>
        )}
        {prerequisites.length > 0 && onDetour && (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => setShowWhy((v) => !v)}
            aria-expanded={showWhy}
          >
            Wait, why?
          </Button>
        )}
      </footer>

      {showWhy && (
        <div className="border-border bg-surface rounded-xl border p-4">
          <p className="font-semibold">This step builds on:</p>
          <ul className="mt-2 space-y-1">
            {prerequisites.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="text-accent text-left underline-offset-4 hover:underline"
                  onClick={() => {
                    track({
                      type: "detour_started",
                      fromConceptId: concept.id,
                      toConceptId: p.id,
                    });
                    onDetour?.(p.id);
                  }}
                >
                  {p.title} →
                </button>
              </li>
            ))}
          </ul>
          <p className="text-ink-muted mt-2 text-sm">
            You&apos;ll come straight back here afterwards.
          </p>
        </div>
      )}

      {footer}
    </article>
  );
}
