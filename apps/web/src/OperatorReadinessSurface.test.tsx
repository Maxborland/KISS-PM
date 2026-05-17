import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OperatorReadinessSurface } from "./OperatorReadinessSurface";
import type {
  OperatorAuditDto,
  OperatorReadinessApiClient,
  PermissionSmokeReadModelDto,
  RecoverySmokeReadModelDto,
  ReleaseReadinessReadModelDto,
  ReleaseReadinessRunDto,
  TenantIsolationSmokeReadModelDto
} from "./operatorReadinessApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "ops.read", "ops.execute", "ops.audit.read", "release.readiness.read", "release.readiness.execute"]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createReadiness(latestRun: ReleaseReadinessRunDto | null = null): ReleaseReadinessReadModelDto {
  return {
    tenantId: "tenant-a",
    generatedAt: "2026-05-17T09:45:00+07:00",
    summary: { status: "blocked", totalChecks: 5, passedChecks: 3, failedChecks: 0, blockedChecks: 2 },
    deployment: { status: "passed", checkedAt: "2026-05-17T09:45:00+07:00", checks: [] },
    observability: { mode: "local-readiness", errorBoundary: "pending-ui-surface", sensitiveDataPolicy: "redacted" },
    checks: [
      {
        id: "p12.deployment-smoke",
        category: "deployment",
        status: "passed",
        severity: "critical",
        expected: "env ok",
        actual: "passed",
        recoveryText: "нет действий"
      },
      {
        id: "p12.e2e-110-115",
        category: "e2e",
        status: "blocked",
        severity: "critical",
        expected: "E2E ready",
        actual: "not-implemented",
        recoveryText: "Запустить P12-009"
      }
    ],
    openBlockers: [{ id: "p12.e2e-110-115", severity: "critical", reason: "not-implemented", recoveryText: "Запустить P12-009" }],
    latestRun
  };
}

function createReadinessRun(): ReleaseReadinessRunDto {
  const readModel = createReadiness(null);
  return {
    id: "p12-readiness-tenant-a-0001",
    tenantId: "tenant-a",
    status: "blocked",
    checkedAt: "2026-05-17T09:46:00+07:00",
    auditEventId: "audit-p12-readiness-tenant-a-0001",
    summary: readModel.summary,
    checks: readModel.checks,
    openBlockers: readModel.openBlockers
  };
}

function createSmoke(status: "not_run" | "passed" = "not_run"): PermissionSmokeReadModelDto {
  return {
    tenantId: "tenant-a",
    status,
    latestRun:
      status === "passed"
        ? {
            id: "p12-permission-smoke-0001",
            tenantId: "tenant-a",
            status: "passed",
            checkedAt: "2026-05-17T09:47:00+07:00",
            auditEventId: "audit-p12-permission-smoke-0001",
            summary: { total: 13, passed: 13, failed: 0 },
            results: []
          }
        : null
  };
}

function createTenantIsolation(status: "not_run" | "passed" = "not_run"): TenantIsolationSmokeReadModelDto {
  return {
    ...createSmoke(status),
    latestRun:
      status === "passed"
        ? {
            id: "p12-tenant-isolation-smoke-0001",
            tenantId: "tenant-a",
            status: "passed",
            checkedAt: "2026-05-17T09:48:00+07:00",
            auditEventId: "audit-p12-tenant-isolation-smoke-0001",
            summary: { total: 6, passed: 6, failed: 0 },
            results: []
          }
        : null
  };
}

function createRecovery(status: "not_run" | "passed" = "not_run"): RecoverySmokeReadModelDto {
  return {
    tenantId: "tenant-a",
    status,
    policy: {
      mode: "deterministic_in_memory_smoke",
      productionBackupRequired: true,
      productionPolicyDoc: "docs/operations/PHASE_12_RECOVERY_BACKUP_POLICY.md"
    },
    latestRun:
      status === "passed"
        ? {
            id: "p12-recovery-tenant-a-0001",
            tenantId: "tenant-a",
            scenarioKey: "release-readiness-state",
            status: "passed",
            startedAt: "2026-05-17T09:49:00+07:00",
            finishedAt: "2026-05-17T09:49:00+07:00",
            before: { marker: "seed", usable: true, checksum: "phase12-recovery-seed-v1" },
            simulatedFailure: { marker: "corrupted", usable: false, checksum: "phase12-recovery-corrupted" },
            after: { marker: "seed", usable: true, checksum: "phase12-recovery-seed-v1" },
            auditEventId: "audit-p12-recovery-tenant-a-0001"
          }
        : null
  };
}

function createApiClient(options: { failReadinessRunOnce?: boolean; failLoad?: boolean } = {}): OperatorReadinessApiClient {
  let readinessRun: ReleaseReadinessRunDto | null = null;
  let permission = createSmoke();
  let tenantIsolation = createTenantIsolation();
  let recovery = createRecovery();
  let audit: OperatorAuditDto = { events: [] };
  let failReadinessRun = options.failReadinessRunOnce ?? false;

  return {
    getReleaseReadiness: vi.fn(async () => {
      if (options.failLoad) throw new Error("Ops API недоступен");
      return createReadiness(readinessRun);
    }),
    runReleaseReadiness: vi.fn(async () => {
      if (failReadinessRun) {
        failReadinessRun = false;
        throw new Error("readiness rejected");
      }
      readinessRun = createReadinessRun();
      audit = {
        events: [
          {
            id: readinessRun.auditEventId,
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            actionKey: "ops.release_readiness.run",
            target: { entityType: "releaseReadinessRun", entityId: readinessRun.id },
            result: "success",
            timestamp: readinessRun.checkedAt,
            correlationId: `corr-${readinessRun.id}`
          }
        ]
      };
      return { run: readinessRun };
    }),
    getReadinessRun: vi.fn(async (_testUser, runId) => {
      if (readinessRun === null || readinessRun.id !== runId) throw new Error("run not found");
      return { run: readinessRun };
    }),
    getPermissionSmoke: vi.fn(async () => permission),
    runPermissionSmoke: vi.fn(async () => {
      permission = createSmoke("passed");
      return { run: permission.latestRun! };
    }),
    getTenantIsolation: vi.fn(async () => tenantIsolation),
    runTenantIsolation: vi.fn(async () => {
      tenantIsolation = createTenantIsolation("passed");
      return { run: tenantIsolation.latestRun! };
    }),
    getRecoverySmoke: vi.fn(async () => recovery),
    runRecoverySmoke: vi.fn(async () => {
      recovery = createRecovery("passed");
      return { run: recovery.latestRun! };
    }),
    getOpsAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(<OperatorReadinessSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />)
  );
}

describe("OperatorReadinessSurface", () => {
  it("loads readiness, smoke states, recovery policy, and API error state", async () => {
    renderSurface();
    expect(screen.getByTestId("operator-readiness-status")).toHaveTextContent("Загрузка readiness");
    await waitFor(() => expect(screen.getByTestId("release-readiness-summary")).toHaveTextContent("blocked"));
    expect(screen.getByTestId("permission-smoke-panel")).toHaveTextContent("not_run");
    expect(screen.getByTestId("tenant-isolation-panel")).toHaveTextContent("not_run");
    expect(screen.getByTestId("recovery-smoke-panel")).toHaveTextContent("deterministic_in_memory_smoke");

    cleanup();
    renderSurface(createApiClient({ failLoad: true }));
    expect(await screen.findByTestId("operator-readiness-error")).toHaveTextContent("Ops API недоступен");
  });

  it("runs readiness and recovery commands through API readback with audit evidence", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("release-readiness-summary");

    fireEvent.click(screen.getByRole("button", { name: "Запустить readiness" }));
    expect(await screen.findByTestId("release-readiness-result")).toHaveTextContent("p12-readiness-tenant-a-0001");
    await waitFor(() => expect(apiClient.getReleaseReadiness).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("release-readiness-summary")).toHaveTextContent("p12-readiness-tenant-a-0001");
    expect(screen.getByTestId("ops-audit-panel")).toHaveTextContent("ops.release_readiness.run");

    const recoveryReadbacksBefore = vi.mocked(apiClient.getRecoverySmoke).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Запустить recovery smoke" }));
    expect(await screen.findByTestId("recovery-smoke-panel")).toHaveTextContent("p12-recovery-tenant-a-0001");
    await waitFor(() => expect(vi.mocked(apiClient.getRecoverySmoke).mock.calls.length).toBeGreaterThan(recoveryReadbacksBefore));
  });

  it("runs permission and tenant-isolation smoke through refetched read models", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("release-readiness-summary");

    fireEvent.click(screen.getByRole("button", { name: "Запустить permission smoke" }));
    expect(await screen.findByTestId("permission-smoke-panel")).toHaveTextContent("p12-permission-smoke-0001");
    await waitFor(() => expect(apiClient.getPermissionSmoke).toHaveBeenCalledTimes(2));

    const tenantIsolationReadbacksBefore = vi.mocked(apiClient.getTenantIsolation).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Запустить tenant isolation" }));
    expect(await screen.findByTestId("tenant-isolation-panel")).toHaveTextContent("p12-tenant-isolation-smoke-0001");
    await waitFor(() =>
      expect(vi.mocked(apiClient.getTenantIsolation).mock.calls.length).toBeGreaterThan(tenantIsolationReadbacksBefore),
    );
  });

  it("shows read-only denial and never calls governed run commands", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient, createCurrentTenant(["tenant.read", "release.readiness.read", "ops.read", "ops.audit.read"]));
    expect(await screen.findByTestId("operator-command-denied")).toHaveTextContent("ops.execute");
    expect(screen.queryByRole("button", { name: "Запустить readiness" })).not.toBeInTheDocument();
    expect(apiClient.runReleaseReadiness).not.toHaveBeenCalled();
    expect(apiClient.runRecoverySmoke).not.toHaveBeenCalled();
  });

  it("recovers from a failed readiness run by retrying and refetching", async () => {
    const apiClient = createApiClient({ failReadinessRunOnce: true });
    renderSurface(apiClient);
    await screen.findByTestId("release-readiness-summary");

    fireEvent.click(screen.getByRole("button", { name: "Запустить readiness" }));
    expect(await screen.findByTestId("operator-command-error")).toHaveTextContent("readiness rejected");
    fireEvent.click(screen.getByRole("button", { name: "Запустить readiness" }));
    expect(await screen.findByTestId("release-readiness-result")).toHaveTextContent("p12-readiness-tenant-a-0001");
  });

  it("keeps the latest readiness run visible after remount through API readback", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("release-readiness-summary");

    fireEvent.click(screen.getByRole("button", { name: "Запустить readiness" }));
    expect(await screen.findByTestId("release-readiness-result")).toHaveTextContent("p12-readiness-tenant-a-0001");

    cleanup();
    renderSurface(apiClient);
    await waitFor(() =>
      expect(screen.getByTestId("release-readiness-summary")).toHaveTextContent("p12-readiness-tenant-a-0001")
    );
    expect(apiClient.getReleaseReadiness).toHaveBeenCalledTimes(3);
  });
});
