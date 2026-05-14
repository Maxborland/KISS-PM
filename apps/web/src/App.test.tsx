import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { Phase2ApiClient } from "./phase2ApiClient";

function createAdminApiClient(): Phase2ApiClient {
  let configurationVersion = 1;
  let labels: Record<string, string> = {
    "navigation.admin": "Администрирование",
    "navigation.audit": "Журнал действий",
    "role.tenant_admin": "Администратор",
    "role.project_manager": "Руководитель проекта",
    "role.resource_manager": "Ресурсный менеджер",
    "role.executor": "Исполнитель",
    "role.readonly_observer": "Наблюдатель"
  };
  const profiles = [
    {
      id: "profile-tenant-admin-a",
      tenantId: "tenant-a",
      systemKey: "tenant_admin",
      label: "Администратор тенанта",
      permissions: ["tenant.read", "access_profile.write", "tenant_labels.write", "audit.read"],
      scopeRules: [{ permissionKey: "tenant.read", scope: "all" }],
      active: true,
      version: 1,
      updatedAt: "2026-05-14T00:00:00.000Z"
    }
  ];
  const events: Awaited<ReturnType<Phase2ApiClient["listAuditEvents"]>> = [];

  return {
    getCurrentTenant: vi.fn(async () => ({
      tenant: {
        id: "tenant-a",
        label: "Студия A",
        configurationVersion
      },
      actor: {
        id: "tenant-admin-a",
        displayName: "Администратор",
        accessProfileId: "profile-tenant-admin-a"
      },
      labels,
      permissions: [
        "tenant.read",
        "access_profile.read",
        "access_profile.write",
        "tenant_labels.write",
        "permission.diagnostics.read",
        "tenant_probe.read",
        "audit.read"
      ]
    })),
    listAccessProfiles: vi.fn(async () => profiles),
    upsertAccessProfile: vi.fn(async (_testUser, request) => {
      const profile = {
        id: request.id ?? `profile-${request.systemKey}-tenant-a`,
        tenantId: "tenant-a",
        systemKey: request.systemKey,
        label: request.label,
        permissions: request.permissions,
        scopeRules: request.scopeRules,
        active: request.active,
        version: 1,
        updatedAt: "2026-05-14T00:00:00.000Z"
      };
      profiles.push(profile);
      events.push({
        id: "audit-profile",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "access_profile.upsert",
        target: { entityType: "accessProfile", entityId: profile.id },
        result: "success",
        timestamp: "2026-05-14T00:00:00.000Z",
        correlationId: "corr-audit-profile"
      });
      return profile;
    }),
    updateTenantLabel: vi.fn(async (_testUser, request) => {
      configurationVersion += 1;
      const beforeLabel = labels[request.key] ?? "";
      labels = { ...labels, [request.key]: request.label };
      events.push({
        id: "audit-label",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "tenant_label.update",
        target: { entityType: "tenantLabel", entityId: request.key },
        result: "success",
        timestamp: "2026-05-14T00:00:00.000Z",
        correlationId: "corr-audit-label",
        details: {
          previousConfigurationVersion: request.expectedConfigurationVersion,
          newConfigurationVersion: configurationVersion,
          changedLabel: {
            key: request.key,
            beforeLabel,
            afterLabel: request.label
          }
        }
      });
      return {
        tenantId: "tenant-a",
        configurationVersion,
        previousConfigurationVersion: request.expectedConfigurationVersion,
        changedLabel: {
          key: request.key,
          beforeLabel,
          afterLabel: request.label
        },
        labels
      };
    }),
    evaluatePermission: vi.fn(async () => ({
      allowed: false,
      reasonCode: "tenant_mismatch",
      scope: "tenant",
      trace: ["policy:tenant_mismatch"]
    })),
    getIsolationProbe: vi.fn(async (_testUser, probeId) => {
      if (probeId === "probe-a-private") {
        return {
          id: "probe-a-private",
          tenantId: "tenant-a",
          label: "Закрытые данные Tenant A"
        };
      }

      throw Object.assign(new Error("not_found"), { code: "not_found", message: "Объект не найден" });
    }),
    listAuditEvents: vi.fn(async () => events)
  };
}

function createReadonlyApiClient(): Phase2ApiClient {
  return {
    getCurrentTenant: vi.fn(async () => ({
      tenant: {
        id: "tenant-a",
        label: "Студия A",
        configurationVersion: 1
      },
      actor: {
        id: "readonly-observer-a",
        displayName: "Наблюдатель",
        accessProfileId: "profile-readonly-observer-a"
      },
      labels: {
        "navigation.admin": "Администрирование",
        "navigation.audit": "Журнал действий",
        "role.readonly_observer": "Наблюдатель"
      },
      permissions: ["tenant.read", "tenant_probe.read", "audit.read"]
    })),
    listAccessProfiles: vi.fn(async () => []),
    upsertAccessProfile: vi.fn(async () => {
      throw Object.assign(new Error("permission_denied"), { code: "permission_denied", message: "Доступ запрещен" });
    }),
    updateTenantLabel: vi.fn(async () => {
      throw Object.assign(new Error("permission_denied"), { code: "permission_denied", message: "Доступ запрещен" });
    }),
    evaluatePermission: vi.fn(async () => ({
      allowed: false,
      reasonCode: "permission_missing",
      trace: ["policy:permission_missing"]
    })),
    getIsolationProbe: vi.fn(async () => ({
      id: "probe-a-private",
      tenantId: "tenant-a",
      label: "Закрытые данные Tenant A"
    })),
    listAuditEvents: vi.fn(async () => [])
  };
}

function createTenantBApiClient(): Phase2ApiClient {
  return {
    getCurrentTenant: vi.fn(async () => ({
      tenant: {
        id: "tenant-b",
        label: "Студия B",
        configurationVersion: 1
      },
      actor: {
        id: "tenant-admin-b",
        displayName: "Администратор B",
        accessProfileId: "profile-tenant-admin-b"
      },
      labels: {
        "navigation.admin": "Администрирование B",
        "navigation.audit": "Журнал действий B",
        "role.tenant_admin": "Администратор B"
      },
      permissions: [
        "tenant.read",
        "access_profile.read",
        "access_profile.write",
        "tenant_labels.write",
        "permission.diagnostics.read",
        "tenant_probe.read",
        "audit.read"
      ]
    })),
    listAccessProfiles: vi.fn(async () => []),
    upsertAccessProfile: vi.fn(async () => ({
      id: "profile-b",
      tenantId: "tenant-b",
      systemKey: "profile_b",
      label: "Профиль B",
      permissions: ["tenant.read"],
      scopeRules: [{ permissionKey: "tenant.read", scope: "tenant" }],
      active: true,
      version: 1,
      updatedAt: "2026-05-14T00:00:00.000Z"
    })),
    updateTenantLabel: vi.fn(async () => ({
      tenantId: "tenant-b",
      configurationVersion: 2,
      labels: { "navigation.admin": "Администрирование B" }
    })),
    evaluatePermission: vi.fn(async () => ({
      allowed: false,
      reasonCode: "tenant_mismatch",
      scope: "tenant",
      trace: ["policy:tenant_mismatch"]
    })),
    getIsolationProbe: vi.fn(async (_testUser, probeId) => {
      if (probeId === "probe-b-private") {
        return {
          id: "probe-b-private",
          tenantId: "tenant-b",
          label: "Закрытые данные Tenant B"
        };
      }

      throw Object.assign(new Error("Объект не найден"), { code: "not_found", message: "Объект не найден" });
    }),
    listAuditEvents: vi.fn(async () => [])
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe("KISS PM web shell", () => {
  it("renders the Russian shell with demo tenant and navigation placeholders", async () => {
    render(<App testUser="project-manager-a" />);

    expect(await screen.findByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "KISS PM" })).toBeInTheDocument();
    expect(screen.getByText("Демо-тенант: Студия A")).toBeInTheDocument();

    const navigation = screen.getByTestId("primary-navigation");
    expect(within(navigation).getByText("CRM-приемка")).toBeInTheDocument();
    expect(within(navigation).getByText("Портфель")).toBeInTheDocument();
    expect(within(navigation).getByText("Проекты")).toBeInTheDocument();
    expect(within(navigation).getByText("Гантт")).toBeInTheDocument();
    expect(within(navigation).getByText("Ресурсы")).toBeInTheDocument();
    expect(within(navigation).getByText("KPI")).toBeInTheDocument();
    expect(within(navigation).getByText("Контрольные поверхности")).toBeInTheDocument();
    expect(within(navigation).getByText("Моя работа")).toBeInTheDocument();
    expect(within(navigation).getByText("Ретроспектива")).toBeInTheDocument();
    expect(within(navigation).getByText("Настройки")).toBeInTheDocument();

    expect(screen.getByTestId("phase-scope-notice")).toHaveTextContent(
      "Фаза 1: платформенный каркас без продуктовых сценариев"
    );
  });

  it("blocks an unknown test user instead of opening the shell", async () => {
    render(<App testUser="unknown-user" />);

    expect(await screen.findByTestId("auth-guard")).toBeInTheDocument();
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
  });

  it("renders the tenant that owns the fixture user", async () => {
    render(<App testUser="tenant-admin-b" />);

    expect(await screen.findByTestId("tenant-indicator")).toHaveTextContent("Демо-тенант: Студия B");
    expect(screen.getByText("Тестовый пользователь: Администратор B")).toBeInTheDocument();
  });

  it("reads shell labels from tenant configuration instead of fixed navigation text", async () => {
    render(
      <App
        testUser="project-manager-a"
        tenantLabelOverrides={{
          "navigation.projects": "Проектный контур",
          "navigation.settings": "Администрирование",
          "role.project_manager": "РП из конфигурации",
          "shell.demo_tenant_prefix": "Рабочий тенант",
          "shell.configuration_version_prefix": "Конфигурация",
          "shell.primary_navigation_aria": "Навигация арендатора",
          "shell.test_user_prefix": "Пользователь сессии"
        }}
      />
    );

    const navigation = await screen.findByRole("navigation", { name: "Навигация арендатора" });
    expect(within(navigation).getByText("Проектный контур")).toBeInTheDocument();
    expect(within(navigation).getByText("Администрирование")).toBeInTheDocument();
    expect(within(navigation).queryByText("Проекты")).not.toBeInTheDocument();
    expect(screen.getByTestId("tenant-indicator")).toHaveTextContent("Рабочий тенант: Студия A");
    expect(screen.getByTestId("tenant-configuration-version")).toHaveTextContent("Конфигурация: 2");
    expect(screen.getByText("Пользователь сессии: Руководитель проекта")).toBeInTheDocument();
    expect(screen.getByTestId("runtime-role-label")).toHaveTextContent("РП из конфигурации");
  });

  it("lets an admin create an access profile and refreshes audit evidence", async () => {
    const apiClient = createAdminApiClient();

    render(<App apiClient={apiClient} testUser="tenant-admin-a" />);

    expect(await screen.findByTestId("phase2-admin-surface")).toBeInTheDocument();
    expect(await screen.findByText("Администратор тенанта")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Создать профиль ревизора" }));

    await waitFor(() => {
      expect(apiClient.upsertAccessProfile).toHaveBeenCalledWith(
        "tenant-admin-a",
        expect.objectContaining({
          systemKey: "ui_reviewer",
          permissions: ["tenant.read", "audit.read"]
        })
      );
    });
    expect(await screen.findByText("Профиль доступа сохранен")).toBeInTheDocument();
    expect(screen.getByTestId("audit-events")).toHaveTextContent("access_profile.upsert");
    expect(screen.getByTestId("phase2-status")).toHaveTextContent("Профиль доступа сохранен");
  });

  it("disables profile mutation while the save request is in flight", async () => {
    const apiClient = createAdminApiClient();
    const deferredProfile = createDeferred<Awaited<ReturnType<Phase2ApiClient["upsertAccessProfile"]>>>();
    vi.mocked(apiClient.upsertAccessProfile).mockReturnValueOnce(deferredProfile.promise);

    render(<App apiClient={apiClient} testUser="tenant-admin-a" />);

    expect(await screen.findByText("Администратор тенанта")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Создать профиль ревизора" });

    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(apiClient.upsertAccessProfile).toHaveBeenCalledTimes(1);

    deferredProfile.resolve({
      id: "profile-ui_reviewer-tenant-a",
      tenantId: "tenant-a",
      systemKey: "ui_reviewer",
      label: "Ревизор доступа",
      permissions: ["tenant.read", "audit.read"],
      scopeRules: [
        { permissionKey: "tenant.read", scope: "tenant" },
        { permissionKey: "audit.read", scope: "tenant" }
      ],
      active: true,
      version: 1,
      updatedAt: "2026-05-14T00:00:00.000Z"
    });

    expect(await screen.findByText("Профиль доступа сохранен")).toBeInTheDocument();
  });

  it("disables label mutation while the save request is in flight", async () => {
    const apiClient = createAdminApiClient();
    const deferredLabel = createDeferred<Awaited<ReturnType<Phase2ApiClient["updateTenantLabel"]>>>();
    vi.mocked(apiClient.updateTenantLabel).mockReturnValueOnce(deferredLabel.promise);

    render(<App apiClient={apiClient} testUser="tenant-admin-a" />);

    expect(await screen.findByTestId("admin-navigation-label")).toHaveTextContent("Администрирование");
    fireEvent.change(screen.getByLabelText("Метка раздела администрирования"), {
      target: { value: "Настройки доступа" }
    });
    const button = screen.getByRole("button", { name: "Сохранить метку" });

    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(apiClient.updateTenantLabel).toHaveBeenCalledTimes(1);

    deferredLabel.resolve({
      tenantId: "tenant-a",
      configurationVersion: 2,
      previousConfigurationVersion: 1,
      changedLabel: {
        key: "navigation.admin",
        beforeLabel: "Администрирование",
        afterLabel: "Настройки доступа"
      },
      labels: {
        "navigation.admin": "Настройки доступа",
        "navigation.audit": "Журнал действий",
        "role.tenant_admin": "Администратор",
        "role.project_manager": "Руководитель проекта",
        "role.resource_manager": "Ресурсный менеджер",
        "role.executor": "Исполнитель",
        "role.readonly_observer": "Наблюдатель"
      }
    });

    expect(await screen.findByText("Метка сохранена")).toBeInTheDocument();
  });

  it("lets an admin update a tenant label and shows refreshed runtime UI plus audit trace", async () => {
    const apiClient = createAdminApiClient();

    render(<App apiClient={apiClient} testUser="tenant-admin-a" />);

    expect(await screen.findByTestId("admin-navigation-label")).toHaveTextContent("Администрирование");
    fireEvent.change(screen.getByLabelText("Метка раздела администрирования"), {
      target: { value: "Настройки доступа" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить метку" }));

    expect(await screen.findByText("Настройки доступа")).toBeInTheDocument();
    expect(screen.getByTestId("tenant-configuration-version")).toHaveTextContent("Версия конфигурации: 2");
    expect(screen.getByTestId("audit-events")).toHaveTextContent("tenant_label.update");
    expect(screen.getByTestId("audit-events")).toHaveTextContent("navigation.admin");
  });

  it("shows read-only denial state without mutation controls", async () => {
    const apiClient = createReadonlyApiClient();

    render(<App apiClient={apiClient} testUser="readonly-observer-a" />);

    expect(await screen.findByTestId("phase2-admin-surface")).toBeInTheDocument();
    expect(screen.getByTestId("readonly-denial")).toHaveTextContent(/режим чтения/i);
    expect(screen.queryByRole("button", { name: "Создать профиль ревизора" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сохранить метку" })).not.toBeInTheDocument();
  });

  it("shows safe tenant-isolation probe denial without leaking Tenant B private details", async () => {
    const apiClient = createAdminApiClient();

    render(<App apiClient={apiClient} testUser="tenant-admin-a" />);

    expect(await screen.findByTestId("phase2-admin-surface")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Проверить чужую пробу" }));

    expect(await screen.findByTestId("probe-result")).toHaveTextContent("Объект не найден");
    expect(screen.getByTestId("permission-diagnostics")).toHaveTextContent("tenant_mismatch");
    expect(screen.queryByText("Закрытые данные Tenant B")).not.toBeInTheDocument();
    expect(screen.queryByText("probe-b-private")).not.toBeInTheDocument();
  });

  it("uses tenant-specific own and foreign probe ids for Tenant B users", async () => {
    const apiClient = createTenantBApiClient();

    render(<App apiClient={apiClient} testUser="tenant-admin-b" />);

    expect(await screen.findByTestId("phase2-admin-surface")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать свою пробу" }));

    await waitFor(() => {
      expect(apiClient.getIsolationProbe).toHaveBeenCalledWith("tenant-admin-b", "probe-b-private");
    });
    expect(await screen.findByTestId("probe-result")).toHaveTextContent("Закрытые данные Tenant B");

    fireEvent.click(screen.getByRole("button", { name: "Проверить чужую пробу" }));

    await waitFor(() => {
      expect(apiClient.evaluatePermission).toHaveBeenCalledWith(
        "tenant-admin-b",
        expect.objectContaining({
          targetEntityId: "probe-a-private"
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("probe-result")).toHaveTextContent("Объект не найден");
    });
  });

  it("shows an API load error instead of staying in a loading state", async () => {
    const apiClient = createAdminApiClient();
    vi.mocked(apiClient.getCurrentTenant).mockRejectedValueOnce(new Error("API недоступен"));

    render(<App apiClient={apiClient} testUser="tenant-admin-a" />);

    expect(await screen.findByTestId("phase2-error")).toHaveTextContent("API недоступен");
    expect(screen.queryByTestId("phase2-loading")).not.toBeInTheDocument();
  });
});
