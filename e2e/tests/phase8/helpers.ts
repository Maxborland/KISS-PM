import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getPhase8FixtureSeed } from "@kiss-pm/shared-test-fixtures";

export const phase8Seed = getPhase8FixtureSeed();
export const tenantA = phase8Seed.tenantA;

export type PortfolioRowDto = {
  id: string;
  entityType: string;
  entityId: string;
  severity: string;
  explanation: string;
  actions: Array<{ key: string; available: boolean; unavailableReason?: string }>;
};

export type PortfolioViewDto = {
  rows: PortfolioRowDto[];
  widgets: Array<{ key: string; value: number; severity?: string }>;
};

export type ActionExecutionDto = {
  id: string;
  commandType: string;
  requiredPermission: string;
  status: string;
  source: { entityType: string; entityId: string };
  target?: { entityType: string; entityId: string };
  correlationId: string;
  inputSummary?: Record<string, unknown>;
};

export type ControlAuditDto = {
  events: Array<{ actionKey: string; target: { entityId: string }; correlationId: string }>;
  actionExecutions: ActionExecutionDto[];
};

export type ProjectTaskDto = {
  id: string;
  title: string;
  projectId: string;
  status: string;
};

export function phase8ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

export function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

export function kpiTarget(rowId = tenantA.criticalSignalRowId, entityId = tenantA.criticalSignalId) {
  return {
    surfaceId: tenantA.surfaceId,
    surfaceKey: "portfolio.control",
    rowId,
    entityType: "kpi_signal",
    entityId
  };
}

export function resourceTarget() {
  return {
    surfaceId: tenantA.surfaceId,
    surfaceKey: "portfolio.control",
    rowId: tenantA.resourceOverloadRowId,
    entityType: "resource_overload",
    entityId: tenantA.resourceOverloadId
  };
}

export async function resetPhase8Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase8ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function openPortfolioControl(page: Page, testUser = tenantA.projectManagerUserId) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("portfolio-control-surface")).toBeVisible();
  await expect(page.getByTestId("portfolio-control-status")).toContainText("Загрузка портфельного контроля");
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText(tenantA.criticalSignalId);
}

export async function openResourceLoadControl(page: Page, testUser = tenantA.resourceManagerUserId) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("resource-load-surface")).toBeVisible();
  await expect(page.getByTestId("resource-load-status")).toContainText("Нагрузка загружена");
}

export function portfolioActionPanel(page: Page) {
  return page.getByTestId("portfolio-control-action-panel");
}

export async function getPortfolioView(request: APIRequestContext, testUser = tenantA.projectManagerUserId): Promise<PortfolioViewDto> {
  const response = await request.get(
    `${phase8ApiBaseUrl()}/api/control/surfaces/${encodeURIComponent(tenantA.surfaceId)}/view?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as PortfolioViewDto;
}

export async function getControlAudit(request: APIRequestContext, testUser = tenantA.adminUserId): Promise<ControlAuditDto> {
  const response = await request.get(`${phase8ApiBaseUrl()}/api/control/audit?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();

  return (await response.json()) as ControlAuditDto;
}

export async function previewAction(
  request: APIRequestContext,
  actionDefinitionId: string,
  target: ReturnType<typeof kpiTarget> | ReturnType<typeof resourceTarget>,
  input: Record<string, unknown>,
  testUser = tenantA.projectManagerUserId
) {
  const response = await request.post(
    `${phase8ApiBaseUrl()}/api/control/actions/${encodeURIComponent(actionDefinitionId)}/preview?testUser=${encodeURIComponent(testUser)}`,
    jsonRequest({ target, input })
  );
  await expect(response).toBeOK();

  return (await response.json()) as { preview: { id: string; mutatesState: boolean; commandType: string } };
}

export async function executeAction(
  request: APIRequestContext,
  actionDefinitionId: string,
  previewId: string,
  testUser = tenantA.projectManagerUserId
) {
  const response = await request.post(
    `${phase8ApiBaseUrl()}/api/control/actions/${encodeURIComponent(actionDefinitionId)}/execute?testUser=${encodeURIComponent(testUser)}`,
    jsonRequest({ previewId })
  );
  await expect(response).toBeOK();

  return (await response.json()) as { result: ActionExecutionDto };
}

export async function createManagedProject(request: APIRequestContext, projectId = tenantA.projectId) {
  const draft = await request.post(
    `${phase8ApiBaseUrl()}/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=${encodeURIComponent(
      tenantA.projectManagerUserId
    )}`,
    jsonRequest({})
  );
  if (![201, 409].includes(draft.status())) {
    throw new Error(`Unexpected draft status: ${draft.status()} ${await draft.text()}`);
  }

  const draftId = "project-draft-opportunity-seed-ready";
  const project = await request.post(
    `${phase8ApiBaseUrl()}/api/projects/from-template?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`,
    jsonRequest({ projectDraftId: draftId, projectId })
  );
  if (![201, 409].includes(project.status())) {
    throw new Error(`Unexpected project status: ${project.status()} ${await project.text()}`);
  }
}

export async function listProjectTasks(request: APIRequestContext, projectId = tenantA.projectId): Promise<ProjectTaskDto[]> {
  const response = await request.get(
    `${phase8ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/tasks?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { tasks: ProjectTaskDto[] };

  return body.tasks;
}

export async function getLoadBucket(request: APIRequestContext, testUser = tenantA.resourceManagerUserId) {
  const response = await request.get(
    `${phase8ApiBaseUrl()}/api/resources/load/${encodeURIComponent(tenantA.loadBucketId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as { bucket: { totalLoadHours: number; severity: string } };
}

export async function getResourceAudit(request: APIRequestContext, testUser = tenantA.adminUserId) {
  const response = await request.get(`${phase8ApiBaseUrl()}/api/resources/audit?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();

  return (await response.json()) as ControlAuditDto;
}
