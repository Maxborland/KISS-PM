import { getDemoTenantSummary, getDemoTenants } from "@kiss-pm/shared-test-fixtures";
import { createTenantLabelSet, resolveTenantLabel } from "@kiss-pm/tenant-config";
import type { TenantLabelSet } from "@kiss-pm/tenant-config";

type AppProps = {
  testUser?: string;
  tenantLabelOverrides?: Record<string, string>;
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
  "shell.phase_scope_notice": "Фаза 1: платформенный каркас без продуктовых сценариев",
  "shell.empty_state_title": "Основа готовится для управляемых сценариев",
  "shell.empty_state_body":
    "Здесь пока только shell, маршрутизация проверки и фикстуры. CRM, проекты, KPI, ресурсы и контрольные поверхности появятся в своих фазах.",
  "shell.external_services_note": "Внешние сервисы не используются в smoke-режиме."
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

export function App({ testUser, tenantLabelOverrides }: AppProps) {
  const runtimeUser = getRuntimeTestUser(testUser);
  const fixtureSession = runtimeUser && isFixtureAuthEnabled() ? resolveFixtureSession(runtimeUser) : null;

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

  const tenantLabelSet = createRuntimeLabelSet(fixtureSession.tenant, tenantLabelOverrides);
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
      </main>
    </div>
  );
}
