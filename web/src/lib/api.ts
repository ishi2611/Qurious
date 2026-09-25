/** Base URL of the FastAPI backend. Inlined at build time (see web/.env.example). */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Health {
  status: string;
  version: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 60_000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: init?.signal ?? controller.signal,
    });
  } catch {
    throw new ApiError(
      "Couldn't reach the Qurious server. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : `Server error (${res.status})`;
    throw new ApiError(detail, res.status);
  }
  return body as T;
}

/** Ask the backend whether it's up. Throws if it can't be reached or answers with an error. */
export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const res = await fetch(`${API_URL}/health`, { signal });
  if (!res.ok) throw new Error(`API responded with ${res.status}`);
  return res.json();
}

export interface PathStep {
  id: string;
  title: string;
  estimated_minutes: number;
  authored: boolean;
  is_target: boolean;
}

export interface PathResponse {
  targets: string[];
  steps: PathStep[];
  total_minutes: number;
}

/** Ordered concepts to reach `targets`, skipping what the learner already knows. */
export const fetchPath = (targets: string[], known: string[] = []) =>
  request<PathResponse>("/path", {
    method: "POST",
    body: JSON.stringify({ targets, known }),
  });

export { request as apiRequest };
