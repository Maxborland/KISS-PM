import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getPhase10FixtureSeed } from "@kiss-pm/shared-test-fixtures";

export const phase10Seed = getPhase10FixtureSeed();
export const tenantA = phase10Seed.tenantA;
export const tenantB = phase10Seed.tenantB;

export function phase10ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

export function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

export type ConfigurationAuditDto = {
  events: Array<{ id: string; actionKey: string; target: { entityId: string } }>;
  actionExecutions: Array<{
    id: string;
    commandType: string;
    requiredPermission: string;
    status: string;
    auditEventIds?: string[];
  }>;
};

export type TenantLabelsDto = {
  labelSet: { configurationVersion: number; labels: Record<string, string> };
  runtimeProjection: {
    roles: Array<{ key: string; label: string }>;
    stages: Array<{ key: string; label: string }>;
  };
};

export type CustomFieldRegistryDto = {
  registry: { version: number; definitions: Array<{ key: string; label: string }> };
};

export type PortfolioViewDto = {
  surface: { version: number };
  fields: Array<{ key: string; label: string }>;
  rows: Array<{ id: string; entityType: string; label: string; fieldValues: Record<string, unknown>; actions: Array<{ key: string; available: boolean; unavailableReason?: string }> }>;
  savedViews?: Array<{ key: string; label: string }>;
};

export type ThresholdReadbackDto = {
  thresholds: Array<{ definitionId: string; thresholdRuleSet: { version: number } }>;
  latestEvaluation: { thresholdRuleSetVersion: number };
};

export type ConfigurationOverviewDto = {
  active: {
    configurationVersion: number;
    labelSetVersion: number;
    customFieldRegistryVersion: number;
    actionConfigurationVersion: number;
  };
};

export type ProcessTemplateReadModelDto = {
  templates: Array<{
    id: string;
    version: number;
    label: string;
    stages: Array<{ id: string; key: string; label: string }>;
  }>;
};

export async function resetPhase10Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase10ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function openKissPm(page: Page, testUser = tenantA.adminUserId) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export async function openTenantLabels(page: Page, testUser = tenantA.adminUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("tenant-labels-admin")).toBeVisible();
  await expect(page.getByTestId("tenant-labels-status")).toContainText("Метки загружены из API");
}

export async function openCustomFields(page: Page, testUser = tenantA.adminUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("custom-field-builder-surface")).toBeVisible();
  await expect(page.getByTestId("custom-field-status")).toContainText("Реестр загружен из API");
}

export async function openKpiThresholds(page: Page, testUser = tenantA.adminUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("kpi-threshold-builder-surface")).toBeVisible();
  await expect(page.getByTestId("kpi-threshold-status")).toContainText("Пороги загружены из API");
}

export async function openSavedViews(page: Page, testUser = tenantA.adminUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("saved-view-layout-builder-surface")).toBeVisible();
  await expect(page.getByTestId("saved-view-layout-status")).toContainText("Макет загружен из API");
}

export async function openActionConfigs(page: Page, testUser = tenantA.adminUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("action-config-surface")).toBeVisible();
  await expect(page.getByTestId("action-config-status")).toContainText("Конфигурация действий загружена из API");
}

export async function openConfigurationOverview(page: Page, testUser = tenantA.adminUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("configuration-overview-surface")).toBeVisible();
  await expect(page.getByTestId("configuration-overview-status")).toContainText("Конфигурация загружена из API");
}

export async function getTenantLabels(request: APIRequestContext, testUser = tenantA.adminUserId): Promise<TenantLabelsDto> {
  const response = await request.get(`${phase10ApiBaseUrl()}/api/tenant/labels?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as TenantLabelsDto;
}

export async function getConfigurationAudit(
  request: APIRequestContext,
  testUser = tenantA.adminUserId
): Promise<ConfigurationAuditDto> {
  const response = await request.get(`${phase10ApiBaseUrl()}/api/tenant/configuration/audit?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as ConfigurationAuditDto;
}

export async function getCustomFields(
  request: APIRequestContext,
  testUser = tenantA.adminUserId
): Promise<CustomFieldRegistryDto> {
  const response = await request.get(`${phase10ApiBaseUrl()}/api/tenant/custom-fields?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as CustomFieldRegistryDto;
}

export async function getPortfolioView(request: APIRequestContext, testUser = tenantA.adminUserId): Promise<PortfolioViewDto> {
  const response = await request.get(
    `${phase10ApiBaseUrl()}/api/control/surfaces/${encodeURIComponent(tenantA.savedView.surfaceId)}/view?testUser=${encodeURIComponent(
      testUser
    )}`
  );
  await expect(response).toBeOK();
  return (await response.json()) as PortfolioViewDto;
}

export async function getKpiThresholds(
  request: APIRequestContext,
  testUser = tenantA.adminUserId
): Promise<ThresholdReadbackDto> {
  const response = await request.get(`${phase10ApiBaseUrl()}/api/tenant/kpi-thresholds?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as ThresholdReadbackDto;
}

export async function getConfigurationOverview(
  request: APIRequestContext,
  testUser = tenantA.adminUserId
): Promise<ConfigurationOverviewDto> {
  const response = await request.get(`${phase10ApiBaseUrl()}/api/tenant/configuration?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as ConfigurationOverviewDto;
}

export async function getProcessTemplates(
  request: APIRequestContext,
  testUser = tenantA.adminUserId
): Promise<ProcessTemplateReadModelDto> {
  const response = await request.get(`${phase10ApiBaseUrl()}/api/tenant/process-templates?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as ProcessTemplateReadModelDto;
}

export async function createOpportunity(request: APIRequestContext, opportunityId: string) {
  const response = await request.post(
    `${phase10ApiBaseUrl()}/api/crm/opportunities?testUser=${encodeURIComponent(tenantA.adminUserId)}`,
    jsonRequest({
      title: `Phase 10 future template ${opportunityId}`,
      account: { displayName: "АКМЕ P10" },
      contacts: [{ displayName: "Анна P10", email: "anna-p10@example.test", roleLabel: "Заказчик" }],
      plannedStartDate: "2026-06-01",
      desiredFinishDate: "2026-06-30",
      expectedValue: { amount: 1_500_000, currency: "RUB" },
      probability: 0.75,
      categoryKey: "implementation",
      typologyKey: "integration_heavy",
      scopeHints: [
        { key: "integrations_count", label: "Количество интеграций", value: 3 },
        { key: "modules_count", label: "Количество модулей", value: 5 }
      ],
      customFieldRefs: []
    })
  );
  if (![201, 409].includes(response.status())) {
    throw new Error(`createOpportunity failed with ${response.status()}: ${await response.text()}`);
  }
  if (response.status() === 201) {
    const body = (await response.json()) as { opportunity: { id: string } };
    return body.opportunity.id;
  }
  return opportunityId;
}

export async function createManagedProject(
  request: APIRequestContext,
  projectId = tenantA.customField.projectId,
  opportunityId = "opportunity-seed-ready"
) {
  const draft = await request.post(
    `${phase10ApiBaseUrl()}/api/crm/opportunities/${opportunityId}/project-draft?testUser=${encodeURIComponent(
      tenantA.adminUserId
    )}`,
    jsonRequest({})
  );
  expect([201, 409]).toContain(draft.status());
  const draftBody =
    draft.status() === 201
      ? ((await draft.json()) as { projectDraft: { id: string } })
      : { projectDraft: { id: `project-draft-${opportunityId}` } };

  const project = await request.post(
    `${phase10ApiBaseUrl()}/api/projects/from-template?testUser=${encodeURIComponent(tenantA.adminUserId)}`,
    jsonRequest({ projectDraftId: draftBody.projectDraft.id, projectId })
  );
  expect([201, 409]).toContain(project.status());
  return projectId;
}

export async function getProject(request: APIRequestContext, projectId: string, testUser = tenantA.adminUserId) {
  const response = await request.get(
    `${phase10ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();
  return (await response.json()) as {
    project: {
      id: string;
      lifecycleStatus: string;
      currentStageId: string;
      customFieldValues: unknown[];
      processTemplateSnapshot?: { version: number; label: string };
      stages?: Array<{ templateKey: string; label: string }>;
    };
  };
}

export async function runFutureKpiEvaluation(request: APIRequestContext) {
  const response = await request.post(
    `${phase10ApiBaseUrl()}/api/kpi/evaluations/run?testUser=${encodeURIComponent(tenantA.runtimeUserId)}`,
    jsonRequest({
      definitionId: tenantA.kpiThreshold.definitionId,
      entity: { type: "project", id: tenantA.kpiThreshold.futureEvaluationProjectId },
      period: { start: "2026-06-08", end: "2026-06-14" }
    })
  );
  await expect(response).toBeOK();
  return (await response.json()) as { evaluation: { severity: string; thresholdRuleSetVersion: number; matchedThresholdRuleId: string } };
}
