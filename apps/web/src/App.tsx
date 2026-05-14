import { getDemoTenantSummary, getDemoTenants } from "@kiss-pm/shared-test-fixtures";

type AppProps = {
  testUser?: string;
};

const navigationItems = [
  "CRM-приемка",
  "Портфель",
  "Проекты",
  "Гантт",
  "Ресурсы",
  "KPI",
  "Контрольные поверхности",
  "Моя работа",
  "Ретроспектива",
  "Настройки"
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

export function App({ testUser }: AppProps) {
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

  return (
    <div className="app-shell" data-testid="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>KISS PM</h1>
          <span data-testid="tenant-indicator">Демо-тенант: {fixtureSession.tenant.label}</span>
        </div>
        <nav aria-label="Основная навигация" data-testid="primary-navigation">
          {navigationItems.map((item) => (
            <a href="#phase-1-placeholder" key={item}>
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <p data-testid="phase-scope-notice">
            Фаза 1: платформенный каркас без продуктовых сценариев
          </p>
          <p className="user-chip">Тестовый пользователь: {fixtureSession.user.displayName}</p>
        </header>

        <section className="empty-state" id="phase-1-placeholder">
          <h2>Основа готовится для управляемых сценариев</h2>
          <p>
            Здесь пока только shell, маршрутизация проверки и фикстуры. CRM, проекты, KPI,
            ресурсы и контрольные поверхности появятся в своих фазах.
          </p>
          <p data-testid="fixture-summary">{getDemoTenantSummary()}</p>
          <p data-testid="external-services-note">
            Внешние сервисы не используются в smoke-режиме.
          </p>
        </section>
      </main>
    </div>
  );
}
