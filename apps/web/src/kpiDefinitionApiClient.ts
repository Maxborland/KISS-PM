import type { AuditEventDto } from "./phase2ApiClient";

export type KpiSeverityDto = "none" | "attention" | "warning" | "critical";
export type KpiEntityTypeDto = "opportunity" | "project" | "project_stage" | "task" | "resource";
export type KpiEvaluationCadenceDto = "daily" | "weekly" | "monthly" | "manual";

export type KpiSourceBindingDto = {
  key: string;
  label: string;
  sourceType: "crm" | "project" | "schedule" | "resource" | "worklog" | "task" | "kpi";
  sourceField: string;
  valueType: "number";
};

export type KpiThresholdRuleDto = {
  id: string;
  severity: Exclude<KpiSeverityDto, "none">;
  condition:
    | { operator: "gt" | "gte" | "lt" | "lte" | "eq"; value: number }
    | { operator: "between"; min: number; max: number; inclusive?: boolean };
  explanation: string;
  recommendedActionKeys: string[];
};

export type KpiDefinitionDto = {
  id: string;
  tenantId: string;
  systemKey: string;
  label: string;
  entityType: KpiEntityTypeDto;
  ownerRoleKey: string;
  unit: string;
  version: number;
  formulaDefinitionId: string;
  thresholdRuleSetId: string;
  evaluationCadence: KpiEvaluationCadenceDto;
  active: boolean;
};

export type KpiFormulaDefinitionDto = {
  id: string;
  tenantId: string;
  version: number;
  expression: string;
  sourceBindings: KpiSourceBindingDto[];
  active: boolean;
};

export type KpiThresholdRuleSetDto = {
  id: string;
  tenantId: string;
  version: number;
  rules: KpiThresholdRuleDto[];
  active: boolean;
};

export type KpiDefinitionListItemDto = KpiDefinitionDto & {
  formula: KpiFormulaDefinitionDto;
  thresholdRuleSet: KpiThresholdRuleSetDto;
};

export type KpiDefinitionConfigDto = {
  id: string;
  systemKey: string;
  label: string;
  entityType: KpiEntityTypeDto;
  ownerRoleKey: string;
  unit: string;
  evaluationCadence: KpiEvaluationCadenceDto;
  formula: {
    id: string;
    expression: string;
    sourceBindings: KpiSourceBindingDto[];
  };
  thresholdRuleSet: {
    id: string;
    rules: KpiThresholdRuleDto[];
  };
};

export type KpiDefinitionPreviewDto = {
  mutatesState: false;
  value: number;
  severity: KpiSeverityDto;
  matchedRuleId?: string;
  formulaTrace: string[];
  thresholdTrace: string[];
  recommendedActionKeys: string[];
};

export type KpiActionExecutionDto = {
  id: string;
  tenantId: string;
  actorId: string;
  commandType: string;
  requiredPermission: string;
  status: string;
  source: { entityType: string; entityId: string };
  target?: { entityType: string; entityId: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  correlationId: string;
  trace: string[];
};

export type KpiAuditDto = {
  events: AuditEventDto[];
  actionExecutions: KpiActionExecutionDto[];
};

export type KpiDefinitionCreateResultDto = {
  definition: KpiDefinitionDto;
  formula: KpiFormulaDefinitionDto;
  thresholdRuleSet: KpiThresholdRuleSetDto;
  result: { actionExecution: KpiActionExecutionDto };
  readback: { definitions: KpiDefinitionListItemDto[] };
};

export type KpiDefinitionVersionResultDto = {
  result: { actionExecution: KpiActionExecutionDto };
  readback: {
    definition: KpiDefinitionDto;
    formula: KpiFormulaDefinitionDto;
    thresholdRuleSet: KpiThresholdRuleSetDto;
  };
};

export type KpiDefinitionApiClient = {
  listDefinitions(testUser: string): Promise<KpiDefinitionListItemDto[]>;
  previewDefinition(
    testUser: string,
    request: KpiDefinitionConfigDto & { sampleValues: Record<string, number> }
  ): Promise<KpiDefinitionPreviewDto>;
  createDefinition(testUser: string, request: KpiDefinitionConfigDto): Promise<KpiDefinitionCreateResultDto>;
  publishDefinition(
    testUser: string,
    definitionId: string,
    request: { expectedVersion: number; reason?: string }
  ): Promise<KpiDefinitionVersionResultDto>;
  retireDefinition(
    testUser: string,
    definitionId: string,
    request: { expectedVersion: number; reason?: string }
  ): Promise<KpiDefinitionVersionResultDto>;
  getKpiAudit(testUser: string): Promise<KpiAuditDto>;
};

type ApiErrorDto = {
  code: string;
  message: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = body as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message), errorBody);
  }

  return body as T;
}

function jsonBody(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function withUser(path: string, testUser: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(testUser)}`;
}

export function kpiSeverityLabel(severity: KpiSeverityDto): string {
  const labels: Record<KpiSeverityDto, string> = {
    none: "Норма",
    attention: "Внимание",
    warning: "Риск",
    critical: "Критическая"
  };

  return labels[severity];
}

export function createKpiDefinitionApiClient(basePath = "/api"): KpiDefinitionApiClient {
  return {
    async listDefinitions(testUser) {
      const body = await requestJson<{ definitions: KpiDefinitionListItemDto[] }>(
        withUser(`${basePath}/kpi/definitions`, testUser)
      );
      return body.definitions;
    },
    async previewDefinition(testUser, request) {
      const body = await requestJson<{ preview: KpiDefinitionPreviewDto }>(
        withUser(`${basePath}/kpi/definitions/preview`, testUser),
        jsonBody(request)
      );
      return body.preview;
    },
    createDefinition(testUser, request) {
      return requestJson<KpiDefinitionCreateResultDto>(
        withUser(`${basePath}/kpi/definitions`, testUser),
        jsonBody(request)
      );
    },
    publishDefinition(testUser, definitionId, request) {
      return requestJson<KpiDefinitionVersionResultDto>(
        withUser(`${basePath}/kpi/definitions/${encodeURIComponent(definitionId)}/publish`, testUser),
        jsonBody(request)
      );
    },
    retireDefinition(testUser, definitionId, request) {
      return requestJson<KpiDefinitionVersionResultDto>(
        withUser(`${basePath}/kpi/definitions/${encodeURIComponent(definitionId)}/retire`, testUser),
        jsonBody(request)
      );
    },
    getKpiAudit(testUser) {
      return requestJson<KpiAuditDto>(withUser(`${basePath}/kpi/audit`, testUser));
    }
  };
}
