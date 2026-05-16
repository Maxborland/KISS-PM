import type { AuditEventDto } from "./phase2ApiClient";
import type { ControlSurfaceReadModelDto } from "./portfolioControlApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

export type CustomFieldValueTypeDto = "text" | "number" | "date" | "boolean" | "single_select" | "multi_select";

export type CustomFieldDefinitionDto = {
  id: string;
  tenantId: string;
  targetEntityType: string;
  key: string;
  label: string;
  valueType: CustomFieldValueTypeDto;
  required: boolean;
  active: boolean;
  version: number;
  validationRules?: Record<string, string | number | boolean | string[] | number[]>;
  visibilityRules?: Array<{ surfaceKey: string; visible: boolean }>;
  permissionRules?: {
    readPermissionKey?: string;
    writePermissionKey?: string;
  };
  bindingFlags: {
    usableInFilters: boolean;
    usableInControlSurfaces: boolean;
    usableInKpiSourceBindings: boolean;
  };
  updatedAt: string;
};

export type CustomFieldRegistryDto = {
  tenantId: string;
  version: number;
  definitions: CustomFieldDefinitionDto[];
  updatedAt: string;
};

export type CustomFieldDefinitionDraftDto = {
  id: string;
  targetEntityType: "project";
  key: string;
  label: string;
  valueType: "single_select";
  required: boolean;
  active: boolean;
  validationRules: { options: string[] };
  visibilityRules: Array<{ surfaceKey: string; visible: boolean }>;
  permissionRules: {
    readPermissionKey: string;
    writePermissionKey: string;
  };
  bindingFlags: {
    usableInFilters: boolean;
    usableInControlSurfaces: boolean;
    usableInKpiSourceBindings: boolean;
  };
};

export type CustomFieldPreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  mutatesState: false;
  before: { registryVersion: number; definitionCount: number };
  after: { registryVersion: number; definitionCount: number };
  definition: CustomFieldDefinitionDto;
  affectedRuntimeSurfaces: string[];
  createdAt: string;
};

export type CustomFieldPublishResultDto = {
  result: {
    registry: CustomFieldRegistryDto;
    audit: {
      tenantId: string;
      actorId: string;
      auditEventId: string;
      commandType: "custom_field.publish";
      definitionId: string;
      beforeRegistryVersion: number;
      afterRegistryVersion: number;
      publishedAt: string;
    };
    actionExecution: TenantLabelActionExecutionDto;
  };
  readback: {
    registry: CustomFieldRegistryDto;
  };
};

export type ProjectCustomFieldValueRecordDto = {
  id: string;
  tenantId: string;
  projectId: string;
  definitionId: string;
  definitionVersion: number;
  fieldKey: string;
  valueType: CustomFieldValueTypeDto;
  value: string | number | boolean | string[] | null;
  updatedBy: string;
  updatedAt: string;
  correlationId: string;
  auditEventId?: string;
};

export type ProjectCustomFieldValueWriteResultDto = {
  result: {
    valueRecord: ProjectCustomFieldValueRecordDto;
    actionExecution: TenantLabelActionExecutionDto;
  };
  readback: {
    project: {
      id: string;
      customFieldValues: ProjectCustomFieldValueRecordDto[];
    };
  };
};

export type CustomFieldAuditDto = {
  events: AuditEventDto[];
  actionExecutions: TenantLabelActionExecutionDto[];
};

export type CustomFieldBuilderApiClient = {
  getCustomFieldRegistry(testUser: string): Promise<{ registry: CustomFieldRegistryDto }>;
  previewCustomField(
    testUser: string,
    request: { expectedRegistryVersion: number; draft: CustomFieldDefinitionDraftDto; affectedRuntimeSurfaces: string[] }
  ): Promise<CustomFieldPreviewDto>;
  publishCustomField(testUser: string, request: { previewId: string }): Promise<CustomFieldPublishResultDto>;
  setProjectCustomFieldValue(
    testUser: string,
    projectId: string,
    fieldKey: string,
    request: { value: string | number | boolean | string[] | null }
  ): Promise<ProjectCustomFieldValueWriteResultDto>;
  getPortfolioSurfaceView(testUser: string): Promise<ControlSurfaceReadModelDto>;
  getAudit(testUser: string): Promise<CustomFieldAuditDto>;
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

function jsonBody(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    body: JSON.stringify(body)
  };
}

export function createCustomFieldBuilderApiClient(basePath = "/api/api"): CustomFieldBuilderApiClient {
  return {
    getCustomFieldRegistry(testUser) {
      return requestJson<{ registry: CustomFieldRegistryDto }>(withUser(`${basePath}/tenant/custom-fields`, testUser));
    },
    async previewCustomField(testUser, request) {
      const body = await requestJson<{ preview: CustomFieldPreviewDto }>(
        withUser(`${basePath}/tenant/custom-fields/preview`, testUser),
        jsonBody(request)
      );
      return body.preview;
    },
    publishCustomField(testUser, request) {
      return requestJson<CustomFieldPublishResultDto>(
        withUser(`${basePath}/tenant/custom-fields/publish`, testUser),
        jsonBody(request)
      );
    },
    setProjectCustomFieldValue(testUser, projectId, fieldKey, request) {
      return requestJson<ProjectCustomFieldValueWriteResultDto>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}/custom-fields/${encodeURIComponent(fieldKey)}`, testUser),
        jsonBody(request, "PUT")
      );
    },
    getPortfolioSurfaceView(testUser) {
      return requestJson<ControlSurfaceReadModelDto>(withUser(`${basePath}/control/surfaces/portfolio-control/view`, testUser));
    },
    getAudit(testUser) {
      return requestJson<CustomFieldAuditDto>(withUser(`${basePath}/tenant/configuration/audit`, testUser));
    }
  };
}
