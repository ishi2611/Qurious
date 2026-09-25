"use client";

import { useState } from "react";
import Link from "next/link";
import type { Concept } from "@/lib/content/types";
import { buttonClass } from "@/components/ui/Button";
import TutorPanel from "@/components/tutor/TutorPanel";
import LessonPlayer from "./LessonPlayer";

/** One lesson outside a journey, with its own detour stack for "Wait, why?". */
export default function StandaloneLesson({
  rootId,
  concepts,
}: {
  rootId: string;
  concepts: Record<string, Concept>;
}) {
  const [stack, setStack] = useState<string[]>([rootId]);
  const [done, setDone] = useState(false);
  const concept = concepts[stack[stack.length - 1]];
  const isDetour = stack.length > 1;

  if (done) {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-12 sm:px-6">
        <p className="text-accent text-sm font-semibold tracking-wide uppercase">
          Lesson complete
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {concepts[rootId].title}
        </h1>
        <p className="text-ink-muted text-lg">
          Nice work. Pick a question to see where this idea leads.
        </p>
        <div className="flex gap-3">
          <Link href="/" className={buttonClass("primary")}>
            Browse questions
          </Link>
          <button
            type="button"
            className={buttonClass("ghost")}
            onClick={() => setDone(false)}
          >
            Review this lesson
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {isDetour && (
        <div className="bg-accent-soft">
          <p className="mx-auto max-w-2xl px-4 py-2 text-sm sm:px-6">
            Detour: {concept.title}. You&apos;ll return to{" "}
            <strong>{concepts[stack[stack.length - 2]].title}</strong>.
          </p>
        </div>
      )}
      <LessonPlayer
        key={`${concept.id}-${stack.length}`}
        concept={concept}
        hook={concept.hook}
        isDetour={isDetour}
        prerequisites={concept.prerequisites
          .filter((id) => concepts[id])
          .map((id) => ({ id, title: concepts[id].title }))}
        onDetour={(id) => {
          setStack((s) => [...s, id]);
          window.scrollTo({ top: 0 });
        }}
        onComplete={() => {
          if (isDetour) setStack((s) => s.slice(0, -1));
          else setDone(true);
          window.scrollTo({ top: 0 });
        }}
        footer={<TutorPanel conceptId={concept.id} />}
      />
    </>
  );
}
