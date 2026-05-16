import type { AuditEventDto } from "./phase2ApiClient";
import type { KpiActionExecutionDto, KpiEntityTypeDto, KpiSeverityDto } from "./kpiDefinitionApiClient";

export type KpiEvaluationPeriodDto = {
  start: string;
  end: string;
};

export type KpiSourceValueDto = {
  tenantId: string;
  bindingKey: string;
  value: number;
  sourceEntityType: KpiEntityTypeDto;
  sourceEntityId: string;
  sourceField: string;
  observedAt: string;
};

export type KpiEvaluationDto = {
  id: string;
  tenantId: string;
  kpiDefinitionId: string;
  kpiDefinitionVersion: number;
  formulaDefinitionId: string;
  formulaVersion: number;
  thresholdRuleSetId: string;
  thresholdRuleSetVersion: number;
  entityType: KpiEntityTypeDto;
  entityId: string;
  period: KpiEvaluationPeriodDto;
  evaluatedAt: string;
  value: number;
  severity: KpiSeverityDto;
  matchedThresholdRuleId: string | null;
  explanation: string | null;
  recommendedActionKeys: string[];
  sourceTrace: KpiSourceValueDto[];
  formulaTrace: string[];
  thresholdTrace: string[];
};

export type KpiSignalDto = {
  id: string;
  tenantId: string;
  sourceType: "kpi_evaluation";
  sourceEvaluationId: string;
  kpiDefinitionId: string;
  entityType: KpiEntityTypeDto;
  entityId: string;
  period: KpiEvaluationPeriodDto;
  severity: Exclude<KpiSeverityDto, "none">;
  explanation: string;
  recommendedActionKeys: string[];
  status: "open" | "closed" | "superseded";
  actionExecutionState: "not_executed";
  createdAt: string;
  updatedAt: string;
};

export type KpiSignalDetailDto = {
  signal: KpiSignalDto;
  evaluation: KpiEvaluationDto;
};

export type KpiEvaluationRunRequestDto = {
  definitionId: string;
  entity: { type: KpiEntityTypeDto; id: string };
  period: KpiEvaluationPeriodDto;
};

export type KpiEvaluationRunResultDto = {
  evaluation: KpiEvaluationDto;
  signal: KpiSignalDto | null;
  actionExecution: KpiActionExecutionDto;
};

export type KpiDeviationAuditDto = {
  events: AuditEventDto[];
  actionExecutions: KpiActionExecutionDto[];
};

export type KpiDeviationApiClient = {
  listSignals(testUser: string): Promise<KpiSignalDto[]>;
  getSignalDetail(testUser: string, signalId: string): Promise<KpiSignalDetailDto>;
  runEvaluation(testUser: string, request: KpiEvaluationRunRequestDto): Promise<KpiEvaluationRunResultDto>;
  getKpiAudit(testUser: string): Promise<KpiDeviationAuditDto>;
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

function jsonBody(body: unknown): RequestInit {
  return {
    method: "POST",
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

export function kpiSignalStatusLabel(status: KpiSignalDto["status"]): string {
  const labels: Record<KpiSignalDto["status"], string> = {
    open: "Открыт",
    closed: "Закрыт",
    superseded: "Заменен"
  };

  return labels[status];
}

export function kpiRecommendedActionLabel(actionKey: string): string {
  const labels: Record<string, string> = {
    create_corrective_action: "Создать корректирующее действие",
    request_explanation: "Запросить объяснение",
    escalate: "Эскалировать",
    accept_risk: "Принять риск"
  };

  return labels[actionKey] ?? actionKey;
}

export function createKpiDeviationApiClient(basePath = "/api/api"): KpiDeviationApiClient {
  return {
    async listSignals(testUser) {
      const body = await requestJson<{ signals: KpiSignalDto[] }>(withUser(`${basePath}/kpi/deviations`, testUser));
      return body.signals;
    },
    getSignalDetail(testUser, signalId) {
      return requestJson<KpiSignalDetailDto>(
        withUser(`${basePath}/kpi/deviations/${encodeURIComponent(signalId)}`, testUser)
      );
    },
    runEvaluation(testUser, request) {
      return requestJson<KpiEvaluationRunResultDto>(
        withUser(`${basePath}/kpi/evaluations/run`, testUser),
        jsonBody(request)
      );
    },
    getKpiAudit(testUser) {
      return requestJson<KpiDeviationAuditDto>(withUser(`${basePath}/kpi/audit`, testUser));
    }
  };
}
