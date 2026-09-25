"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

/**
 * The lesson hook, rephrased by the tutor to connect to the learner's question when the LLM
 * is available. Shows the authored hook immediately and swaps in the personalized one if it
 * arrives quickly; on any failure the authored hook simply stays.
 */
export function usePersonalizedHook(
  conceptId: string,
  questionId: string | undefined,
  fallback: string,
) {
  const [hook, setHook] = useState(fallback);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the concept changes
    setHook(fallback);
    if (!questionId) return;
    const controller = new AbortController();
    apiRequest<{ hook: string; personalized: boolean }>("/tutor/hook", {
      method: "POST",
      body: JSON.stringify({ concept_id: conceptId, question_id: questionId }),
      signal: controller.signal,
      timeoutMs: 6000,
    })
      .then((res) => {
        if (res.personalized && res.hook) setHook(res.hook);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [conceptId, questionId, fallback]);

  return hook;
}
