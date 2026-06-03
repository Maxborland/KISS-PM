// @vitest-environment happy-dom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "@/lib/api-types";
import { ProjectResourcesRuntimeBlock } from "@/views/blocks/project-resources-runtime-block";
import type { ResourceMatrixData } from "@/widgets/resource-matrix";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/views/layout/route-page-intro", () => ({
  RoutePageIntro: ({ actions, lead }: { actions?: ReactNode; lead?: string }) => (
    <header>
      <p>{lead}</p>
      {actions}
    </header>
  )
}));

describe("ProjectResourcesRuntimeBlock", () => {
  it("shows assignment changes as an honest disabled action until backend mutation exists", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          <ProjectResourcesRuntimeBlock
            project={project()}
            matrix={{
              days: [],
              rows: [],
              stats: {
                assignedHours: 0,
                capacityHours: 0,
                employees: 0,
                freeHours: 0,
                loadPct: 0
              }
            }}
          />
        );
      });

      const action = Array.from(host.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Изменить назначения")
      );

      expect(action).toHaveProperty("disabled", true);
      expect(action?.getAttribute("title")).toBe(
        "Сохранение назначений пока не подключено. Используйте задачи проекта для смены ответственных."
      );
      expect(host.textContent).toContain(
        "Изменение назначений пока недоступно: нет серверной команды для сохранения."
      );
      expect(host.textContent).toContain("Назначений нет");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("keeps missing-role rows visible in the read-only runtime matrix", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(<ProjectResourcesRuntimeBlock project={project()} matrix={matrixWithMissingRole()} />);
      });

      expect(host.textContent).toContain("BIM-координатор");
      expect(host.textContent).toContain("Не закрыта");
      expect(host.querySelector('[data-row-status="missing-role"]')).not.toBeNull();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});

function project(): Project {
  return {
    activatedAt: null,
    clientId: "client-1",
    clientName: "ГК Северный квартал",
    contractValue: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    demand: [],
    id: "project-1",
    plannedFinish: "2026-06-05",
    plannedHours: 120,
    plannedStart: "2026-06-01",
    projectTypeId: null,
    sourceOpportunityId: null,
    sourceType: "manual",
    status: "active",
    templateId: null,
    tenantId: "tenant-1",
    title: "Школа"
  };
}

function matrixWithMissingRole(): ResourceMatrixData {
  return {
    days: [
      {
        day: 1,
        today: true,
        weekdayShort: "пн",
        weekend: false
      }
    ],
    rows: [
      {
        cells: [{ kind: "zero" }],
        id: "project-resources-project-1",
        kind: "workshop",
        name: "Школа"
      },
      {
        cells: [{ kind: "zero" }],
        id: "role-missing-position-bim",
        kind: "role",
        name: "BIM-координатор",
        requiredHours: 80,
        status: "missing-role"
      }
    ],
    stats: {
      assignedHours: 0,
      capacityHours: 0,
      employees: 0,
      freeHours: 0,
      loadPct: 0
    }
  };
}
