import type { AuditEventDto } from "./phase2ApiClient";

export type TenantLabelSetDto = {
  tenantId: string;
  configurationVersion: number;
  labels: Record<string, string>;
  updatedAt: string;
};

export type RuntimeLabelProjectionDto = {
  roles: Array<{ key: string; label: string }>;
  stages: Array<{ key: string; label: string }>;
  controlSurfaces: Array<{ key: string; label: string }>;
};

export type TenantLabelReadModelDto = {
  labelSet: TenantLabelSetDto;
  runtimeProjection: RuntimeLabelProjectionDto;
};

export type TenantLabelSetPreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  mutatesState: false;
  before: {
    configurationVersion: number;
    labels: Record<string, string>;
  };
  after: {
    configurationVersion: number;
    labels: Record<string, string>;
  };
  changes: Array<{ key: string; beforeLabel: string; afterLabel: string }>;
  affectedRuntimeSurfaces: string[];
  createdAt: string;
};

export type TenantLabelPreviewRequestDto = {
  changes: Array<{ key: string; label: string }>;
  affectedRuntimeSurfaces: string[];
};

export type TenantLabelPublishResultDto = {
  result: {
    labelSet: TenantLabelSetDto;
    audit: {
      tenantId: string;
      actorId: string;
      auditEventId: string;
      commandType: "tenant_label_set.publish";
      beforeConfigurationVersion: number;
      afterConfigurationVersion: number;
      changedKeys: string[];
      publishedAt: string;
    };
    actionExecution: TenantLabelActionExecutionDto;
  };
  readback: {
    runtimeProjection: RuntimeLabelProjectionDto;
  };
};

export type TenantLabelActionExecutionDto = {
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
  auditEventIds?: string[];
  trace: string[];
};

export type TenantLabelAuditDto = {
  events: AuditEventDto[];
  actionExecutions: TenantLabelActionExecutionDto[];
};

export type TenantLabelsApiClient = {
  getLabels(testUser: string): Promise<TenantLabelReadModelDto>;
  previewLabels(testUser: string, request: TenantLabelPreviewRequestDto): Promise<TenantLabelSetPreviewDto>;
  publishLabels(testUser: string, request: { previewId: string }): Promise<TenantLabelPublishResultDto>;
  getAudit(testUser: string): Promise<TenantLabelAuditDto>;
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
    throw Object.assign(new Error(errorBody.message), {
      code: errorBody.code,
      message: errorBody.message
    });
  }

  return body as T;
}

function withUser(path: string, testUser: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(testUser)}`;
}

export function createTenantLabelsApiClient(basePath = "/api"): TenantLabelsApiClient {
  return {
    getLabels(testUser) {
      return requestJson<TenantLabelReadModelDto>(withUser(`${basePath}/tenant/labels`, testUser));
    },
    async previewLabels(testUser, request) {
      const body = await requestJson<{ preview: TenantLabelSetPreviewDto }>(withUser(`${basePath}/tenant/labels/preview`, testUser), {
        method: "POST",
        body: JSON.stringify(request)
      });
      return body.preview;
    },
    publishLabels(testUser, request) {
      return requestJson<TenantLabelPublishResultDto>(withUser(`${basePath}/tenant/labels/publish`, testUser), {
        method: "POST",
        body: JSON.stringify(request)
      });
    },
    getAudit(testUser) {
      return requestJson<TenantLabelAuditDto>(withUser(`${basePath}/tenant/configuration/audit`, testUser));
    }
  };
}
