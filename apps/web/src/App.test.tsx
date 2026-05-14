import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("KISS PM web shell", () => {
  it("renders the Russian shell with demo tenant and navigation placeholders", () => {
    render(<App testUser="project-manager-a" />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
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

  it("blocks an unknown test user instead of opening the shell", () => {
    render(<App testUser="unknown-user" />);

    expect(screen.getByTestId("auth-guard")).toBeInTheDocument();
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
  });

  it("renders the tenant that owns the fixture user", () => {
    render(<App testUser="tenant-admin-b" />);

    expect(screen.getByTestId("tenant-indicator")).toHaveTextContent("Демо-тенант: Студия B");
    expect(screen.getByText("Тестовый пользователь: Администратор B")).toBeInTheDocument();
  });

  it("reads shell labels from tenant configuration instead of fixed navigation text", () => {
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

    const navigation = screen.getByRole("navigation", { name: "Навигация арендатора" });
    expect(within(navigation).getByText("Проектный контур")).toBeInTheDocument();
    expect(within(navigation).getByText("Администрирование")).toBeInTheDocument();
    expect(within(navigation).queryByText("Проекты")).not.toBeInTheDocument();
    expect(screen.getByTestId("tenant-indicator")).toHaveTextContent("Рабочий тенант: Студия A");
    expect(screen.getByTestId("tenant-configuration-version")).toHaveTextContent("Конфигурация: 2");
    expect(screen.getByText("Пользователь сессии: Руководитель проекта")).toBeInTheDocument();
    expect(screen.getByTestId("runtime-role-label")).toHaveTextContent("РП из конфигурации");
  });
});
