import type { AuditEventDto } from "./phase2ApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

export type ConfigurationValidationIssueDto = {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
  affectedRuntimeSurface?: string;
  recoveryText?: string;
};

export type ConfigurationOverviewDto = {
  active: {
    tenantId: string;
    configurationVersion: number;
    labelSetVersion: number;
    customFieldRegistryVersion: number;
    actionConfigurationVersion: number;
  };
  validation: {
    canPublish: boolean;
    issues: ConfigurationValidationIssueDto[];
  };
  runtimeSurfaces: string[];
  versions: {
    labelSet: Array<{ version: number; updatedAt: string }>;
    customFieldRegistry: Array<{ version: number; updatedAt: string }>;
    actionConfiguration: Array<{ version: number; updatedAt: string }>;
  };
};

export type ConfigurationExportPackageDto = {
  schemaVersion: 1;
  tenantId: string;
  configurationVersion: number;
  exportedAt: string;
  checksum: string;
  labelSet: {
    tenantId: string;
    configurationVersion: number;
    labels: Record<string, string>;
    updatedAt: string;
  };
  customFieldRegistry: {
    tenantId: string;
    version: number;
    definitions: unknown[];
    updatedAt: string;
  };
  actionConfiguration: {
    tenantId: string;
    version: number;
    actionConfigs: Array<{
      actionKey: string;
      enabled: boolean;
      formFields: Array<{ fieldKey: string; label?: string; defaultValue?: string | number | boolean }>;
    }>;
    updatedAt: string;
  };
};

export type ConfigurationImportPreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  mutatesState: false;
  canApply: boolean;
  checksum: string;
  before: {
    configurationVersion: number;
    labelSetVersion: number;
    customFieldRegistryVersion: number;
    actionConfigurationVersion: number;
  };
  after: {
    configurationVersion: number;
    labelSetVersion: number;
    customFieldRegistryVersion: number;
    actionConfigurationVersion: number;
  };
  diffs: Array<{ kind: string; path: string; beforeVersion: number; afterVersion: number }>;
  validationIssues: ConfigurationValidationIssueDto[];
  createdAt: string;
};

export type ConfigurationImportApplyResultDto = {
  result: {
    importedPackage: ConfigurationExportPackageDto;
    audit: {
      tenantId: string;
      actorId: string;
      auditEventId: string;
      commandType: "tenant_configuration.import_apply";
      beforeVersion: number;
      afterVersion: number;
      importedChecksum: string;
      appliedAt: string;
    };
    actionExecution: TenantLabelActionExecutionDto;
  };
  readback: ConfigurationOverviewDto;
};

export type ConfigurationAuditDto = {
  events: AuditEventDto[];
  actionExecutions: TenantLabelActionExecutionDto[];
};

export type ConfigurationOverviewApiClient = {
  getConfiguration(testUser: string): Promise<ConfigurationOverviewDto>;
  validateConfiguration(testUser: string, request?: { package?: ConfigurationExportPackageDto }): Promise<{
    canPublish: boolean;
    issues: ConfigurationValidationIssueDto[];
  }>;
  exportConfiguration(testUser: string): Promise<ConfigurationExportPackageDto>;
  previewImport(testUser: string, request: { package: ConfigurationExportPackageDto }): Promise<ConfigurationImportPreviewDto>;
  applyImport(testUser: string, request: { previewId: string }): Promise<ConfigurationImportApplyResultDto>;
  getAudit(testUser: string): Promise<ConfigurationAuditDto>;
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

export function createConfigurationOverviewApiClient(basePath = "/api/api"): ConfigurationOverviewApiClient {
  return {
    getConfiguration(testUser) {
      return requestJson<ConfigurationOverviewDto>(withUser(`${basePath}/tenant/configuration`, testUser));
    },
    async validateConfiguration(testUser, request) {
      const body = await requestJson<{ validation: { canPublish: boolean; issues: ConfigurationValidationIssueDto[] } }>(
        withUser(`${basePath}/tenant/configuration/validate`, testUser),
        {
          method: "POST",
          body: JSON.stringify(request ?? {})
        }
      );
      return body.validation;
    },
    async exportConfiguration(testUser) {
      const body = await requestJson<{ package: ConfigurationExportPackageDto }>(
        withUser(`${basePath}/tenant/configuration/export`, testUser)
      );
      return body.package;
    },
    async previewImport(testUser, request) {
      const body = await requestJson<{ preview: ConfigurationImportPreviewDto }>(
        withUser(`${basePath}/tenant/configuration/import/preview`, testUser),
        {
          method: "POST",
          body: JSON.stringify(request)
        }
      );
      return body.preview;
    },
    applyImport(testUser, request) {
      return requestJson<ConfigurationImportApplyResultDto>(
        withUser(`${basePath}/tenant/configuration/import/apply`, testUser),
        {
          method: "POST",
          body: JSON.stringify(request)
        }
      );
    },
    getAudit(testUser) {
      return requestJson<ConfigurationAuditDto>(withUser(`${basePath}/tenant/configuration/audit`, testUser));
    }
  };
}
