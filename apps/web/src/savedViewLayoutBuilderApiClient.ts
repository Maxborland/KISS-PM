import type { AuditEventDto } from "./phase2ApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

export type SavedViewDto = {
  id: string;
  key: string;
  label: string;
  ownerType: "tenant" | "user";
  filterKeys: string[];
  sortKeys: string[];
  groupKeys?: string[];
  scope?: "tenant" | "role" | "user";
};

export type SavedViewLayoutSurfaceDto = {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  version: number;
  status: string;
  surfaceType: string;
  updatedAt: string;
  view: {
    id: string;
    key: string;
    label: string;
    viewType: string;
    version: number;
    fields: Array<{ key: string; label: string; visible: boolean; sortable: boolean; filterable: boolean }>;
    widgets: Array<{ key: string; label: string; widgetType: string }>;
    actionSlots: Array<{ key: string; label: string }>;
    savedViews: SavedViewDto[];
  };
};

export type SavedViewLayoutReadModelDto = {
  activeSurface: SavedViewLayoutSurfaceDto;
  previousVersions: Array<{ id: string; version: number; viewLabel: string; updatedAt?: string }>;
};

export type SavedViewLayoutPreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  surfaceDefinitionId: string;
  surfaceKey: string;
  mutatesState: false;
  before: {
    surfaceVersion: number;
    viewVersion: number;
    visibleFieldKeys: string[];
    widgetKeys: string[];
    actionSlotKeys: string[];
    savedViewKeys: string[];
  };
  after: {
    surfaceVersion: number;
    viewVersion: number;
    visibleFieldKeys: string[];
    widgetKeys: string[];
    actionSlotKeys: string[];
    savedViewKeys: string[];
  };
  unavailable: {
    fields: string[];
    widgets: string[];
    actionSlots: string[];
    reasons: string[];
  };
  affectedRuntimeSurfaces: string[];
  createdAt: string;
};

export type SavedViewLayoutDraftDto = {
  surfaceId: string;
  expectedSurfaceVersion: number;
  viewLabel: string;
  visibleFieldKeys: string[];
  filterKeys: string[];
  sortKeys: string[];
  groupKeys: string[];
  widgetKeys: string[];
  actionSlotKeys: string[];
  savedView: SavedViewDto;
  affectedRuntimeSurfaces: string[];
};

export type SavedViewLayoutPublishResultDto = {
  result: {
    surface: SavedViewLayoutSurfaceDto;
    audit: {
      tenantId: string;
      actorId: string;
      auditEventId: string;
      commandType: "control_surface_layout.publish";
      surfaceDefinitionId: string;
      beforeSurfaceVersion: number;
      afterSurfaceVersion: number;
      savedViewKey: string;
      publishedAt: string;
    };
    actionExecution: TenantLabelActionExecutionDto;
  };
  readback: SavedViewLayoutReadModelDto;
};

export type SavedViewAuditDto = {
  events: AuditEventDto[];
  actionExecutions: TenantLabelActionExecutionDto[];
};

export type SavedViewLayoutBuilderApiClient = {
  getSavedViews(testUser: string): Promise<SavedViewLayoutReadModelDto>;
  previewLayout(testUser: string, draft: SavedViewLayoutDraftDto): Promise<SavedViewLayoutPreviewDto>;
  publishLayout(testUser: string, body: { previewId: string }): Promise<SavedViewLayoutPublishResultDto>;
  getAudit(testUser: string): Promise<SavedViewAuditDto>;
};

type ApiErrorDto = {
  code: string;
  message: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
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

export function createSavedViewLayoutBuilderApiClient(baseUrl = "/api"): SavedViewLayoutBuilderApiClient {
  return {
    async getSavedViews(testUser) {
      return requestJson<SavedViewLayoutReadModelDto>(
        `${baseUrl}/api/tenant/saved-views?testUser=${encodeURIComponent(testUser)}`
      );
    },
    async previewLayout(testUser, draft) {
      const body = await requestJson<{ preview: SavedViewLayoutPreviewDto }>(
        `${baseUrl}/api/tenant/saved-views/preview?testUser=${encodeURIComponent(testUser)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft)
        }
      );
      return body.preview;
    },
    async publishLayout(testUser, body) {
      return requestJson<SavedViewLayoutPublishResultDto>(
        `${baseUrl}/api/tenant/saved-views/publish?testUser=${encodeURIComponent(testUser)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        }
      );
    },
    async getAudit(testUser) {
      return requestJson<SavedViewAuditDto>(
        `${baseUrl}/api/tenant/configuration/audit?testUser=${encodeURIComponent(testUser)}`
      );
    }
  };
}
