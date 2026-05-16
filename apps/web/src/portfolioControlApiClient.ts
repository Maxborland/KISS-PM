import type { AuditEventDto } from "./phase2ApiClient";

export type ControlSeverityDto = "none" | "attention" | "warning" | "critical";
export type ControlEntityTypeDto =
  | "opportunity"
  | "project"
  | "project_stage"
  | "task"
  | "resource"
  | "resource_overload"
  | "kpi_signal"
  | "control_signal"
  | "action_execution";

export type ControlSurfaceReadActionDto = {
  key: string;
  label: string;
  actionDefinitionKey: string;
  slotType: "primary" | "row" | "bulk" | "global";
  targetEntityType: ControlEntityTypeDto;
  dryRunRequired: boolean;
  available: boolean;
  unavailableReason?: "not_recommended" | "permission_denied";
};

export type ControlSurfaceReadDrilldownDto = {
  key: string;
  label: string;
  targetSurfaceKey: string;
  targetEntityType: ControlEntityTypeDto;
  href?: string;
  available: boolean;
  unavailableReason?: "missing_param" | "permission_denied";
};

export type ControlSurfaceReadRowDto = {
  id: string;
  entityType: ControlEntityTypeDto;
  entityId: string;
  label: string;
  severity: ControlSeverityDto;
  explanation: string;
  fieldValues: Record<string, string | number | boolean | null>;
  sourceRefs: Array<{ entityType: ControlEntityTypeDto; entityId: string }>;
  drilldowns: ControlSurfaceReadDrilldownDto[];
  actions: ControlSurfaceReadActionDto[];
};

export type ControlSurfaceReadModelDto = {
  surface: {
    id: string;
    tenantId: string;
    key: string;
    label: string;
    viewType: string;
    version: number;
    updatedAt: string;
  };
  fields: Array<{ key: string; label: string; valueType: string; visible: boolean }>;
  widgets: Array<{ key: string; label: string; widgetType: string; value: number; severity?: Exclude<ControlSeverityDto, "none"> }>;
  rows: ControlSurfaceReadRowDto[];
  pagination: { offset: number; limit: number; total: number };
};

export type PortfolioActionDefinitionDto = {
  id: string;
  key: string;
  label: string;
  description: string;
  targetEntityType: string;
  requiredPermission: string;
  dryRunRequired: boolean;
  inputSchema: {
    fields: Array<{ key: string; label: string; valueType: string; required: boolean; summary: boolean }>;
  };
  commandType: string;
};

export type PortfolioActionTargetDto = {
  surfaceId: string;
  surfaceKey: string;
  rowId: string;
  entityType: string;
  entityId: string;
};

export type PortfolioActionPreviewDto = {
  id: string;
  tenantId: string;
  actionDefinitionId: string;
  actionKey: string;
  commandType: string;
  target: PortfolioActionTargetDto;
  input: Record<string, unknown>;
  mutatesState: false;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  requiredPermission: string;
  stateVersion: number;
};

export type PortfolioActionExecutionDto = {
  id: string;
  tenantId: string;
  actorId: string;
  commandType: string;
  requiredPermission: string;
  status: "succeeded" | "failed" | "denied";
  source: { entityType: string; entityId: string };
  target?: { entityType: string; entityId: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  correlationId: string;
  trace: string[];
};

export type PortfolioControlAuditDto = {
  events: AuditEventDto[];
  actionExecutions: PortfolioActionExecutionDto[];
};

export type PortfolioControlApiClient = {
  getSurfaceView(testUser: string, surfaceId: string): Promise<ControlSurfaceReadModelDto>;
  listSurfaceActions(testUser: string, surfaceId: string): Promise<PortfolioActionDefinitionDto[]>;
  previewAction(
    testUser: string,
    actionDefinitionId: string,
    request: { target: PortfolioActionTargetDto; input: Record<string, unknown> }
  ): Promise<PortfolioActionPreviewDto>;
  executeAction(
    testUser: string,
    actionDefinitionId: string,
    request: { previewId: string }
  ): Promise<{ result: PortfolioActionExecutionDto }>;
  getControlAudit(testUser: string): Promise<PortfolioControlAuditDto>;
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

export function controlSeverityLabel(severity: ControlSeverityDto): string {
  const labels: Record<ControlSeverityDto, string> = {
    none: "Норма",
    attention: "Внимание",
    warning: "Риск",
    critical: "Критическая"
  };

  return labels[severity];
}

export function createPortfolioControlApiClient(basePath = "/api/api"): PortfolioControlApiClient {
  return {
    getSurfaceView(testUser, surfaceId) {
      return requestJson<ControlSurfaceReadModelDto>(
        withUser(`${basePath}/control/surfaces/${encodeURIComponent(surfaceId)}/view`, testUser)
      );
    },
    async listSurfaceActions(testUser, surfaceId) {
      const body = await requestJson<{ actions: PortfolioActionDefinitionDto[] }>(
        withUser(`${basePath}/control/surfaces/${encodeURIComponent(surfaceId)}/actions`, testUser)
      );
      return body.actions;
    },
    async previewAction(testUser, actionDefinitionId, request) {
      const body = await requestJson<{ preview: PortfolioActionPreviewDto }>(
        withUser(`${basePath}/control/actions/${encodeURIComponent(actionDefinitionId)}/preview`, testUser),
        jsonBody(request)
      );
      return body.preview;
    },
    executeAction(testUser, actionDefinitionId, request) {
      return requestJson<{ result: PortfolioActionExecutionDto }>(
        withUser(`${basePath}/control/actions/${encodeURIComponent(actionDefinitionId)}/execute`, testUser),
        jsonBody(request)
      );
    },
    getControlAudit(testUser) {
      return requestJson<PortfolioControlAuditDto>(withUser(`${basePath}/control/audit`, testUser));
    }
  };
}
