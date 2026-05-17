import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getPhase11FixtureSeed } from "@kiss-pm/shared-test-fixtures";

export const phase11Seed = getPhase11FixtureSeed();
export const tenantA = phase11Seed.tenantA;
export const tenantB = phase11Seed.tenantB;

export function phase11ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

export function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

export type IntegrationPreviewDto = {
  preview: { id: string; mutatesState: false };
  validationReport: { safeToApply: boolean; summary: { creates: number; totalAffected: number } };
  dryRunSummary: { canApply: boolean; mutatesState: false; expectedTotalAffected: number };
};

export type IntegrationApplyDto = {
  result: { status: "applied" | "idempotent_replay"; idempotentReplay: boolean; batch: { id: string } };
  readback: {
    batches: Array<{ id: string }>;
    mappings: IntegrationMappingDto[];
    audit: Array<{ command: string; result: string }>;
  };
};

export type IntegrationMappingDto = {
  id: string;
  tenantId: string;
  externalEntityType: string;
  externalEntityId: string;
  canonicalEntityType: string;
  canonicalEntityId: string;
  lastSyncStatus: string;
};

export type IntegrationAuditDto = {
  audit: Array<{ id: string; command: string; result: string; correlationId: string }>;
};

export type ProjectDto = {
  project: {
    id: string;
    title: string;
    tasks: Array<{ id: string; title: string; status: string }>;
  };
};

export async function resetPhase11Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase11ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function openKissPm(page: Page, testUser = tenantA.adminUserId, query: Record<string, string> = {}) {
  const params = new URLSearchParams({ testUser, ...query });
  await page.goto(`/?${params.toString()}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export async function openIntegrationAdmin(page: Page, testUser = tenantA.adminUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("integration-admin-surface")).toBeVisible();
  await expect(page.getByTestId("integration-admin-status")).toContainText(/Интеграции загружены|Загрузка интеграций/);
  await expect(page.getByTestId("integration-adapter-list")).toContainText("Mock CRM");
}

export async function previewImport(request: APIRequestContext, testUser = tenantA.adminUserId): Promise<IntegrationPreviewDto> {
  const response = await request.post(
    `${phase11ApiBaseUrl()}/api/integrations/import/preview?testUser=${encodeURIComponent(testUser)}`,
    jsonRequest({
      adapterId: tenantA.adapterId,
      connectionId: tenantA.connectionId,
      payloadFixtureKey: tenantA.validPayloadFixtureKey
    })
  );
  await expect(response).toBeOK();
  return (await response.json()) as IntegrationPreviewDto;
}

export async function applyImport(
  request: APIRequestContext,
  previewId: string,
  batchId: string,
  idempotencyKey: string,
  testUser = tenantA.adminUserId
): Promise<IntegrationApplyDto> {
  const response = await request.post(
    `${phase11ApiBaseUrl()}/api/integrations/import/apply?testUser=${encodeURIComponent(testUser)}`,
    jsonRequest({ previewId, batchId, idempotencyKey, confirmed: true })
  );
  await expect(response).toBeOK();
  return (await response.json()) as IntegrationApplyDto;
}

export async function getMappings(request: APIRequestContext, testUser = tenantA.adminUserId): Promise<IntegrationMappingDto[]> {
  const response = await request.get(`${phase11ApiBaseUrl()}/api/integrations/mappings?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  const body = (await response.json()) as { mappings: IntegrationMappingDto[] };
  return body.mappings;
}

export async function getIntegrationAudit(request: APIRequestContext, testUser = tenantA.adminUserId): Promise<IntegrationAuditDto> {
  const response = await request.get(`${phase11ApiBaseUrl()}/api/integrations/audit?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as IntegrationAuditDto;
}

export async function setAdapterFailure(request: APIRequestContext, testUser = tenantA.adminUserId) {
  const response = await request.post(
    `${phase11ApiBaseUrl()}/api/integrations/connections/${encodeURIComponent(tenantA.connectionId)}/failure-mode?testUser=${encodeURIComponent(
      testUser
    )}`,
    jsonRequest({ code: "adapter_rate_limited", message: "Mock CRM rate limited", retryAfterSeconds: 60 })
  );
  await expect(response).toBeOK();
}

export async function getProject(request: APIRequestContext, projectId: string, testUser = tenantA.projectManagerUserId) {
  const response = await request.get(`${phase11ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as ProjectDto;
}

export async function changeTaskStatus(request: APIRequestContext, taskId: string, toStatus = "in_progress") {
  const response = await request.patch(
    `${phase11ApiBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/status?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`,
    jsonRequest({ toStatus })
  );
  await expect(response).toBeOK();
}

export async function getTaskAudit(request: APIRequestContext, taskId: string) {
  const response = await request.get(
    `${phase11ApiBaseUrl()}/api/audit?testUser=${encodeURIComponent(tenantA.adminUserId)}&targetType=task&targetId=${encodeURIComponent(taskId)}`
  );
  await expect(response).toBeOK();
  return (await response.json()) as { events: Array<{ actionKey: string; target: { entityId: string } }> };
}

export function requireMapping(mappings: IntegrationMappingDto[], canonicalEntityType: string): IntegrationMappingDto {
  const mapping = mappings.find((candidate) => candidate.canonicalEntityType === canonicalEntityType);
  if (mapping === undefined) {
    throw new Error(`Expected mapping for ${canonicalEntityType}`);
  }
  return mapping;
}
