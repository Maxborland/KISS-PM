import type { AuditEventDto } from "./phase2ApiClient";

export type ReleaseReadinessStatusDto = "passed" | "failed" | "blocked";

export type ReleaseReadinessCheckDto = {
  id: string;
  category: "deployment" | "observability" | "dependency" | "e2e" | "matrix";
  status: ReleaseReadinessStatusDto;
  severity: "info" | "important" | "critical";
  expected: string;
  actual: string;
  recoveryText: string;
};

export type ReleaseReadinessBlockerDto = {
  id: string;
  severity: "important" | "critical";
  reason: string;
  recoveryText: string;
};

export type ReleaseReadinessRunDto = {
  id: string;
  tenantId: string;
  status: ReleaseReadinessStatusDto;
  checkedAt: string;
  auditEventId: string;
  summary: {
    status: ReleaseReadinessStatusDto;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    blockedChecks: number;
  };
  checks: ReleaseReadinessCheckDto[];
  openBlockers: ReleaseReadinessBlockerDto[];
};

export type ReleaseReadinessReadModelDto = {
  tenantId: string;
  generatedAt: string;
  summary: ReleaseReadinessRunDto["summary"];
  deployment: {
    status: string;
    checkedAt?: string;
    checks: unknown[];
  };
  observability: {
    mode: "local-readiness";
    errorBoundary: "pending-ui-surface";
    sensitiveDataPolicy: "redacted";
  };
  checks: ReleaseReadinessCheckDto[];
  openBlockers: ReleaseReadinessBlockerDto[];
  latestRun: ReleaseReadinessRunDto | null;
};

export type SmokeScenarioResultDto = {
  id: string;
  category: "permission" | "tenant_isolation";
  actorId: string;
  method: string;
  path: string;
  expectedStatus: number;
  actualStatus: number;
  status: "passed" | "failed";
  expected: string;
  actual: string;
  leakedForbiddenTerms: string[];
};

export type SmokeRunDto = {
  id: string;
  tenantId: string;
  status: "passed" | "failed";
  checkedAt: string;
  auditEventId: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  results: SmokeScenarioResultDto[];
};

export type PermissionSmokeReadModelDto = {
  tenantId: string;
  status: "not_run" | "passed" | "failed";
  latestRun: SmokeRunDto | null;
};

export type TenantIsolationSmokeReadModelDto = PermissionSmokeReadModelDto;

export type RecoverySmokeRunDto = {
  id: string;
  tenantId: string;
  scenarioKey: "release-readiness-state";
  status: "passed";
  startedAt: string;
  finishedAt: string;
  before: { marker: "seed" | "corrupted"; usable: boolean; checksum: string };
  simulatedFailure: { marker: "seed" | "corrupted"; usable: boolean; checksum: string };
  after: { marker: "seed" | "corrupted"; usable: boolean; checksum: string };
  auditEventId: string;
};

export type RecoverySmokeReadModelDto = {
  tenantId: string;
  status: "not_run" | "passed";
  policy: {
    mode: "deterministic_in_memory_smoke";
    productionBackupRequired: true;
    productionPolicyDoc: string;
  };
  latestRun: RecoverySmokeRunDto | null;
};

export type OperatorAuditDto = {
  events: AuditEventDto[];
};

export type OperatorReadinessApiClient = {
  getReleaseReadiness(testUser: string): Promise<ReleaseReadinessReadModelDto>;
  runReleaseReadiness(testUser: string): Promise<{ run: ReleaseReadinessRunDto }>;
  getReadinessRun(testUser: string, runId: string): Promise<{ run: ReleaseReadinessRunDto }>;
  getPermissionSmoke(testUser: string): Promise<PermissionSmokeReadModelDto>;
  runPermissionSmoke(testUser: string): Promise<{ run: SmokeRunDto }>;
  getTenantIsolation(testUser: string): Promise<TenantIsolationSmokeReadModelDto>;
  runTenantIsolation(testUser: string): Promise<{ run: SmokeRunDto }>;
  getRecoverySmoke(testUser: string): Promise<RecoverySmokeReadModelDto>;
  runRecoverySmoke(testUser: string): Promise<{ run: RecoverySmokeRunDto }>;
  getOpsAudit(testUser: string): Promise<OperatorAuditDto>;
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

export function createOperatorReadinessApiClient(basePath = "/api/api"): OperatorReadinessApiClient {
  return {
    getReleaseReadiness(testUser) {
      return requestJson<ReleaseReadinessReadModelDto>(withUser(`${basePath}/ops/release-readiness`, testUser));
    },
    runReleaseReadiness(testUser) {
      return requestJson<{ run: ReleaseReadinessRunDto }>(withUser(`${basePath}/ops/release-readiness/run`, testUser), {
        method: "POST"
      });
    },
    getReadinessRun(testUser, runId) {
      return requestJson<{ run: ReleaseReadinessRunDto }>(
        withUser(`${basePath}/ops/release-readiness/runs/${encodeURIComponent(runId)}`, testUser)
      );
    },
    getPermissionSmoke(testUser) {
      return requestJson<PermissionSmokeReadModelDto>(withUser(`${basePath}/ops/permission-smoke`, testUser));
    },
    runPermissionSmoke(testUser) {
      return requestJson<{ run: SmokeRunDto }>(withUser(`${basePath}/ops/permission-smoke/run`, testUser), {
        method: "POST"
      });
    },
    getTenantIsolation(testUser) {
      return requestJson<TenantIsolationSmokeReadModelDto>(withUser(`${basePath}/ops/tenant-isolation`, testUser));
    },
    runTenantIsolation(testUser) {
      return requestJson<{ run: SmokeRunDto }>(withUser(`${basePath}/ops/tenant-isolation/run`, testUser), {
        method: "POST"
      });
    },
    getRecoverySmoke(testUser) {
      return requestJson<RecoverySmokeReadModelDto>(withUser(`${basePath}/ops/recovery-smoke`, testUser));
    },
    runRecoverySmoke(testUser) {
      return requestJson<{ run: RecoverySmokeRunDto }>(withUser(`${basePath}/ops/recovery-smoke/run`, testUser), {
        method: "POST",
        body: JSON.stringify({ scenarioKey: "release-readiness-state" })
      });
    },
    getOpsAudit(testUser) {
      return requestJson<OperatorAuditDto>(withUser(`${basePath}/ops/audit`, testUser));
    }
  };
}
