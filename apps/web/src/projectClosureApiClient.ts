import type { Phase9ClosureDataFixture } from "@kiss-pm/shared-test-fixtures";

export type ProjectClosureReadModelDto = {
  project: { id: string; lifecycleStatus: string };
  checklist: { requirements: Array<{ key: string; label: string; required: boolean }> };
  readiness: { ok: boolean; blockers: Array<{ code: string; message?: string }> };
  snapshots: Array<{ id: string }>;
  latestSnapshot: null | { id: string; metrics: { plannedWorkHours: number } };
};

export type ProjectClosurePreviewDto = {
  id: string;
  mutatesState: false;
  canApply: boolean;
  snapshotSummary: { projectId: string; plannedWorkHours: number; taskCount: number; lessonCount: number };
};

export type ProjectClosureApplyResultDto = {
  snapshotId: string;
  actionExecution: {
    id: string;
    commandType: string;
    auditEventIds: string[];
  };
};

export type ProjectClosureAuditDto = {
  events: Array<{ actionKey: string; target: { entityId: string }; correlationId?: string }>;
  actionExecutions: Array<{
    id: string;
    commandType: string;
    target?: { entityId: string };
  }>;
};

export type ProjectClosureApiClient = {
  getClosure(testUser: string, projectId: string): Promise<ProjectClosureReadModelDto>;
  previewClosure(
    testUser: string,
    projectId: string,
    input: { closureData: Phase9ClosureDataFixture }
  ): Promise<{ preview: ProjectClosurePreviewDto }>;
  applyClosure(testUser: string, projectId: string, input: { previewId?: string }): Promise<{ result: ProjectClosureApplyResultDto }>;
  getAudit(testUser: string): Promise<ProjectClosureAuditDto>;
};

type ApiErrorDto = {
  code: string;
  message: string;
};

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = body as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message), errorBody);
  }

  return body as T;
}

async function sendJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const responseBody = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = responseBody as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message), errorBody);
  }

  return responseBody as T;
}

function withParams(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}`;
}

export function createProjectClosureApiClient(basePath = "/api/api"): ProjectClosureApiClient {
  return {
    getClosure(testUser, projectId) {
      return requestJson<ProjectClosureReadModelDto>(
        withParams(`${basePath}/projects/${encodeURIComponent(projectId)}/closure`, { testUser })
      );
    },
    previewClosure(testUser, projectId, input) {
      return sendJson<{ preview: ProjectClosurePreviewDto }>(
        withParams(`${basePath}/projects/${encodeURIComponent(projectId)}/closure/preview`, { testUser }),
        input
      );
    },
    applyClosure(testUser, projectId, input) {
      return sendJson<{ result: ProjectClosureApplyResultDto }>(
        withParams(`${basePath}/projects/${encodeURIComponent(projectId)}/closure/apply`, { testUser }),
        input
      );
    },
    getAudit(testUser) {
      return requestJson<ProjectClosureAuditDto>(withParams(`${basePath}/retrospectives/audit`, { testUser }));
    }
  };
}
