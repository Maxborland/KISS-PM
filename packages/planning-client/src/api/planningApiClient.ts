import type {
  PlanningApiClientOptions,
  PlanningApplyResponse,
  PlanningCommandBatchRequest,
  PlanningCommandRequest,
  PlanningPreviewResponse,
  PlanningReadModel
} from "./types";

export class PlanningApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;

  constructor(status: number, code: string, body: Record<string, unknown>) {
    super(code);
    this.name = "PlanningApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function createPlanningApiClient(options: PlanningApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${options.apiOrigin}${path}`, {
      ...init,
      credentials,
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        ...(init?.headers ?? {})
      }
    });
    const rawText = await response.text();
    let body: Record<string, unknown> = {};
    if (rawText.length > 0) {
      try {
        const parsed: unknown = JSON.parse(rawText);
        body =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { error: "invalid_json_response" };
      } catch {
        body = { error: "invalid_json_response" };
      }
    }
    if (!response.ok) {
      throw new PlanningApiError(
        response.status,
        typeof body.error === "string" ? body.error : "request_failed",
        body
      );
    }
    return body as T;
  }

  return {
    getPlanReadModel(projectId: string) {
      return requestJson<PlanningReadModel>(
        `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/read-model`
      );
    },
    previewCommand(
      projectId: string,
      input: PlanningCommandRequest,
      signal?: AbortSignal
    ) {
      return requestJson<PlanningPreviewResponse>(
        `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/preview-command`,
        {
          method: "POST",
          body: JSON.stringify(input),
          ...(signal ? { signal } : {})
        }
      );
    },
    applyCommand(projectId: string, input: PlanningCommandRequest) {
      return requestJson<PlanningApplyResponse>(
        `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/apply-command`,
        { method: "POST", body: JSON.stringify(input) }
      );
    },
    applyCommandBatch(projectId: string, input: PlanningCommandBatchRequest) {
      return requestJson<PlanningApplyResponse>(
        `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/apply-command-batch`,
        { method: "POST", body: JSON.stringify(input) }
      );
    },
    bumpPlanVersionForTests(projectId: string) {
      return requestJson<{ newPlanVersion: number }>(
        `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/test/bump-plan-version`,
        { method: "POST", body: JSON.stringify({}) }
      );
    },
    listBaselines(projectId: string) {
      return requestJson<{ baselines: Array<{ id: string; capturedAt: string; taskCount: number }> }>(
        `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/baselines`
      );
    },
    previewScenarios(projectId: string, input: { target: Record<string, unknown>; clientPlanVersion: number }) {
      return requestJson<{ proposals: Array<Record<string, unknown>>; expiresAt: string }>(
        `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/scenarios/preview`,
        { method: "POST", body: JSON.stringify(input) }
      );
    },
    applyScenario(projectId: string, scenarioId: string, input: { clientPlanVersion: number; acceptedRiskReason?: string }) {
      return requestJson<PlanningApplyResponse & { scenarioRunId: string }>(
        `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/scenarios/${encodeURIComponent(scenarioId)}/apply`,
        { method: "POST", body: JSON.stringify(input) }
      );
    }
  };
}

export function fetchProjectAuditEvents(apiOrigin: string, projectId: string) {
  return fetch(`${apiOrigin}/api/tenant/current/audit-events?projectId=${encodeURIComponent(projectId)}`, {
    credentials: "include"
  }).then(async (response) => {
    const body = (await response.json()) as { auditEvents: Array<Record<string, unknown>> };
    if (!response.ok) throw new Error("audit_fetch_failed");
    return body;
  });
}
