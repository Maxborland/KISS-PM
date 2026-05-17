import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { OperatorReadinessApiClient } from "./operatorReadinessApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";

type OperatorReadinessSurfaceProps = {
  apiClient: OperatorReadinessApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type PendingCommand = "readiness" | "permission" | "tenantIsolation" | "recovery" | "refresh" | null;

const queryKeys = {
  readiness: (testUser: string) => ["p12", "readiness", testUser] as const,
  permission: (testUser: string) => ["p12", "permission-smoke", testUser] as const,
  tenantIsolation: (testUser: string) => ["p12", "tenant-isolation", testUser] as const,
  recovery: (testUser: string) => ["p12", "recovery-smoke", testUser] as const,
  audit: (testUser: string) => ["p12", "ops-audit", testUser] as const
};

function hasPermission(currentTenant: CurrentTenantDto, permission: string): boolean {
  return currentTenant.permissions.includes(permission);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : "Неизвестная ошибка";
}

export function OperatorReadinessSurface({ apiClient, currentTenant, testUser }: OperatorReadinessSurfaceProps) {
  const canReadReadiness = hasPermission(currentTenant, "release.readiness.read");
  const canRunReadiness = hasPermission(currentTenant, "release.readiness.execute");
  const canReadOps = hasPermission(currentTenant, "ops.read");
  const canRunOps = hasPermission(currentTenant, "ops.execute");
  const canReadAudit = hasPermission(currentTenant, "ops.audit.read");
  const canRead = canReadReadiness && canReadOps;
  const canRunAny = canRunReadiness && canRunOps;
  const [status, setStatus] = useState("Загрузка readiness");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const [lastResult, setLastResult] = useState("");
  const commandInFlight = pendingCommand !== null;

  const readinessQuery = useQuery({
    queryKey: queryKeys.readiness(testUser),
    queryFn: () => apiClient.getReleaseReadiness(testUser),
    enabled: canReadReadiness,
    retry: false
  });
  const permissionQuery = useQuery({
    queryKey: queryKeys.permission(testUser),
    queryFn: () => apiClient.getPermissionSmoke(testUser),
    enabled: canReadOps,
    retry: false
  });
  const tenantIsolationQuery = useQuery({
    queryKey: queryKeys.tenantIsolation(testUser),
    queryFn: () => apiClient.getTenantIsolation(testUser),
    enabled: canReadOps,
    retry: false
  });
  const recoveryQuery = useQuery({
    queryKey: queryKeys.recovery(testUser),
    queryFn: () => apiClient.getRecoverySmoke(testUser),
    enabled: canReadOps,
    retry: false
  });
  const auditQuery = useQuery({
    queryKey: queryKeys.audit(testUser),
    queryFn: () => apiClient.getOpsAudit(testUser),
    enabled: canReadAudit,
    retry: false
  });

  const readinessMutation = useMutation({ mutationFn: () => apiClient.runReleaseReadiness(testUser) });
  const permissionMutation = useMutation({ mutationFn: () => apiClient.runPermissionSmoke(testUser) });
  const tenantIsolationMutation = useMutation({ mutationFn: () => apiClient.runTenantIsolation(testUser) });
  const recoveryMutation = useMutation({ mutationFn: () => apiClient.runRecoverySmoke(testUser) });
  const hasLoadError =
    readinessQuery.isError || permissionQuery.isError || tenantIsolationQuery.isError || recoveryQuery.isError || auditQuery.isError;
  const firstError = [
    readinessQuery.error,
    permissionQuery.error,
    tenantIsolationQuery.error,
    recoveryQuery.error,
    auditQuery.error
  ].find((error) => error !== null);
  const isLoading = [readinessQuery, permissionQuery, tenantIsolationQuery, recoveryQuery].some(
    (query) => query.isFetching && query.data === undefined
  );
  const readiness = readinessQuery.data;
  const permissionSmoke = permissionQuery.data;
  const tenantIsolation = tenantIsolationQuery.data;
  const recovery = recoveryQuery.data;
  const audit = auditQuery.data?.events ?? [];
  const displayStatus = isLoading ? "Загрузка readiness" : status === "Загрузка readiness" ? "Ops readiness загружен из API" : status;

  async function refreshReadModels(nextStatus = "Ops readback обновлен") {
    await Promise.all([
      canReadReadiness ? readinessQuery.refetch({ throwOnError: true }) : Promise.resolve(),
      canReadOps ? permissionQuery.refetch({ throwOnError: true }) : Promise.resolve(),
      canReadOps ? tenantIsolationQuery.refetch({ throwOnError: true }) : Promise.resolve(),
      canReadOps ? recoveryQuery.refetch({ throwOnError: true }) : Promise.resolve(),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  async function runReadiness() {
    if (commandInFlight || !canRunReadiness) return;
    setPendingCommand("readiness");
    setCommandError("");
    try {
      const result = await readinessMutation.mutateAsync();
      setLastResult(`Readiness run: ${result.run.id}`);
      await refreshReadModels("Readiness запущен и перечитан из API");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Readiness command отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function runPermissionSmoke() {
    if (commandInFlight || !canRunOps) return;
    setPendingCommand("permission");
    setCommandError("");
    try {
      const result = await permissionMutation.mutateAsync();
      setLastResult(`Permission smoke: ${result.run.id}`);
      await refreshReadModels("Permission smoke перечитан из API");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Permission smoke отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function runTenantIsolation() {
    if (commandInFlight || !canRunOps) return;
    setPendingCommand("tenantIsolation");
    setCommandError("");
    try {
      const result = await tenantIsolationMutation.mutateAsync();
      setLastResult(`Tenant isolation: ${result.run.id}`);
      await refreshReadModels("Tenant isolation перечитан из API");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Tenant isolation отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function runRecovery() {
    if (commandInFlight || !canRunOps) return;
    setPendingCommand("recovery");
    setCommandError("");
    try {
      const result = await recoveryMutation.mutateAsync();
      setLastResult(`Recovery smoke: ${result.run.id}`);
      await refreshReadModels("Recovery smoke перечитан из API");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Recovery smoke отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  if (!canRead) {
    return (
      <section className="operator-readiness-surface" data-testid="operator-readiness-denied" id="operator-readiness">
        <div className="readonly-notice">Нет разрешений release.readiness.read и ops.read для operator readiness.</div>
      </section>
    );
  }

  return (
    <section className="operator-readiness-surface" data-testid="operator-readiness-surface" id="operator-readiness">
      <div className="surface-heading">
        <div>
          <h2>Операторская готовность релиза</h2>
          <p>Readiness, permission, isolation, recovery и audit evidence для P12 release gate.</p>
        </div>
        <p className="status-pill" data-testid="operator-readiness-status">
          {displayStatus}
        </p>
      </div>

      {hasLoadError ? (
        <section className="phase2-panel warning-list" data-testid="operator-readiness-error">
          <h3>Ops readback недоступен</h3>
          <p>{getErrorMessage(firstError)}</p>
        </section>
      ) : null}

      {isLoading ? (
        <p className="phase2-panel" data-testid="operator-readiness-loading">
          Загрузка readiness
        </p>
      ) : null}

      {!canRunAny ? (
        <p className="readonly-notice" data-testid="operator-command-denied">
          Управляемые команды недоступны: нужны release.readiness.execute и ops.execute.
        </p>
      ) : null}

      {commandError ? (
        <section className="phase2-panel warning-list" data-testid="operator-command-error">
          <h3>Команда отклонена</h3>
          <p>{commandError}</p>
        </section>
      ) : null}

      {lastResult ? (
        <section className="phase2-panel" data-testid="release-readiness-result">
          <h3>Последняя команда</h3>
          <p>{lastResult}</p>
        </section>
      ) : null}

      <div className="operator-readiness-layout">
        <section className="phase2-panel" data-testid="release-readiness-summary" id="ops-release-readiness">
          <h3>/ops/release-readiness</h3>
          <p>
            Status: {readiness?.summary.status ?? "empty"} / checks {readiness?.summary.passedChecks ?? 0}/
            {readiness?.summary.totalChecks ?? 0}
          </p>
          <p>Latest run: {readiness?.latestRun?.id ?? "not_run"}</p>
          <div className="compact-list">
            {(readiness?.openBlockers ?? []).map((blocker) => (
              <span key={blocker.id}>
                {blocker.id}: {blocker.recoveryText}
              </span>
            ))}
          </div>
          {canRunReadiness ? (
            <button disabled={commandInFlight} type="button" onClick={() => void runReadiness()}>
              Запустить readiness
            </button>
          ) : null}
        </section>

        <section className="phase2-panel" data-testid="permission-smoke-panel" id="ops-permission-smoke">
          <h3>/ops/permission-smoke</h3>
          <p>
            Status: {permissionSmoke?.status ?? "empty"} / latest {permissionSmoke?.latestRun?.id ?? "not_run"}
          </p>
          <p>Failed: {permissionSmoke?.latestRun?.summary.failed ?? 0}</p>
          {canRunOps ? (
            <button disabled={commandInFlight} type="button" onClick={() => void runPermissionSmoke()}>
              Запустить permission smoke
            </button>
          ) : null}
        </section>

        <section className="phase2-panel" data-testid="tenant-isolation-panel" id="ops-tenant-isolation">
          <h3>/ops/tenant-isolation</h3>
          <p>
            Status: {tenantIsolation?.status ?? "empty"} / latest {tenantIsolation?.latestRun?.id ?? "not_run"}
          </p>
          <p>No-leak failures: {tenantIsolation?.latestRun?.summary.failed ?? 0}</p>
          {canRunOps ? (
            <button disabled={commandInFlight} type="button" onClick={() => void runTenantIsolation()}>
              Запустить tenant isolation
            </button>
          ) : null}
        </section>

        <section className="phase2-panel" data-testid="recovery-smoke-panel" id="ops-recovery-smoke">
          <h3>/ops/recovery-smoke</h3>
          <p>
            Policy: {recovery?.policy.mode ?? "empty"} / status {recovery?.status ?? "empty"}
          </p>
          <p>Latest run: {recovery?.latestRun?.id ?? "not_run"}</p>
          <p>After usable: {String(recovery?.latestRun?.after.usable ?? false)}</p>
          {canRunOps ? (
            <button disabled={commandInFlight} type="button" onClick={() => void runRecovery()}>
              Запустить recovery smoke
            </button>
          ) : null}
        </section>

        <section className="phase2-panel" data-testid="ops-audit-panel">
          <h3>Ops audit evidence</h3>
          <div className="compact-list">
            {audit.length > 0
              ? audit.map((event) => (
                  <span key={event.id}>
                    {event.actionKey}: {event.target.entityId}
                  </span>
                ))
              : "Нет ops audit events"}
          </div>
        </section>
      </div>
    </section>
  );
}
