"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  isRecording,
  loadStudy,
  startRecording,
  STUDY_ENABLED,
  StudyState,
} from "@/lib/study";

/**
 * Mounted once in the root layout. If this device has joined the study (and consented), it
 * records learning events on every page and shows a slim banner with the way to the post-test.
 */
export default function StudyProvider() {
  const [study, setStudy] = useState<StudyState | null>(null);

  useEffect(() => {
    if (!STUDY_ENABLED) return;
    const sync = () => setStudy(loadStudy());
    sync();
    window.addEventListener("qurious:study-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("qurious:study-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const recording = isRecording(study);
  const participantId = study?.participantId;
  useEffect(() => {
    if (!recording || !participantId) return;
    return startRecording(participantId);
  }, [recording, participantId]);

  if (!STUDY_ENABLED || !study || study.phase === "done") return null;
  return (
    <div className="bg-accent-soft text-sm">
      <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 sm:px-6">
        <span>
          Study mode · your research id is{" "}
          <span className="font-mono font-semibold">{study.participantId}</span>
        </span>
        {study.phase === "learning" && (
          <Link
            href="/study"
            className="text-accent font-semibold underline underline-offset-4"
          >
            I&apos;m finished: take the final quiz
          </Link>
        )}
      </p>
    </div>
  );
}
