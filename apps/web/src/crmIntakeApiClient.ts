import type { AuditEventDto } from "./phase2ApiClient";

export type OpportunityDto = {
  id: string;
  tenantId: string;
  title: string;
  stageSystemKey: string;
  accountId?: string;
  contactIds: string[];
  plannedStartDate: string;
  desiredFinishDate: string;
  expectedValue: {
    amount: number;
    currency: string;
  };
  probability: number;
  categoryKey: string;
  typologyKey: string;
  scopeHints: Array<{
    key: string;
    label: string;
    value: string | number | boolean;
  }>;
  customFieldRefs: Array<{
    definitionId: string;
    key: string;
  }>;
  source: {
    type: "manual";
  };
  createdAt: string;
};

export type CreateOpportunityRequest = {
  title: string;
  account?: {
    displayName: string;
  };
  contacts?: Array<{
    displayName: string;
    email?: string;
    roleLabel?: string;
  }>;
  plannedStartDate: string;
  desiredFinishDate: string;
  expectedValue: {
    amount: number;
    currency: string;
  };
  probability: number;
  categoryKey: string;
  typologyKey: string;
  scopeHints?: Array<{
    key: string;
    label: string;
    value: string | number | boolean;
  }>;
  customFieldRefs?: Array<{
    definitionId: string;
    key: string;
  }>;
};

export type OpportunityReadinessDto = {
  ready: boolean;
  nextAction: string;
  blockers: Array<{
    code: string;
    severity: string;
    message: string;
    fieldRefs: string[];
  }>;
  trace: string[];
};

export type TemplateMatchDto = {
  matched: boolean;
  confidence: number;
  template?: {
    id: string;
    key: string;
    label: string;
    version: number;
  };
  blockers: Array<{
    code: string;
    message: string;
  }>;
  assumptions: Array<{
    code: string;
    message: string;
  }>;
};

export type FeasibilityDto = {
  tenantId: string;
  opportunityId: string;
  status: "fit" | "overloaded";
  severity: "none" | "warning" | "critical";
  expectedWindow: {
    startDate: string;
    endDate: string;
  };
  roleResults: Array<{
    roleKey: string;
    roleLabel: string;
    demandedHours: number;
    capacityHours: number;
    committedHours: number;
    conflictingReservedHours: number;
    availableHours: number;
    gapHours: number;
    severity: "none" | "warning" | "critical";
    conflictingReservationIds: string[];
  }>;
  blockers: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
  assumptions: Array<{
    code: string;
    message: string;
  }>;
  conflictingReservations: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    roleKey: string;
    roleLabel: string;
    periodStart: string;
    periodEnd: string;
    reservedHours: number;
    sourceLabel: string;
  }>;
  trace: string[];
};

export type DemandEstimateDto = {
  totalPlannedWorkHours: number;
  scenario: {
    key: string;
    label: string;
  };
  formula: {
    key: string;
    version: number;
    label: string;
  };
  confidence: number;
  stageRoleDemands: Array<{
    stageKey: string;
    stageLabel: string;
    roleKey: string;
    roleLabel: string;
    plannedWorkHours: number;
  }>;
};

export type ProjectDraftDto = {
  id: string;
  tenantId: string;
  title: string;
  status: string;
  sourceOpportunity: {
    type: "crm_opportunity";
    opportunityId: string;
    title: string;
    accountId?: string;
    contactIds: string[];
    plannedStartDate: string;
    desiredFinishDate: string;
  };
  processTemplate: {
    templateId: string;
    key: string;
    label: string;
    version: number;
    matchConfidence: number;
    assumptions: Array<{
      code: string;
      message: string;
    }>;
  };
  demand: {
    totalPlannedWorkHours: number;
    scenarioKey: string;
    scenarioLabel: string;
    formulaKey: string;
    formulaVersion: number;
    confidence: number;
    stageRoleDemands: Array<{
      stageKey: string;
      stageLabel: string;
      roleKey: string;
      roleLabel: string;
      plannedWorkHours: number;
    }>;
  };
  feasibility: {
    status: string;
    severity: string;
    expectedWindow: {
      startDate: string;
      endDate: string;
    };
    blockerCodes: string[];
  };
  createdBy: string;
  createdAt: string;
  correlationId: string;
};

export type ProjectDraftCommandDto = {
  correlationId: string;
  projectDraft: ProjectDraftDto;
  actionExecution: {
    id: string;
    actorId: string;
    commandType: string;
    requiredPermission: string;
    status: string;
    source: {
      entityType: string;
      entityId: string;
    };
    target?: {
      entityType: string;
      entityId: string;
    };
    trace: string[];
  };
};

export type FeasibilityBundleDto = {
  correlationId: string;
  templateMatch: TemplateMatchDto;
  demandEstimate: DemandEstimateDto;
  feasibility: FeasibilityDto;
};

export type CrmIntakeApiClient = {
  listOpportunities(testUser: string): Promise<OpportunityDto[]>;
  createOpportunity(testUser: string, request: CreateOpportunityRequest): Promise<OpportunityDto>;
  runReadiness(testUser: string, opportunityId: string): Promise<{ correlationId: string; readiness: OpportunityReadinessDto }>;
  runFeasibility(testUser: string, opportunityId: string): Promise<FeasibilityBundleDto>;
  createProjectDraft(testUser: string, opportunityId: string): Promise<ProjectDraftCommandDto>;
  getProjectDraft(testUser: string, projectDraftId: string): Promise<ProjectDraftDto>;
  listOpportunityAuditEvents(testUser: string, opportunityId: string): Promise<AuditEventDto[]>;
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

function emptyPostInit(): RequestInit {
  return {
    method: "POST",
    body: JSON.stringify({})
  };
}

export function projectDraftIdForOpportunity(opportunityId: string): string {
  return `project-draft-${opportunityId}`;
}

export function createCrmIntakeApiClient(basePath = "/api/api"): CrmIntakeApiClient {
  return {
    async listOpportunities(testUser) {
      const body = await requestJson<{ opportunities: OpportunityDto[] }>(
        withUser(`${basePath}/crm/opportunities`, testUser)
      );
      return body.opportunities;
    },
    async createOpportunity(testUser, request) {
      const body = await requestJson<{ opportunity: OpportunityDto }>(
        withUser(`${basePath}/crm/opportunities`, testUser),
        {
          method: "POST",
          body: JSON.stringify(request)
        }
      );
      return body.opportunity;
    },
    runReadiness(testUser, opportunityId) {
      return requestJson<{ correlationId: string; readiness: OpportunityReadinessDto }>(
        withUser(`${basePath}/crm/opportunities/${encodeURIComponent(opportunityId)}/readiness`, testUser),
        emptyPostInit()
      );
    },
    runFeasibility(testUser, opportunityId) {
      return requestJson<FeasibilityBundleDto>(
        withUser(`${basePath}/crm/opportunities/${encodeURIComponent(opportunityId)}/feasibility`, testUser),
        emptyPostInit()
      );
    },
    createProjectDraft(testUser, opportunityId) {
      return requestJson<ProjectDraftCommandDto>(
        withUser(`${basePath}/crm/opportunities/${encodeURIComponent(opportunityId)}/project-draft`, testUser),
        emptyPostInit()
      );
    },
    async getProjectDraft(testUser, projectDraftId) {
      const body = await requestJson<{ projectDraft: ProjectDraftDto }>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectDraftId)}`, testUser)
      );
      return body.projectDraft;
    },
    async listOpportunityAuditEvents(testUser, opportunityId) {
      const body = await requestJson<{ events: AuditEventDto[] }>(
        withUser(
          `${basePath}/audit?targetType=opportunity&targetId=${encodeURIComponent(opportunityId)}`,
          testUser
        )
      );
      return body.events;
    }
  };
}
