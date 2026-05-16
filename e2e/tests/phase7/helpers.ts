import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getPhase7FixtureSeed } from "@kiss-pm/shared-test-fixtures";

export const phase7Seed = getPhase7FixtureSeed();
export const tenantADefinitionId = phase7Seed.tenantA.definition.id;
export const tenantASignalId = phase7Seed.tenantA.signal.id;
export const tenantAEvaluationId = phase7Seed.tenantA.signal.evaluationId;
export const tenantADraftDefinitionId = phase7Seed.tenantA.draftDefinitionId;

export type KpiDefinitionDto = {
  id: string;
  tenantId: string;
  label: string;
  version: number;
  formulaDefinitionId: string;
  thresholdRuleSetId: string;
  active: boolean;
};

export type KpiDefinitionBundleDto = KpiDefinitionDto & {
  formula: { id: string; expression: string; version: number };
  thresholdRuleSet: {
    id: string;
    version: number;
    rules: Array<{ id: string; severity: string; condition: { operator: string; value?: number } }>;
  };
};

export type KpiEvaluationDto = {
  id: string;
  kpiDefinitionId: string;
  kpiDefinitionVersion: number;
  formulaDefinitionId: string;
  formulaVersion: number;
  thresholdRuleSetId: string;
  thresholdRuleSetVersion: number;
  entityId: string;
  value: number;
  severity: "none" | "attention" | "warning" | "critical";
  matchedThresholdRuleId: string | null;
  sourceTrace: Array<{ bindingKey: string; value: number; sourceEntityId: string; observedAt: string }>;
  formulaTrace: string[];
  thresholdTrace: string[];
};

export type KpiSignalDto = {
  id: string;
  sourceEvaluationId: string;
  kpiDefinitionId: string;
  entityId: string;
  severity: "attention" | "warning" | "critical";
  explanation: string;
  recommendedActionKeys: string[];
  status: "open" | "closed" | "superseded";
};

export type KpiAuditDto = {
  events: Array<{ actionKey: string; target: { entityId: string }; correlationId: string }>;
  actionExecutions: Array<{
    commandType: string;
    requiredPermission: string;
    status: string;
    source: { entityId: string };
    target?: { entityId: string };
  }>;
};

export function phase7ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

export async function resetPhase7Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase7ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function openKpiDefinitionAdmin(page: Page, testUser = phase7Seed.tenantA.adminUserId) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("kpi-definition-admin")).toBeVisible();
  await expect(page.getByTestId("kpi-definition-status")).toContainText("KPI данные загружены");
}

export async function openKpiDeviationControl(page: Page, testUser = phase7Seed.tenantA.projectManagerUserId) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("kpi-deviation-control")).toBeVisible();
  await expect(page.getByTestId("kpi-deviation-status")).toContainText("KPI-отклонения загружены");
}

export async function listDefinitions(
  request: APIRequestContext,
  testUser = phase7Seed.tenantA.adminUserId
): Promise<KpiDefinitionBundleDto[]> {
  const response = await request.get(`${phase7ApiBaseUrl()}/api/kpi/definitions?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  const body = (await response.json()) as { definitions: KpiDefinitionBundleDto[] };

  return body.definitions;
}

export async function getDefinition(
  request: APIRequestContext,
  definitionId = tenantADefinitionId,
  testUser = phase7Seed.tenantA.adminUserId
) {
  const response = await request.get(
    `${phase7ApiBaseUrl()}/api/kpi/definitions/${encodeURIComponent(definitionId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as {
    definition: KpiDefinitionDto;
    formula: { id: string; version: number; expression: string };
    thresholdRuleSet: { id: string; version: number; rules: KpiDefinitionBundleDto["thresholdRuleSet"]["rules"] };
  };
}

export async function listSignals(
  request: APIRequestContext,
  testUser = phase7Seed.tenantA.projectManagerUserId
): Promise<KpiSignalDto[]> {
  const response = await request.get(`${phase7ApiBaseUrl()}/api/kpi/deviations?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  const body = (await response.json()) as { signals: KpiSignalDto[] };

  return body.signals;
}

export async function getSignalDetail(
  request: APIRequestContext,
  signalId = tenantASignalId,
  testUser = phase7Seed.tenantA.projectManagerUserId
) {
  const response = await request.get(
    `${phase7ApiBaseUrl()}/api/kpi/deviations/${encodeURIComponent(signalId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as { signal: KpiSignalDto; evaluation: KpiEvaluationDto };
}

export async function getEvaluation(
  request: APIRequestContext,
  evaluationId = tenantAEvaluationId,
  testUser = phase7Seed.tenantA.projectManagerUserId
): Promise<KpiEvaluationDto> {
  const response = await request.get(
    `${phase7ApiBaseUrl()}/api/kpi/evaluations/${encodeURIComponent(evaluationId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { evaluation: KpiEvaluationDto };

  return body.evaluation;
}

export async function runKpiEvaluation(
  request: APIRequestContext,
  definitionId = tenantADefinitionId,
  testUser = phase7Seed.tenantA.projectManagerUserId
) {
  const response = await request.post(
    `${phase7ApiBaseUrl()}/api/kpi/evaluations/run?testUser=${encodeURIComponent(testUser)}`,
    jsonRequest({
      definitionId,
      entity: { type: "project", id: phase7Seed.tenantA.definition.projectId },
      period: {
        start: phase7Seed.tenantA.definition.periodStart,
        end: phase7Seed.tenantA.definition.periodEnd
      }
    })
  );
  await expect(response).toBeOK();

  return (await response.json()) as {
    evaluation: KpiEvaluationDto;
    signal: KpiSignalDto | null;
    actionExecution: { commandType: string; requiredPermission: string; status: string };
  };
}

export async function getKpiAudit(
  request: APIRequestContext,
  testUser = phase7Seed.tenantA.adminUserId
): Promise<KpiAuditDto> {
  const response = await request.get(`${phase7ApiBaseUrl()}/api/kpi/audit?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();

  return (await response.json()) as KpiAuditDto;
}

export function phase7DraftPayload(criticalThresholdValue = -25) {
  return {
    id: tenantADraftDefinitionId,
    systemKey: "api_draft_variance",
    label: "Отклонение API",
    entityType: "project",
    ownerRoleKey: "project_manager",
    unit: "percent",
    evaluationCadence: "weekly",
    formula: {
      id: phase7Seed.tenantA.draftFormulaId,
      expression: "((plannedWorkHours - actualWorkHours) / plannedWorkHours) * 100",
      sourceBindings: [
        {
          key: "plannedWorkHours",
          label: "Плановые часы",
          sourceType: "schedule",
          sourceField: "plannedWorkHours",
          valueType: "number"
        },
        {
          key: "actualWorkHours",
          label: "Фактические часы",
          sourceType: "worklog",
          sourceField: "actualWorkHours",
          valueType: "number"
        }
      ]
    },
    thresholdRuleSet: {
      id: phase7Seed.tenantA.draftThresholdRuleSetId,
      rules: [
        {
          id: "api-draft-critical",
          severity: "critical",
          condition: { operator: "lte", value: criticalThresholdValue },
          explanation: "Отклонение API критическое",
          recommendedActionKeys: ["create_corrective_action"]
        }
      ]
    }
  };
}

export async function createAndPublishDraftThroughApi(
  request: APIRequestContext,
  criticalThresholdValue = -25,
  testUser = phase7Seed.tenantA.adminUserId
) {
  const create = await request.post(
    `${phase7ApiBaseUrl()}/api/kpi/definitions?testUser=${encodeURIComponent(testUser)}`,
    jsonRequest(phase7DraftPayload(criticalThresholdValue))
  );
  await expect(create).toBeOK();

  const publish = await request.post(
    `${phase7ApiBaseUrl()}/api/kpi/definitions/${encodeURIComponent(tenantADraftDefinitionId)}/publish?testUser=${encodeURIComponent(
      testUser
    )}`,
    jsonRequest({ expectedVersion: 1 })
  );
  await expect(publish).toBeOK();

  return publish.json();
}
