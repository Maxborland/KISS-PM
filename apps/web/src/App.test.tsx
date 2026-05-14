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
});
