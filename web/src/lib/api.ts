/** Base URL of the FastAPI backend. Inlined at build time (see web/.env.example). */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Health {
  status: string;
  version: string;
}

/** Ask the backend whether it's up. Throws if it can't be reached or answers with an error. */
export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const res = await fetch(`${API_URL}/health`, { signal });
  if (!res.ok) throw new Error(`API responded with ${res.status}`);
  return res.json();
}
