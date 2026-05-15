import { useCallback, useEffect, useMemo, useState } from "react";
import { getDemoTenantSummary, getDemoTenants } from "@kiss-pm/shared-test-fixtures";
import { createTenantLabelSet, resolveTenantLabel } from "@kiss-pm/tenant-config";
import type { TenantLabelSet } from "@kiss-pm/tenant-config";

import { createPhase2ApiClient } from "./phase2ApiClient";
import type {
  AccessProfileDto,
  AuditEventDto,
  CurrentTenantDto,
  Phase2ApiClient,
  PolicyDiagnosticsDto,
  TenantIsolationProbeDto
} from "./phase2ApiClient";
import { CrmIntakeControlSurface } from "./CrmIntakeControlSurface";
import { createCrmIntakeApiClient, type CrmIntakeApiClient } from "./crmIntakeApiClient";
import { ProjectWorkControlSurface } from "./ProjectWorkControlSurface";
import { createPhase4ProjectWorkApiClient, type Phase4ProjectWorkApiClient } from "./phase4ProjectWorkApiClient";

type AppProps = {
  testUser?: string;
  tenantLabelOverrides?: Record<string, string>;
  apiClient?: Phase2ApiClient & Partial<CrmIntakeApiClient> & Partial<Phase4ProjectWorkApiClient>;
};

const shellLabelDefaults = {
  "navigation.crm_intake": "CRM-приемка",
  "navigation.portfolio": "Портфель",
  "navigation.projects": "Проекты",
  "navigation.gantt": "Гантт",
  "navigation.resources": "Ресурсы",
  "navigation.kpi": "KPI",
  "navigation.control_surfaces": "Контрольные поверхности",
  "navigation.my_work": "Моя работа",
  "navigation.retrospectives": "Ретроспектива",
  "navigation.settings": "Настройки",
  "role.tenant_admin": "Администратор",
  "role.project_manager": "Руководитель проекта",
  "role.resource_manager": "Ресурсный менеджер",
  "role.executor": "Исполнитель",
  "role.readonly_observer": "Наблюдатель",
  "role.tenant_user": "Пользователь",
  "shell.demo_tenant_prefix": "Демо-тенант",
  "shell.configuration_version_prefix": "Версия конфигурации",
  "shell.primary_navigation_aria": "Основная навигация",
  "shell.test_user_prefix": "Тестовый пользователь",
  "shell.phase_scope_notice": "Фаза 4: проектный жизненный цикл, задачи, мои очереди и Kanban",
  "shell.empty_state_title": "Основа готовится для управляемых сценариев",
  "shell.empty_state_body":
    "Здесь пока только shell, маршрутизация проверки и фикстуры. CRM, проекты, KPI, ресурсы и контрольные поверхности появятся в своих фазах.",
  "shell.external_services_note": "Внешние сервисы не используются в smoke-режиме.",
  "phase2.surface_title": "Администрирование доступа",
  "phase2.surface_body": "Минимальная поверхность Фазы 2 для проверки прав, меток, изоляции и аудита.",
  "phase2.readonly_notice": "Режим чтения: изменения профилей и меток недоступны."
} satisfies Record<string, string>;

const navigationLabelKeys = [
  "navigation.crm_intake",
  "navigation.portfolio",
  "navigation.projects",
  "navigation.gantt",
  "navigation.resources",
  "navigation.kpi",
  "navigation.control_surfaces",
  "navigation.my_work",
  "navigation.retrospectives",
  "navigation.settings"
];

function resolveFixtureSession(testUser: string) {
  for (const tenant of getDemoTenants()) {
    const user = tenant.users.find((candidate) => candidate.id === testUser);
    if (user) {
      return { tenant, user };
    }
  }

  return null;
}

function isFixtureAuthEnabled() {
  return import.meta.env.MODE === "test" || import.meta.env.VITE_KISS_PM_ALLOW_FIXTURE_AUTH === "true";
}

function getRuntimeTestUser(explicitUser?: string) {
  if (explicitUser !== undefined) {
    return explicitUser;
  }

  return new URLSearchParams(window.location.search).get("testUser") ?? "";
}

function createRuntimeLabelSet(
  tenant: { id: string; configurationVersion: number },
  overrides?: Record<string, string>
): TenantLabelSet {
  const hasOverrides = overrides !== undefined && Object.keys(overrides).length > 0;

  return createTenantLabelSet({
    tenantId: tenant.id,
    configurationVersion: tenant.configurationVersion + (hasOverrides ? 1 : 0),
    labels: {
      ...shellLabelDefaults,
      ...(overrides ?? {})
    },
    updatedAt: hasOverrides ? "2026-05-14T13:23:00+07:00" : "2026-05-14T09:18:00+07:00"
  });
}

function createFallbackCurrentTenant(
  fixtureSession: NonNullable<ReturnType<typeof resolveFixtureSession>>,
  tenantLabelOverrides?: Record<string, string>
): CurrentTenantDto {
  const labelSet = createRuntimeLabelSet(fixtureSession.tenant, tenantLabelOverrides);

  return {
    tenant: {
      id: fixtureSession.tenant.id,
      label: fixtureSession.tenant.label,
      configurationVersion: labelSet.configurationVersion
    },
    actor: {
      id: fixtureSession.user.id,
      displayName: fixtureSession.user.displayName,
      ...(fixtureSession.user.accessProfileId ? { accessProfileId: fixtureSession.user.accessProfileId } : {})
    },
    labels: labelSet.labels,
    permissions: ["tenant.read"]
  };
}

function shouldUseDefaultPhase2ApiClient(): boolean {
  return import.meta.env.MODE !== "test";
}

function isCrmIntakeApiClient(apiClient: Partial<CrmIntakeApiClient> | null): apiClient is CrmIntakeApiClient {
  return (
    typeof apiClient?.listOpportunities === "function" &&
    typeof apiClient.createOpportunity === "function" &&
    typeof apiClient.runReadiness === "function" &&
    typeof apiClient.runFeasibility === "function" &&
    typeof apiClient.createProjectDraft === "function" &&
    typeof apiClient.getProjectDraft === "function" &&
    typeof apiClient.listOpportunityAuditEvents === "function"
  );
}

function isPhase4ProjectWorkApiClient(
  apiClient: Partial<Phase4ProjectWorkApiClient> | null
): apiClient is Phase4ProjectWorkApiClient {
  return (
    typeof apiClient?.ensureProjectDraft === "function" &&
    typeof apiClient.createProjectFromTemplate === "function" &&
    typeof apiClient.getProject === "function" &&
    typeof apiClient.transitionProjectStage === "function" &&
    typeof apiClient.recordArtifact === "function" &&
    typeof apiClient.recordApproval === "function" &&
    typeof apiClient.listProjectTasks === "function" &&
    typeof apiClient.createProjectTask === "function" &&
    typeof apiClient.changeTaskStatus === "function" &&
    typeof apiClient.addTaskComment === "function" &&
    typeof apiClient.listMyTasks === "function" &&
    typeof apiClient.getKanbanProject === "function" &&
    typeof apiClient.listAuditEventsForTarget === "function"
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getPhase2ProbeIds(tenantId: string): { ownProbeId: string; foreignProbeId: string } {
  if (tenantId === "tenant-b") {
    return {
      ownProbeId: "probe-b-private",
      foreignProbeId: "probe-a-private"
    };
  }

  return {
    ownProbeId: "probe-a-private",
    foreignProbeId: "probe-b-private"
  };
}

function Phase2AdminSurface({
  apiClient,
  currentTenant,
  testUser,
  onCurrentTenantChange
}: {
  apiClient: Phase2ApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
  onCurrentTenantChange: (currentTenant: CurrentTenantDto) => void;
}) {
  const [profiles, setProfiles] = useState<AccessProfileDto[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([]);
  const [labelValue, setLabelValue] = useState(currentTenant.labels["navigation.admin"] ?? "");
  const [status, setStatus] = useState("Готово");
  const [probeResult, setProbeResult] = useState<TenantIsolationProbeDto | string | null>(null);
  const [diagnostics, setDiagnostics] = useState<PolicyDiagnosticsDto | null>(null);
  const [pendingAction, setPendingAction] = useState<"profile" | "label" | "ownProbe" | "foreignProbe" | null>(null);
  const canReadProfiles = hasPermission(currentTenant, "access_profile.read");
  const canWriteProfiles = hasPermission(currentTenant, "access_profile.write");
  const canWriteLabels = hasPermission(currentTenant, "tenant_labels.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const canReadDiagnostics = hasPermission(currentTenant, "permission.diagnostics.read");
  const isReadonly = !canWriteProfiles && !canWriteLabels;
  const { ownProbeId, foreignProbeId } = getPhase2ProbeIds(currentTenant.tenant.id);

  const refreshAudit = useCallback(async () => {
    if (!canReadAudit) {
      setAuditEvents([]);
      return;
    }

    setAuditEvents(await apiClient.listAuditEvents(testUser));
  }, [apiClient, canReadAudit, testUser]);

  const refreshProfiles = useCallback(async () => {
    if (!canReadProfiles) {
      setProfiles([]);
      return;
    }

    setProfiles(await apiClient.listAccessProfiles(testUser));
  }, [apiClient, canReadProfiles, testUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadSurfaceData() {
      try {
        const [nextProfiles, nextAuditEvents] = await Promise.all([
          canReadProfiles ? apiClient.listAccessProfiles(testUser) : Promise.resolve([]),
          canReadAudit ? apiClient.listAuditEvents(testUser) : Promise.resolve([])
        ]);
        if (!cancelled) {
          setProfiles(nextProfiles);
          setAuditEvents(nextAuditEvents);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(getErrorMessage(error));
        }
      }
    }

    void loadSurfaceData();

    return () => {
      cancelled = true;
    };
  }, [apiClient, canReadAudit, canReadProfiles, testUser]);

  useEffect(() => {
    setLabelValue(currentTenant.labels["navigation.admin"] ?? "");
  }, [currentTenant.labels]);

  async function createReviewerProfile() {
    if (pendingAction !== null) return;

    setPendingAction("profile");
    setStatus("Сохранение профиля доступа");
    try {
      await apiClient.upsertAccessProfile(testUser, {
        systemKey: "ui_reviewer",
        label: "Ревизор доступа",
        permissions: ["tenant.read", "audit.read"],
        scopeRules: [
          { permissionKey: "tenant.read", scope: "tenant" },
          { permissionKey: "audit.read", scope: "tenant" }
        ],
        active: true
      });
      await refreshProfiles();
      await refreshAudit();
      setStatus("Профиль доступа сохранен");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function saveTenantLabel() {
    if (pendingAction !== null) return;

    setPendingAction("label");
    setStatus("Сохранение метки");
    try {
      await apiClient.updateTenantLabel(testUser, {
        key: "navigation.admin",
        label: labelValue,
        expectedConfigurationVersion: currentTenant.tenant.configurationVersion
      });
      const nextCurrentTenant = await apiClient.getCurrentTenant(testUser);
      onCurrentTenantChange(nextCurrentTenant);
      await refreshAudit();
      setStatus("Метка сохранена");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function showOwnProbe() {
    if (pendingAction !== null) return;

    setPendingAction("ownProbe");
    setStatus("Проверка своей пробы");
    try {
      setProbeResult(await apiClient.getIsolationProbe(testUser, ownProbeId));
      setStatus("Проба доступна");
    } catch (error) {
      setProbeResult(getErrorMessage(error));
      setStatus("Проба недоступна");
    } finally {
      setPendingAction(null);
    }
  }

  async function checkForeignProbe() {
    if (pendingAction !== null) return;

    setPendingAction("foreignProbe");
    setStatus("Проверка изоляции");
    try {
      if (canReadDiagnostics) {
        setDiagnostics(
          await apiClient.evaluatePermission(testUser, {
            permissionKey: "tenant_probe.read",
            targetEntityType: "tenantIsolationProbe",
            targetEntityId: foreignProbeId,
            requestedScope: "tenant"
          })
        );
      }
      await apiClient.getIsolationProbe(testUser, foreignProbeId);
      setProbeResult("Проба доступна");
    } catch (error) {
      setProbeResult(getErrorMessage(error));
    } finally {
      setStatus("Проверка завершена");
      setPendingAction(null);
    }
  }

  return (
    <section className="phase2-surface" data-testid="phase2-admin-surface">
      <div className="surface-heading">
        <div>
          <h2>{currentTenant.labels["phase2.surface_title"] ?? shellLabelDefaults["phase2.surface_title"]}</h2>
          <p>{currentTenant.labels["phase2.surface_body"] ?? shellLabelDefaults["phase2.surface_body"]}</p>
        </div>
        <p className="status-pill" data-testid="phase2-status">
          {status}
        </p>
      </div>

      {isReadonly ? (
        <p className="readonly-notice" data-testid="readonly-denial">
          {currentTenant.labels["phase2.readonly_notice"] ?? shellLabelDefaults["phase2.readonly_notice"]}
        </p>
      ) : null}

      <div className="phase2-grid">
        <section className="phase2-panel">
          <h3>Профили доступа</h3>
          <div className="compact-list" data-testid="access-profile-list">
            {profiles.length > 0 ? profiles.map((profile) => <span key={profile.id}>{profile.label}</span>) : "Нет доступных профилей"}
          </div>
          {canWriteProfiles ? (
            <button disabled={pendingAction !== null} type="button" onClick={() => void createReviewerProfile()}>
              Создать профиль ревизора
            </button>
          ) : null}
        </section>

        <section className="phase2-panel">
          <h3>Метки тенанта</h3>
          <p data-testid="admin-navigation-label">{currentTenant.labels["navigation.admin"] ?? "Администрирование"}</p>
          {canWriteLabels ? (
            <label className="field-stack">
              <span>Метка раздела администрирования</span>
              <input
                aria-label="Метка раздела администрирования"
                onChange={(event) => setLabelValue(event.target.value)}
                value={labelValue}
              />
              <button disabled={pendingAction !== null} type="button" onClick={() => void saveTenantLabel()}>
                Сохранить метку
              </button>
            </label>
          ) : null}
        </section>

        <section className="phase2-panel">
          <h3>Проверка изоляции</h3>
          <div className="button-row">
            <button disabled={pendingAction !== null} type="button" onClick={() => void showOwnProbe()}>
              Показать свою пробу
            </button>
            <button disabled={pendingAction !== null} type="button" onClick={() => void checkForeignProbe()}>
              Проверить чужую пробу
            </button>
          </div>
          <p data-testid="probe-result">
            {typeof probeResult === "string"
              ? probeResult
              : probeResult
                ? `${probeResult.tenantId}: ${probeResult.label}`
                : "Проверка еще не запускалась"}
          </p>
          <p data-testid="permission-diagnostics">
            {diagnostics ? diagnostics.reasonCode : "Диагностика еще не запускалась"}
          </p>
        </section>

        <section className="phase2-panel">
          <h3>{currentTenant.labels["navigation.audit"] ?? "Журнал действий"}</h3>
          <div className="compact-list" data-testid="audit-events">
            {auditEvents.length > 0
              ? auditEvents.map((event) => (
                  <span key={event.id}>
                    {event.actionKey}: {event.actorId} - {event.target.entityId}
                  </span>
                ))
              : "Пока нет событий"}
          </div>
        </section>
      </div>
    </section>
  );
}

export function App({ testUser, tenantLabelOverrides, apiClient }: AppProps) {
  const runtimeUser = getRuntimeTestUser(testUser);
  const fixtureSession = useMemo(
    () => (runtimeUser && isFixtureAuthEnabled() ? resolveFixtureSession(runtimeUser) : null),
    [runtimeUser]
  );
  const phase2ApiClient = useMemo(
    () => apiClient ?? (shouldUseDefaultPhase2ApiClient() ? createPhase2ApiClient() : null),
    [apiClient]
  );
  const crmIntakeApiClient = useMemo(() => {
    const providedApiClient = apiClient ?? null;
    if (isCrmIntakeApiClient(providedApiClient)) {
      return providedApiClient;
    }

    return shouldUseDefaultPhase2ApiClient() ? createCrmIntakeApiClient() : null;
  }, [apiClient]);
  const projectWorkApiClient = useMemo(() => {
    const providedApiClient = apiClient ?? null;
    if (isPhase4ProjectWorkApiClient(providedApiClient)) {
      return providedApiClient;
    }

    return shouldUseDefaultPhase2ApiClient() ? createPhase4ProjectWorkApiClient() : null;
  }, [apiClient]);
  const phase2Enabled = phase2ApiClient !== null;
  const [currentTenant, setCurrentTenant] = useState<CurrentTenantDto | null>(() =>
    fixtureSession && !phase2Enabled ? createFallbackCurrentTenant(fixtureSession, tenantLabelOverrides) : null
  );
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!fixtureSession || !phase2ApiClient) {
      if (fixtureSession) {
        setCurrentTenant(createFallbackCurrentTenant(fixtureSession, tenantLabelOverrides));
      }
      return;
    }

    let cancelled = false;
    const activeApiClient = phase2ApiClient;

    async function loadCurrentTenant() {
      try {
        const nextCurrentTenant = await activeApiClient.getCurrentTenant(runtimeUser);
        if (!cancelled) {
          setCurrentTenant(nextCurrentTenant);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(getErrorMessage(error));
        }
      }
    }

    void loadCurrentTenant();

    return () => {
      cancelled = true;
    };
  }, [fixtureSession, phase2ApiClient, runtimeUser, tenantLabelOverrides]);

  if (!fixtureSession) {
    return (
      <main className="auth-screen" data-testid="auth-guard">
        <section className="auth-panel">
          <h1>KISS PM</h1>
          <p>Войдите в тестовый режим</p>
          <a href="/?testUser=project-manager-a">Открыть smoke-shell</a>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="auth-screen" data-testid="phase2-error">
        <section className="auth-panel">
          <h1>KISS PM</h1>
          <p>{loadError}</p>
        </section>
      </main>
    );
  }

  if (!currentTenant) {
    return (
      <main className="auth-screen" data-testid="phase2-loading">
        <section className="auth-panel">
          <h1>KISS PM</h1>
          <p>Загрузка данных тенанта</p>
        </section>
      </main>
    );
  }

  const tenantLabelSet = createTenantLabelSet({
    tenantId: currentTenant.tenant.id,
    configurationVersion: currentTenant.tenant.configurationVersion,
    labels: {
      ...shellLabelDefaults,
      ...currentTenant.labels
    },
    updatedAt: "2026-05-14T14:40:00+07:00"
  });
  const roleLabel = resolveTenantLabel(tenantLabelSet, `role.${fixtureSession.user.roleKey}`);

  return (
    <div className="app-shell" data-testid="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>KISS PM</h1>
          <span data-testid="tenant-indicator">
            {resolveTenantLabel(tenantLabelSet, "shell.demo_tenant_prefix")}: {fixtureSession.tenant.label}
          </span>
          <span data-testid="tenant-configuration-version">
            {resolveTenantLabel(tenantLabelSet, "shell.configuration_version_prefix")}:{" "}
            {tenantLabelSet.configurationVersion}
          </span>
        </div>
        <nav
          aria-label={resolveTenantLabel(tenantLabelSet, "shell.primary_navigation_aria")}
          data-testid="primary-navigation"
        >
          {navigationLabelKeys.map((labelKey) => (
            <a href="#phase-1-placeholder" key={labelKey}>
              {resolveTenantLabel(tenantLabelSet, labelKey)}
            </a>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <p data-testid="phase-scope-notice">
            {resolveTenantLabel(tenantLabelSet, "shell.phase_scope_notice")}
          </p>
          <div className="user-stack">
            <p className="user-chip">
              {resolveTenantLabel(tenantLabelSet, "shell.test_user_prefix")}: {fixtureSession.user.displayName}
            </p>
            <p className="role-chip" data-testid="runtime-role-label">
              {roleLabel}
            </p>
          </div>
        </header>

        <section className="empty-state" id="phase-1-placeholder">
          <h2>{resolveTenantLabel(tenantLabelSet, "shell.empty_state_title")}</h2>
          <p>
            {resolveTenantLabel(tenantLabelSet, "shell.empty_state_body")}
          </p>
          <p data-testid="fixture-summary">{getDemoTenantSummary()}</p>
          <p data-testid="external-services-note">
            {resolveTenantLabel(tenantLabelSet, "shell.external_services_note")}
          </p>
        </section>
        {phase2ApiClient ? (
          <Phase2AdminSurface
            apiClient={phase2ApiClient}
            currentTenant={currentTenant}
            onCurrentTenantChange={setCurrentTenant}
            testUser={runtimeUser}
          />
        ) : null}
        {crmIntakeApiClient ? (
          <CrmIntakeControlSurface
            apiClient={crmIntakeApiClient}
            currentTenant={currentTenant}
            testUser={runtimeUser}
          />
        ) : null}
        {projectWorkApiClient ? (
          <ProjectWorkControlSurface
            apiClient={projectWorkApiClient}
            currentTenant={currentTenant}
            testUser={runtimeUser}
          />
        ) : null}
      </main>
    </div>
  );
}
