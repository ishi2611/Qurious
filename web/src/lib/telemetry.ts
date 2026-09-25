/**
 * Learning events, for progress and (with consent) the study.
 *
 * Components call `track(...)` wherever something meaningful happens. Where the events go is
 * decided in one place, `setSink`. Nothing is sent anywhere unless a sink is installed (the
 * study module does that only after the participant consents).
 */

export type LearningEvent =
  | { type: "question_selected"; questionId: string }
  | { type: "diagnostic_answered"; conceptId: string; correct: boolean }
  | { type: "path_started"; questionId: string; path: string[] }
  | {
      type: "concept_started";
      conceptId: string;
      questionId?: string;
      detour?: boolean;
    }
  | {
      type: "step_viewed";
      conceptId: string;
      step: string;
      msOnPreviousStep?: number;
    }
  | {
      type: "check_attempt";
      conceptId: string;
      checkIndex: number;
      correct: boolean;
      attempt: number;
    }
  | {
      type: "puzzle_attempt";
      conceptId: string;
      solved: boolean;
      reason?: string;
    }
  | { type: "puzzle_skipped"; conceptId: string }
  | { type: "math_opened"; conceptId: string; level: number }
  | { type: "detour_started"; fromConceptId: string; toConceptId: string }
  | {
      type: "concept_completed";
      conceptId: string;
      questionId?: string;
      ms: number;
    }
  | { type: "reward_reached"; questionId: string }
  | { type: "tutor_question"; conceptId: string; supported: boolean }
  | { type: "page_hidden"; conceptId?: string; step?: string };

export type TrackedEvent = LearningEvent & { at: string };

type Sink = (event: TrackedEvent) => void;

let sink: Sink | null = null;

/** Install (or remove, with null) the place events are sent. */
export function setSink(next: Sink | null) {
  sink = next;
}

export function track(event: LearningEvent) {
  if (!sink) return;
  try {
    sink({ ...event, at: new Date().toISOString() });
  } catch {
    // Telemetry must never break learning.
  }
}
