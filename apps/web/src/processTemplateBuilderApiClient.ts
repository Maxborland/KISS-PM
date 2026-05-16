import type { AuditEventDto } from "./phase2ApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

export type ProcessTemplateDto = {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  active: boolean;
  version: number;
  updatedAt: string;
  stages: ProcessTemplateStageDto[];
};

export type ProcessTemplateStageDto = {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  sortOrder: number;
  active: boolean;
  version: number;
  updatedAt: string;
  requiredArtifactTemplates: Array<{ id: string; tenantId: string; key: string; label: string; required: boolean }>;
  approvalTemplates: Array<{
    id: string;
    tenantId: string;
    key: string;
    label: string;
    approverRoleKey: string;
    required: boolean;
  }>;
  taskTemplates: ProcessTemplateTaskTemplateDto[];
};

export type ProcessTemplateTaskTemplateDto = {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  defaultParticipantRoleKeys: string[];
  required: boolean;
};

export type ProcessTemplateReadModelDto = {
  templates: ProcessTemplateDto[];
};

export type ProcessTemplateDraftDto = {
  label?: string;
  active?: boolean;
  stages?: Array<{
    id: string;
    label?: string;
    sortOrder?: number;
    active?: boolean;
    taskTemplates?: Array<{
      id: string;
      label?: string;
      defaultParticipantRoleKeys?: string[];
      required?: boolean;
    }>;
  }>;
};

export type ProcessTemplatePreviewRequestDto = {
  templateId: string;
  expectedTemplateVersion: number;
  draft: ProcessTemplateDraftDto;
  affectedRuntimeSurfaces: string[];
};

export type ProcessTemplatePreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  mutatesState: false;
  draft: ProcessTemplateDraftDto;
  before: {
    templateId: string;
    templateVersion: number;
    label: string;
    activeProjectTemplateVersions: number[];
  };
  after: {
    templateId: string;
    templateVersion: number;
    label: string;
    activeStageKeys: string[];
    template: ProcessTemplateDto;
  };
  stageChanges: Array<{
    stageId: string;
    stageKey?: string;
    beforeLabel?: string;
    afterLabel?: string;
    beforeSortOrder?: number;
    afterSortOrder?: number;
    beforeActive?: boolean;
    afterActive?: boolean;
  }>;
  taskTemplateChanges: Array<{
    stageId: string;
    taskTemplateId: string;
    taskTemplateKey: string;
    beforeLabel: string;
    afterLabel: string;
    beforeDefaultParticipantRoleKeys: string[];
    afterDefaultParticipantRoleKeys: string[];
    beforeRequired: boolean;
    afterRequired: boolean;
  }>;
  affectedRuntimeSurfaces: string[];
  createdAt: string;
};

export type ProcessTemplatePublishResultDto = {
  result: {
    template: ProcessTemplateDto;
    audit: {
      tenantId: string;
      actorId: string;
      auditEventId: string;
      commandType: "process_template.publish";
      templateId: string;
      beforeTemplateVersion: number;
      afterTemplateVersion: number;
      publishedAt: string;
    };
    actionExecution: TenantLabelActionExecutionDto;
  };
  readback: {
    activeTemplate: ProcessTemplateDto;
  };
};

export type ProcessTemplateAuditDto = {
  events: AuditEventDto[];
  actionExecutions: TenantLabelActionExecutionDto[];
};

export type ProcessTemplateBuilderApiClient = {
  getProcessTemplates(testUser: string): Promise<ProcessTemplateReadModelDto>;
  previewProcessTemplate(testUser: string, request: ProcessTemplatePreviewRequestDto): Promise<ProcessTemplatePreviewDto>;
  publishProcessTemplate(testUser: string, request: { templateId: string; previewId: string }): Promise<ProcessTemplatePublishResultDto>;
  getAudit(testUser: string): Promise<ProcessTemplateAuditDto>;
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

export function createProcessTemplateBuilderApiClient(basePath = "/api/api"): ProcessTemplateBuilderApiClient {
  return {
    getProcessTemplates(testUser) {
      return requestJson<ProcessTemplateReadModelDto>(withUser(`${basePath}/tenant/process-templates`, testUser));
    },
    async previewProcessTemplate(testUser, request) {
      const body = await requestJson<{ preview: ProcessTemplatePreviewDto }>(
        withUser(`${basePath}/tenant/process-templates/preview`, testUser),
        {
          method: "POST",
          body: JSON.stringify(request)
        }
      );
      return body.preview;
    },
    publishProcessTemplate(testUser, request) {
      return requestJson<ProcessTemplatePublishResultDto>(
        withUser(`${basePath}/tenant/process-templates/publish`, testUser),
        {
          method: "POST",
          body: JSON.stringify(request)
        }
      );
    },
    getAudit(testUser) {
      return requestJson<ProcessTemplateAuditDto>(withUser(`${basePath}/tenant/configuration/audit`, testUser));
    }
  };
}
