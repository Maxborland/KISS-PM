// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectScenarios } from "./scenarios-surface";

let permissions: string[] = [];
const previewScenarios = vi.fn(async () => ({
  ok: true as const,
  proposals: [
    {
      id: "scenario-1",
      profile: "aggressive",
      conflictEffect: "accepted",
      availability: "available",
      unavailableReason: null,
      planDelta: {
        commands: [
          {
            type: "risk.accept_overload",
            payload: { resourceId: "resource-1", date: "2026-07-10" }
          }
        ]
      },
      explainability: {
        finishDate: "2026-07-12",
        overloadMinutes: 120,
        changedTaskIds: [],
        riskScore: 80,
        requiredApprovals: []
      }
    },
    {
      id: "scenario-2",
      profile: "balanced",
      conflictEffect: "reduced",
      availability: "unavailable",
      unavailableReason: "no_eligible_alternate_resource",
      planDelta: { commands: [] },
      explainability: {
        finishDate: "2026-07-12",
        overloadMinutes: 120,
        changedTaskIds: [],
        riskScore: 40,
        requiredApprovals: []
      }
    },
    {
      id: "scenario-3",
      profile: "resilient",
      conflictEffect: "removed",
      availability: "unavailable",
      unavailableReason: "alternate_resource_has_insufficient_capacity",
      planDelta: { commands: [] },
      explainability: {
        finishDate: "2026-07-12",
        overloadMinutes: 120,
        changedTaskIds: [],
        riskScore: 20,
        requiredApprovals: []
      }
    }
  ]
}));
const applyScenario = vi.fn();

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: {
      project: { deadline: "2026-07-12", plannedStart: "2026-07-06" },
      authored: {
        tasks: [],
        assignments: []
      },
      calculatedPlan: {
        projectFinish: "2026-07-12",
        criticalPathTaskIds: []
      },
      resourceLoad: {
        overloads: [
          {
            granularity: "day",
            resourceId: "resource-1",
            date: "2026-07-10",
            overloadMinutes: 120,
            taskIds: []
          }
        ],
        acceptedOverloads: []
      },
      planVersion: 7
    },
    status: "ready",
    error: null,
    reload: vi.fn(),
    previewScenarios,
    applyScenario
  })
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  deriveProjectMeta: () => ({}),
  planningErr: (value: string) => value,
  useProjectBase: () => ({ name: "Project", code: "PRJ" })
}));

vi.mock("@/delivery/lib/use-resource-directory", () => ({
  useResourceDirectory: () => ({
    name: () => "Resource One"
  })
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

describe("scenario permission controls", () => {
  beforeEach(() => {
    permissions = [];
    previewScenarios.mockClear();
    applyScenario.mockClear();
  });

  it("separates preview and apply capabilities without role hardcoding", async () => {
    const denied = await renderSurface([]);
    expect(previewScenarios).not.toHaveBeenCalled();
    expect(denied.host.textContent).toContain("Недостаточно прав для расчёта сценариев.");
    expect(button(denied.host, "Запросить заново")).toBeUndefined();
    expect(button(denied.host, "Сравнить")).toBeUndefined();
    expect(button(denied.host, "Применить")).toBeUndefined();
    await denied.unmount();

    const applyOnly = await renderSurface(["tenant.planning_scenarios.apply"]);
    expect(previewScenarios).not.toHaveBeenCalled();
    expect(applyOnly.host.textContent).toContain("Недостаточно прав для расчёта сценариев.");
    expect(button(applyOnly.host, "Запросить заново")).toBeUndefined();
    expect(button(applyOnly.host, "Сравнить")).toBeUndefined();
    expect(button(applyOnly.host, "Применить")).toBeUndefined();
    await applyOnly.unmount();

    previewScenarios.mockClear();
    const previewOnly = await renderSurface(["tenant.planning_scenarios.preview"]);
    expect(previewScenarios).toHaveBeenCalledTimes(1);
    expect(button(previewOnly.host, "Запросить заново")).toBeDefined();
    expect(button(previewOnly.host, "Сравнить")).toBeDefined();
    expect(button(previewOnly.host, "Применить")).toBeUndefined();
    expect(previewOnly.host.querySelectorAll('[data-testid^="scenario-card-"]')).toHaveLength(3);
    expect(previewOnly.host.querySelector('[data-testid="scenario-card-balanced"]')?.getAttribute("data-availability")).toBe("unavailable");
    expect(previewOnly.host.textContent).toContain("В команде нет ресурса подходящей позиции.");
    expect(previewOnly.host.querySelector('input[placeholder*="согласовано"]')).toBeNull();
    await act(async () => {
      button(previewOnly.host, "Сравнить")?.click();
    });
    expect(previewOnly.host.textContent).toContain("Сравнение · предпросмотр (ничего не сохранено)");
    expect(applyScenario).not.toHaveBeenCalled();
    await previewOnly.unmount();

    previewScenarios.mockClear();
    const full = await renderSurface([
      "tenant.planning_scenarios.preview",
      "tenant.planning_scenarios.apply"
    ]);
    expect(previewScenarios).toHaveBeenCalledTimes(1);
    expect(button(full.host, "Сравнить")).toBeDefined();
    expect(button(full.host, "Применить")).toBeDefined();
    expect(full.host.querySelector('input[placeholder*="согласовано"]')).not.toBeNull();
    await act(async () => {
      button(full.host, "Применить")?.click();
    });
    expect(applyScenario).not.toHaveBeenCalled();
    expect(full.host.textContent).toContain("Укажите причину принятия риска");
    await full.unmount();
  });
});

async function renderSurface(nextPermissions: string[]) {
  permissions = nextPermissions;
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(<ProjectScenarios projectId="project" />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return {
    host,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    }
  };
}

function button(host: HTMLElement, label: string) {
  return [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}
