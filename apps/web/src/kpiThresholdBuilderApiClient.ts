import type { AuditEventDto } from "./phase2ApiClient";
import type { KpiActionExecutionDto, KpiThresholdRuleDto, KpiThresholdRuleSetDto, KpiSeverityDto } from "./kpiDefinitionApiClient";

export type KpiThresholdReadModelDto = {
  thresholds: Array<{
    definitionId: string;
    label: string;
    thresholdRuleSet: KpiThresholdRuleSetDto;
  }>;
  latestEvaluation: {
    id: string;
    severity: KpiSeverityDto;
    value: number;
    thresholdRuleSetVersion: number;
    matchedThresholdRuleId: string | null;
  } | null;
};

export type KpiThresholdPreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  mutatesState: false;
  thresholdRuleSet: KpiThresholdRuleSetDto;
  before: { version: number; severity: KpiSeverityDto; matchedRuleId: string | null };
  after: { version: number; severity: KpiSeverityDto; matchedRuleId: string | null };
  sampleValue: number;
  affectedRuntimeSurfaces: string[];
  createdAt: string;
};

export type KpiThresholdPublishResultDto = {
  result: {
    thresholdRuleSet: KpiThresholdRuleSetDto;
    audit: {
      tenantId: string;
      actorId: string;
      auditEventId: string;
      commandType: "kpi_threshold.publish";
      thresholdRuleSetId: string;
      beforeVersion: number;
      afterVersion: number;
      publishedAt: string;
    };
    actionExecution: KpiActionExecutionDto;
  };
  readback: {
    thresholdRuleSet: KpiThresholdRuleSetDto;
  };
};

export type KpiThresholdAuditDto = {
  events: AuditEventDto[];
  actionExecutions: KpiActionExecutionDto[];
};

export type KpiThresholdBuilderApiClient = {
  getThresholds(testUser: string): Promise<KpiThresholdReadModelDto>;
  previewThresholds(
    testUser: string,
    request: {
      definitionId: string;
      expectedVersion: number;
      rules: KpiThresholdRuleDto[];
      sampleValue: number;
      affectedRuntimeSurfaces: string[];
    }
  ): Promise<KpiThresholdPreviewDto>;
  publishThresholds(testUser: string, request: { previewId: string }): Promise<KpiThresholdPublishResultDto>;
  getAudit(testUser: string): Promise<KpiThresholdAuditDto>;
};

type ApiErrorDto = {
  code: string;
  message: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
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

function withUser(path: string, testUser: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(testUser)}`;
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: "POST",
    body: JSON.stringify(body)
  };
}

export function createKpiThresholdBuilderApiClient(basePath = "/api/api"): KpiThresholdBuilderApiClient {
  return {
    getThresholds(testUser) {
      return requestJson<KpiThresholdReadModelDto>(withUser(`${basePath}/tenant/kpi-thresholds`, testUser));
    },
    async previewThresholds(testUser, request) {
      const body = await requestJson<{ preview: KpiThresholdPreviewDto }>(
        withUser(`${basePath}/tenant/kpi-thresholds/preview`, testUser),
        jsonBody(request)
      );
      return body.preview;
    },
    publishThresholds(testUser, request) {
      return requestJson<KpiThresholdPublishResultDto>(
        withUser(`${basePath}/tenant/kpi-thresholds/publish`, testUser),
        jsonBody(request)
      );
    },
    getAudit(testUser) {
      return requestJson<KpiThresholdAuditDto>(withUser(`${basePath}/tenant/configuration/audit`, testUser));
    }
  };
}
