export type CurrentTenantDto = {
  tenant: {
    id: string;
    label: string;
    configurationVersion: number;
  };
  actor: {
    id: string;
    displayName: string;
    accessProfileId?: string;
  };
  labels: Record<string, string>;
  permissions: string[];
};

export type AccessProfileDto = {
  id: string;
  tenantId: string;
  systemKey: string;
  label: string;
  permissions: string[];
  scopeRules: Array<{
    permissionKey: string;
    scope: string;
    constraints?: Record<string, string | number | boolean>;
  }>;
  active: boolean;
  version: number;
  updatedAt: string;
};

export type UpsertAccessProfileRequest = {
  id?: string;
  version?: number;
  systemKey: string;
  label: string;
  permissions: string[];
  scopeRules: Array<{
    permissionKey: string;
    scope: "own" | "project" | "tenant" | "all";
    constraints?: Record<string, string | number | boolean>;
  }>;
  active: boolean;
};

export type TenantLabelSetDto = {
  tenantId: string;
  configurationVersion: number;
  previousConfigurationVersion?: number;
  changedLabel?: {
    key: string;
    beforeLabel: string;
    afterLabel: string;
  };
  labels: Record<string, string>;
};

export type UpdateTenantLabelRequest = {
  key: string;
  label: string;
  expectedConfigurationVersion: number;
};

export type PolicyDiagnosticsDto = {
  allowed: boolean;
  reasonCode: string;
  scope?: string;
  trace: string[];
};

export type TenantIsolationProbeDto = {
  id: string;
  tenantId: string;
  label: string;
};

export type AuditEventDto = {
  id: string;
  tenantId: string;
  actorId: string;
  actionKey: string;
  target: {
    entityType: string;
    entityId: string;
  };
  result: string;
  timestamp: string;
  correlationId: string;
  details?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    previousConfigurationVersion?: number;
    newConfigurationVersion?: number;
    changedLabel?: {
      key: string;
      beforeLabel: string;
      afterLabel: string;
    };
  };
};

export type Phase2ApiClient = {
  getCurrentTenant(testUser: string): Promise<CurrentTenantDto>;
  listAccessProfiles(testUser: string): Promise<AccessProfileDto[]>;
  upsertAccessProfile(testUser: string, request: UpsertAccessProfileRequest): Promise<AccessProfileDto>;
  updateTenantLabel(testUser: string, request: UpdateTenantLabelRequest): Promise<TenantLabelSetDto>;
  evaluatePermission(
    testUser: string,
    request: {
      permissionKey: string;
      targetEntityType: string;
      targetEntityId?: string;
      targetTenantId?: string;
      requestedScope?: string;
    }
  ): Promise<PolicyDiagnosticsDto>;
  getIsolationProbe(testUser: string, probeId: string): Promise<TenantIsolationProbeDto>;
  listAuditEvents(testUser: string): Promise<AuditEventDto[]>;
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

export function createPhase2ApiClient(basePath = "/api"): Phase2ApiClient {
  return {
    getCurrentTenant(testUser) {
      return requestJson<CurrentTenantDto>(withUser(`${basePath}/tenants/current`, testUser));
    },
    async listAccessProfiles(testUser) {
      const body = await requestJson<{ profiles: AccessProfileDto[] }>(
        withUser(`${basePath}/admin/access-profiles`, testUser)
      );
      return body.profiles;
    },
    upsertAccessProfile(testUser, request) {
      return requestJson<AccessProfileDto>(withUser(`${basePath}/admin/access-profiles`, testUser), {
        method: "POST",
        body: JSON.stringify(request)
      });
    },
    updateTenantLabel(testUser, request) {
      return requestJson<TenantLabelSetDto>(withUser(`${basePath}/admin/labels`, testUser), {
        method: "POST",
        body: JSON.stringify(request)
      });
    },
    evaluatePermission(testUser, request) {
      return requestJson<PolicyDiagnosticsDto>(withUser(`${basePath}/admin/permissions/evaluate`, testUser), {
        method: "POST",
        body: JSON.stringify(request)
      });
    },
    getIsolationProbe(testUser, probeId) {
      return requestJson<TenantIsolationProbeDto>(
        withUser(`${basePath}/tenant-isolation-probes/${encodeURIComponent(probeId)}`, testUser)
      );
    },
    async listAuditEvents(testUser) {
      const body = await requestJson<{ events: AuditEventDto[] }>(withUser(`${basePath}/audit/events`, testUser));
      return body.events;
    }
  };
}
