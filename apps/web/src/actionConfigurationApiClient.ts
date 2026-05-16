import type { AuditEventDto } from "./phase2ApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

export type ActionFormFieldConfigDto = {
  fieldKey: string;
  label?: string;
  defaultValue?: string | number | boolean;
};

export type ActionConfigurationSetDto = {
  tenantId: string;
  version: number;
  actionConfigs: Array<{
    actionKey: string;
    enabled: boolean;
    formFields: ActionFormFieldConfigDto[];
  }>;
  updatedAt: string;
};

export type ActionConfigurationReadModelDto = {
  configuration: ActionConfigurationSetDto;
  actions: Array<{
    id: string;
    key: string;
    label: string;
    description: string;
    version: number;
    targetEntityType: string;
    commandType: string;
    requiredPermission: string;
    dryRunRequired: boolean;
    enabled: boolean;
    disabledReason?: "configuration_disabled";
    inputSchema: {
      fields: Array<{ key: string; label: string; valueType: string; required: boolean; summary: boolean }>;
    };
    formFields: ActionFormFieldConfigDto[];
  }>;
  runtime: {
    affectedRuntimeSurfaces: string[];
    disabledActionKeys: string[];
  };
};

export type ActionConfigurationPreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  mutatesState: false;
  before: { version: number; disabledActionKeys: string[] };
  after: { version: number; disabledActionKeys: string[] };
  formChanges: Array<{ actionKey: string; fieldKeys: string[] }>;
  affectedRuntimeSurfaces: string[];
  createdAt: string;
};

export type ActionConfigurationDraftDto = {
  expectedVersion: number;
  actionConfigs: Array<{
    actionKey: string;
    enabled: boolean;
    formFields: ActionFormFieldConfigDto[];
  }>;
  affectedRuntimeSurfaces: string[];
};

export type ActionConfigurationPublishResultDto = {
  result: {
    configuration: ActionConfigurationSetDto;
    audit: {
      tenantId: string;
      actorId: string;
      auditEventId: string;
      commandType: "action_configuration.publish";
      beforeVersion: number;
      afterVersion: number;
      disabledActionKeys: string[];
      publishedAt: string;
    };
    actionExecution: TenantLabelActionExecutionDto;
  };
  readback: ActionConfigurationReadModelDto;
};

export type ActionConfigurationAuditDto = {
  events: AuditEventDto[];
  actionExecutions: TenantLabelActionExecutionDto[];
};

export type ActionConfigurationApiClient = {
  getActionConfigs(testUser: string): Promise<ActionConfigurationReadModelDto>;
  previewActionConfigs(testUser: string, draft: ActionConfigurationDraftDto): Promise<ActionConfigurationPreviewDto>;
  publishActionConfigs(testUser: string, request: { previewId: string }): Promise<ActionConfigurationPublishResultDto>;
  getAudit(testUser: string): Promise<ActionConfigurationAuditDto>;
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
    throw Object.assign(new Error(errorBody.message || `HTTP ${response.status}`), {
      code: errorBody.code,
      message: errorBody.message || `HTTP ${response.status}`
    });
  }

  return body as T;
}

function withUser(path: string, testUser: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(testUser)}`;
}

export function createActionConfigurationApiClient(basePath = "/api/api"): ActionConfigurationApiClient {
  return {
    getActionConfigs(testUser) {
      return requestJson<ActionConfigurationReadModelDto>(withUser(`${basePath}/tenant/action-configs`, testUser));
    },
    async previewActionConfigs(testUser, draft) {
      const body = await requestJson<{ preview: ActionConfigurationPreviewDto }>(
        withUser(`${basePath}/tenant/action-configs/preview`, testUser),
        {
          method: "POST",
          body: JSON.stringify(draft)
        }
      );
      return body.preview;
    },
    publishActionConfigs(testUser, request) {
      return requestJson<ActionConfigurationPublishResultDto>(withUser(`${basePath}/tenant/action-configs/publish`, testUser), {
        method: "POST",
        body: JSON.stringify(request)
      });
    },
    getAudit(testUser) {
      return requestJson<ActionConfigurationAuditDto>(withUser(`${basePath}/tenant/configuration/audit`, testUser));
    }
  };
}
