export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "server_error"
  | "network_error"
  | "unknown";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly body: Record<string, unknown>;

  constructor(status: number, code: ApiErrorCode, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

function mapStatusToCode(status: number, body: Record<string, unknown>): ApiErrorCode {
  const errorField = body.error;
  if (typeof errorField === "string") {
    if (errorField === "plan_version_conflict") return "conflict";
    if (errorField === "forbidden") return "forbidden";
    if (errorField === "unauthorized") return "unauthorized";
    if (errorField === "not_found") return "not_found";
    if (errorField === "validation_error") return "validation_error";
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation_error";
  if (status >= 500) return "server_error";
  return "unknown";
}

export type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, headers, ...init } = options;
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      "x-kiss-pm-action": "same-origin",
      ...(headers ?? {})
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {})
  });

  const rawText = await response.text();
  let body: Record<string, unknown> = {};
  if (rawText.length > 0) {
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = { error: "invalid_json_response" };
    }
  }

  if (!response.ok) {
    const code = mapStatusToCode(response.status, body);
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : `HTTP ${response.status}`;
    throw new ApiError(response.status, code, message, body);
  }

  return body as T;
}
