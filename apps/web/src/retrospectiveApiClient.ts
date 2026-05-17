export type RetrospectiveSeverityDto = "none" | "attention" | "warning" | "critical";
export type RetrospectiveTrendGroupByDto = "project_type" | "template" | "client" | "period";
export type RetrospectiveTrendKeyDto = "schedule_delay" | "overload" | "kpi_drift" | "work_variance";

export type RetrospectiveReadActionDto = {
  key: string;
  label: string;
  actionDefinitionKey: string;
  slotType: "primary" | "row" | "bulk" | "global";
  targetEntityType: string;
  dryRunRequired: boolean;
  available: boolean;
  unavailableReason?: "not_recommended" | "permission_denied";
};

export type RetrospectiveReadDrilldownDto = {
  key: string;
  label: string;
  targetSurfaceKey: string;
  targetEntityType: string;
  href?: string;
  available: boolean;
  unavailableReason?: "missing_param" | "permission_denied";
};

export type RetrospectiveReadRowDto = {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  severity: RetrospectiveSeverityDto;
  explanation: string;
  fieldValues: Record<string, string | number | boolean | null>;
  sourceRefs: Array<{ entityType: string; entityId: string }>;
  drilldowns: RetrospectiveReadDrilldownDto[];
  actions: RetrospectiveReadActionDto[];
};

export type ClosedPortfolioReadModelDto = {
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
  widgets: Array<{
    key: string;
    label: string;
    widgetType: string;
    value: number;
    severity?: Exclude<RetrospectiveSeverityDto, "none">;
  }>;
  rows: RetrospectiveReadRowDto[];
  pagination: { offset: number; limit: number; total: number };
  summary: { totalSnapshots: number; trendSignalCount: number; openInsightCount: number };
  filters: { templateId?: string; clientId?: string; period?: string };
};

export type RetrospectiveTrendDto = {
  id: string;
  tenantId: string;
  trendKey: RetrospectiveTrendKeyDto;
  groupBy: RetrospectiveTrendGroupByDto;
  groupKey: string;
  occurrenceCount: number;
  severity: RetrospectiveSeverityDto;
  averageVarianceValue: number;
  averageVariancePercent?: number;
  sourceSnapshotIds: string[];
  sourceMetricIds: string[];
};

export type RetrospectiveInsightDto = {
  id: string;
  tenantId: string;
  status: "open" | "handled";
  title: string;
  recommendation: string;
  severity: RetrospectiveSeverityDto;
  sourceTrendId: string;
  sourceSnapshotIds: string[];
  sourceMetricIds: string[];
  sourceLessonIds: string[];
  sourceLessons: Array<{
    id: string;
    snapshotId: string;
    categoryKey: string;
    summary: string;
    recommendation?: string;
    severity: "positive" | "attention" | "critical";
  }>;
  generatedAt: string;
  handledBy?: string;
  handledAt?: string;
};

export type RetrospectiveTrendsReadModelDto = {
  trends: RetrospectiveTrendDto[];
  insights: RetrospectiveInsightDto[];
  pagination: { offset: number; limit: number; total: number };
};

export type RetrospectiveInsightReadModelDto = {
  insight: RetrospectiveInsightDto;
  allowedActions: RetrospectiveReadActionDto[];
};

export type TemplateImprovementPreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  sourceInsightId: string;
  sourceTrendId: string;
  sourceSnapshotIds: string[];
  sourceMetricIds: string[];
  improvementKey: "add_acceptance_checkpoint";
  reason: string;
  mutatesState: false;
  stateVersion: number;
  template: {
    id: string;
    key: string;
    label: string;
    currentVersion: number;
    nextVersion: number;
  };
  before: {
    templateVersion: number;
  };
  after: {
    templateVersion: number;
    addedChecklistItemKey: "add_acceptance_checkpoint";
    recommendedLabel: string;
  };
  createdAt: string;
};

export type TemplateImprovementApplyResultDto = {
  preview: TemplateImprovementPreviewDto;
  insight: RetrospectiveInsightDto;
  template: {
    id: string;
    tenantId: string;
    key: string;
    label: string;
    version: number;
    previousVersion: number;
    active: boolean;
    improvementSourceInsightId: string;
    improvementSourceSnapshotIds: string[];
    improvementKey: "add_acceptance_checkpoint";
    improvedAt: string;
  };
  actionExecution: {
    id: string;
    commandType: string;
    auditEventIds?: string[];
  };
};

export type RetrospectiveQueryFiltersDto = {
  templateId?: string;
  clientId?: string;
  period?: string;
  offset?: number;
  limit?: number;
};

export type RetrospectiveApiClient = {
  getClosedPortfolio(testUser: string, filters?: RetrospectiveQueryFiltersDto): Promise<ClosedPortfolioReadModelDto>;
  getTrends(testUser: string, filters?: RetrospectiveQueryFiltersDto): Promise<RetrospectiveTrendsReadModelDto>;
  getInsight(testUser: string, insightId: string): Promise<RetrospectiveInsightReadModelDto>;
  previewTemplateImprovement(
    testUser: string,
    insightId: string,
    input: { improvementKey: "add_acceptance_checkpoint"; reason: string }
  ): Promise<{ preview: TemplateImprovementPreviewDto }>;
  applyTemplateImprovement(
    testUser: string,
    insightId: string,
    input: { previewId?: string }
  ): Promise<{ result: TemplateImprovementApplyResultDto }>;
};

type ApiErrorDto = {
  code: string;
  message: string;
};

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = body as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message), errorBody);
  }

  return body as T;
}

async function sendJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const responseBody = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = responseBody as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message), errorBody);
  }

  return responseBody as T;
}

function withParams(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}`;
}

export function retrospectiveSeverityLabel(severity: RetrospectiveSeverityDto): string {
  const labels: Record<RetrospectiveSeverityDto, string> = {
    none: "Норма",
    attention: "Внимание",
    warning: "Риск",
    critical: "Критично"
  };

  return labels[severity];
}

export function retrospectiveTrendLabel(trendKey: RetrospectiveTrendKeyDto): string {
  const labels: Record<RetrospectiveTrendKeyDto, string> = {
    schedule_delay: "Повторяющаяся задержка",
    overload: "Ресурсная перегрузка",
    kpi_drift: "KPI-дрейф",
    work_variance: "Отклонение трудозатрат"
  };

  return labels[trendKey];
}

function serializeRetrospectiveFilters(
  filters: RetrospectiveQueryFiltersDto
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, value === undefined ? undefined : String(value)])
  );
}

export function createRetrospectiveApiClient(basePath = "/api/api"): RetrospectiveApiClient {
  return {
    getClosedPortfolio(testUser, filters = {}) {
      return requestJson<ClosedPortfolioReadModelDto>(
        withParams(`${basePath}/retrospectives/closed-portfolio`, { testUser, ...serializeRetrospectiveFilters(filters) })
      );
    },
    getTrends(testUser, filters = {}) {
      return requestJson<RetrospectiveTrendsReadModelDto>(
        withParams(`${basePath}/retrospectives/trends`, {
          testUser,
          groupBy: "template",
          ...serializeRetrospectiveFilters(filters)
        })
      );
    },
    getInsight(testUser, insightId) {
      return requestJson<RetrospectiveInsightReadModelDto>(
        withParams(`${basePath}/retrospectives/insights/${encodeURIComponent(insightId)}`, { testUser })
      );
    },
    previewTemplateImprovement(testUser, insightId, input) {
      return sendJson<{ preview: TemplateImprovementPreviewDto }>(
        withParams(`${basePath}/retrospectives/insights/${encodeURIComponent(insightId)}/template-improvement/preview`, {
          testUser
        }),
        input
      );
    },
    applyTemplateImprovement(testUser, insightId, input) {
      return sendJson<{ result: TemplateImprovementApplyResultDto }>(
        withParams(`${basePath}/retrospectives/insights/${encodeURIComponent(insightId)}/template-improvement/apply`, {
          testUser
        }),
        input
      );
    }
  };
}
