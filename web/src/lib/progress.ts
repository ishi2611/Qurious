/**
 * Optional accounts: sync journey progress across devices through Supabase.
 *
 * Progress always lives on the device first (anonymous, no sign-up needed). If Supabase is
 * configured, a learner can add an email (magic link) and their journeys are merged into the
 * `progress` table, protected by row-level security so each user can only see their own row.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { JourneyState } from "@/lib/journey";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const ACCOUNTS_ENABLED = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!ACCOUNTS_ENABLED) return null;
  client ??= createClient(URL, KEY);
  return client;
}

const JOURNEY_PREFIX = "qurious.journey.v1.";

export type Journeys = Record<string, JourneyState>;

export function localJourneys(): Journeys {
  const out: Journeys = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith(JOURNEY_PREFIX)) {
        const j = JSON.parse(localStorage.getItem(key)!) as JourneyState;
        out[j.questionId] = j;
      }
    }
  } catch {
    // Storage unavailable: nothing local to sync.
  }
  return out;
}

const stamp = (j: JourneyState) => j.updatedAt ?? j.startedAt;

/** Per question, keep whichever journey was touched most recently. */
export function mergeJourneys(local: Journeys, remote: Journeys): Journeys {
  const merged: Journeys = { ...remote };
  for (const [id, j] of Object.entries(local)) {
    if (!merged[id] || stamp(j) > stamp(merged[id])) merged[id] = j;
  }
  return merged;
}

/** Pull the user's saved progress, merge it with this device's, and save both ways. */
export async function syncProgress(
  sb: SupabaseClient,
  userId: string,
): Promise<Journeys> {
  const { data, error } = await sb
    .from("progress")
    .select("journeys")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const merged = mergeJourneys(
    localJourneys(),
    (data?.journeys as Journeys) ?? {},
  );
  try {
    for (const j of Object.values(merged)) {
      localStorage.setItem(JOURNEY_PREFIX + j.questionId, JSON.stringify(j));
    }
  } catch {
    // ignore
  }
  const { error: saveError } = await sb.from("progress").upsert({
    user_id: userId,
    journeys: merged,
    updated_at: new Date().toISOString(),
  });
  if (saveError) throw saveError;
  return merged;
}
