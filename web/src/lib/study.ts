/**
 * Study mode on the device: the participant's pseudonymous id, where they are in the study,
 * and the telemetry sink that sends learning events to the API. Nothing is sent unless the
 * participant has consented (a participant id only exists after consent).
 */
import { API_URL } from "@/lib/api";
import { setSink, TrackedEvent } from "@/lib/telemetry";

export const STUDY_ENABLED = process.env.NEXT_PUBLIC_STUDY_MODE === "true";
export const STUDY_CONTACT = process.env.NEXT_PUBLIC_STUDY_CONTACT ?? "";
// Must match CONSENT_VERSION in api/app/routes/study.py.
export const CONSENT_VERSION = "v1-draft";

export type StudyPhase = "pre" | "learning" | "post" | "done";

export interface StudyState {
  participantId: string;
  phase: StudyPhase;
  joinedAt: string;
}

const KEY = "qurious.study.v1";

export function loadStudy(): StudyState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StudyState) : null;
  } catch {
    return null;
  }
}

export function saveStudy(state: StudyState | null) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the study can't continue across pages; the flow shows an error.
  }
  window.dispatchEvent(new Event("qurious:study-changed"));
}

/** True while events should be recorded for the study. */
export const isRecording = (s: StudyState | null) =>
  !!s && (s.phase === "learning" || s.phase === "post");

// ---------------------------------------------------------------------------------------
// Event batching
// ---------------------------------------------------------------------------------------

const FLUSH_EVERY_MS = 5000;
const FLUSH_AT = 20;

function newSessionId() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/**
 * Install the telemetry sink for a participant. Events are batched and sent every few seconds;
 * when the page is hidden or closed they're sent with navigator.sendBeacon, which survives the
 * page unloading. That's what captures the drop-off point. Returns an uninstall function.
 */
export function startRecording(participantId: string): () => void {
  const sessionId = newSessionId();
  let queue: TrackedEvent[] = [];

  const body = (events: TrackedEvent[]) =>
    JSON.stringify({
      participant_id: participantId,
      session_id: sessionId,
      events,
    });

  const flush = (useBeacon = false) => {
    if (!queue.length) return;
    const events = queue.splice(0, 100);
    const url = `${API_URL}/study/events`;
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(
        url,
        new Blob([body(events)], { type: "text/plain" }),
      );
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body(events),
      keepalive: true,
    }).catch(() => {
      // Put them back and try again on the next flush.
      queue = [...events, ...queue].slice(0, 500);
    });
  };

  setSink((event) => {
    queue.push(event);
    // "page_hidden" marks a possible drop-off: send it right away by beacon, since the page
    // may be about to close and a later flush might never happen.
    if (event.type === "page_hidden") flush(true);
    else if (queue.length >= FLUSH_AT) flush();
  });
  const timer = setInterval(() => flush(), FLUSH_EVERY_MS);
  const onHide = () => {
    if (document.visibilityState === "hidden") flush(true);
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);

  return () => {
    flush(true);
    setSink(null);
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
  };
}
