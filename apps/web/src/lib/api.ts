export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "server_error"
  | "network_error"
  | "invalid_response"
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

function buildRequestHeaders(json: unknown, headers: HeadersInit | undefined): Headers {
  const requestHeaders = new Headers();
  if (json !== undefined) {
    requestHeaders.set("content-type", "application/json");
  }
  requestHeaders.set("x-kiss-pm-action", "same-origin");
  new Headers(headers).forEach((value, key) => requestHeaders.set(key, value));
  return requestHeaders;
}

function toErrorBody(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return { payload };
}

export type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, headers, ...init } = options;
  const requestHeaders = buildRequestHeaders(json, headers);
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: requestHeaders,
    ...(json !== undefined ? { body: JSON.stringify(json) } : {})
  });

  const rawText = await response.text();
  let payload: unknown = {};
  if (rawText.length > 0) {
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch {
      const body = { error: "invalid_json_response" };
      if (response.ok) {
        throw new ApiError(response.status, "invalid_response", "invalid_json_response", body);
      }
      payload = body;
    }
  }

  if (!response.ok) {
    const body = toErrorBody(payload);
    const code = mapStatusToCode(response.status, body);
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : `HTTP ${response.status}`;
    throw new ApiError(response.status, code, message, body);
  }

  return payload as T;
}
