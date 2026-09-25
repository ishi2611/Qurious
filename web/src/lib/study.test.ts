import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { startRecording } from "./study";
import { setSink, track } from "./telemetry";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setSink(null);
});

test("events are batched to the API every few seconds", () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
  const stop = startRecording("P-TEST1234");
  track({ type: "concept_started", conceptId: "qubit" });
  track({
    type: "check_attempt",
    conceptId: "qubit",
    checkIndex: 0,
    correct: true,
    attempt: 1,
  });
  expect(fetchMock).not.toHaveBeenCalled();
  vi.advanceTimersByTime(5000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.participant_id).toBe("P-TEST1234");
  expect(body.events.map((e: { type: string }) => e.type)).toEqual([
    "concept_started",
    "check_attempt",
  ]);
  expect(body.events[0].at).toMatch(/^\d{4}-\d\d-\d\dT/);
  stop();
});

test("a page_hidden event (possible drop-off) is sent immediately by beacon", () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  const beacon = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, "sendBeacon", {
    value: beacon,
    configurable: true,
  });
  const stop = startRecording("P-TEST1234");
  track({ type: "page_hidden", conceptId: "qubit", step: "check" });
  expect(beacon).toHaveBeenCalledTimes(1);
  expect(beacon.mock.calls[0][0]).toMatch(/\/study\/events$/);
  stop();
});

test("nothing is recorded before recording starts or after it stops", () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
  track({ type: "concept_started", conceptId: "qubit" });
  const stop = startRecording("P-TEST1234");
  stop();
  track({ type: "concept_started", conceptId: "qubit" });
  vi.advanceTimersByTime(20000);
  expect(fetchMock).not.toHaveBeenCalled();
});
