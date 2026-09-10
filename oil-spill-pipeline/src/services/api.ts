/**
 * The single point of contact with the backend (CLAUDE.md §36).
 *
 * Native `fetch` only — no HTTP client dependency. Every backend error is
 * surfaced as an `ApiError` carrying the backend's own error `type` and
 * `request_id` where available, so the UI can show something an investigator
 * can act on (and quote in a bug report) rather than "Failed to fetch".
 */

import type {
  CaseMeta,
  InvestigationCase,
} from "@/types/investigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const TIMEOUT_MS =
  (Number.parseFloat(process.env.NEXT_PUBLIC_API_TIMEOUT_SECONDS ?? "30") ||
    30) * 1000;

/** Backend error envelope: `{"error": {"type", "message", "request_id"}}`. */
interface BackendErrorEnvelope {
  error?: {
    type?: string;
    message?: string;
    request_id?: string;
  };
}

export type ApiErrorKind =
  | "offline"
  | "timeout"
  | "http"
  | "malformed"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly errorType: string | null;
  readonly requestId: string | null;

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind;
      status?: number | null;
      errorType?: string | null;
      requestId?: string | null;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.errorType = options.errorType ?? null;
    this.requestId = options.requestId ?? null;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs = TIMEOUT_MS, ...requestInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(requestInit.body ? { "Content-Type": "application/json" } : {}),
        ...requestInit.headers,
      },
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        `The backend did not respond within ${Math.round(timeoutMs / 1000)}s.`,
        { kind: "timeout" }
      );
    }
    // A network-level failure here is indistinguishable from a CORS rejection
    // in the browser — both surface as a bare TypeError — so name both.
    throw new ApiError(
      `Could not reach the backend at ${API_BASE_URL}. Check that it is running, and that it allows requests from this origin.`,
      { kind: "offline" }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let errorType: string | null = null;
    let requestId: string | null = null;
    let message = `Backend returned ${response.status} ${response.statusText}.`;
    try {
      const body = (await response.json()) as BackendErrorEnvelope;
      if (body?.error) {
        errorType = body.error.type ?? null;
        requestId = body.error.request_id ?? null;
        if (body.error.message) message = body.error.message;
      }
    } catch {
      // Non-JSON error body — keep the status-derived message.
    }
    throw new ApiError(message, {
      kind: "http",
      status: response.status,
      errorType,
      requestId,
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("The backend returned a response that was not valid JSON.", {
      kind: "malformed",
      status: response.status,
    });
  }
}

/** `GET /api/health` — used to distinguish "backend down" from "case failed". */
export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/api/health", { timeoutMs: 5000 });
}

/** `GET /api/cases` → `{ cases: CaseMeta[] }`. */
export async function getCases(): Promise<CaseMeta[]> {
  const body = await request<{ cases: CaseMeta[] }>("/api/cases");
  if (!Array.isArray(body?.cases)) {
    throw new ApiError("The backend returned an unexpected shape for /api/cases.", {
      kind: "malformed",
    });
  }
  return body.cases;
}

/** `GET /api/cases/{case_id}`. */
export async function getCase(caseId: string): Promise<CaseMeta> {
  return request<CaseMeta>(`/api/cases/${encodeURIComponent(caseId)}`);
}

/**
 * `POST /api/investigation/run` with `{ case_id }`.
 *
 * Synchronous: the backend runs the whole pipeline and returns the completed
 * InvestigationCase in the response. There is no polling endpoint, so the UI
 * simply awaits this call.
 */
export async function runInvestigation(
  caseId: string
): Promise<InvestigationCase> {
  const result = await request<InvestigationCase>("/api/investigation/run", {
    method: "POST",
    body: JSON.stringify({ case_id: caseId }),
  });

  if (!result || typeof result.case_id !== "string") {
    throw new ApiError(
      "The backend returned an unexpected shape for the investigation result.",
      { kind: "malformed" }
    );
  }
  return result;
}

/** `GET /api/investigation/{case_id}` — the last run for a case, if any. */
export async function getInvestigation(
  caseId: string
): Promise<InvestigationCase> {
  return request<InvestigationCase>(
    `/api/investigation/${encodeURIComponent(caseId)}`
  );
}
