// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectAssignments } from "./assignments-surface";

let permissions: string[] = [];
let resourceDirectoryCalls = 0;

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: {
      project: { plannedStart: "2026-07-06" },
      authored: {
        tasks: [
          {
            id: "task-1",
            parentTaskId: null,
            wbsCode: "1.1",
            title: "Задача alpha",
            durationMinutes: 480,
            workMinutes: 480
          }
        ],
        assignments: [
          {
            id: "assignment-1",
            taskId: "task-1",
            resourceId: "resource-1",
            role: "executor",
            unitsPermille: 1000,
            workMinutes: 480
          }
        ],
        assignmentAllocations: []
      },
      calculatedPlan: {
        tasks: [
          {
            id: "task-1",
            calculatedStart: "2026-07-06",
            calculatedFinish: "2026-07-07"
          }
        ]
      },
      calendars: [],
      calendarExceptions: [],
      planVersion: 1
    },
    status: "ready",
    error: null,
    reload: vi.fn(),
    apply: vi.fn()
  })
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  deriveProjectMeta: () => ({}),
  planningErr: (value: string) => value,
  useProjectBase: () => ({ name: "Project", code: "PRJ" })
}));

vi.mock("@/delivery/lib/use-resource-directory", () => ({
  useResourceDirectory: () => {
    resourceDirectoryCalls += 1;
    return {
    list: [{ id: "resource-1", name: "Resource One", positionName: "Engineer" }],
    name: () => "Resource One",
    of: () => ({ id: "resource-1", name: "Resource One", positionName: "Engineer" })
    };
  }
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

describe("assignments permission controls worker 10", () => {
  beforeEach(() => {
    permissions = [];
    resourceDirectoryCalls = 0;
  });

  it("keeps the read UI but exposes write controls only with project resources manage", async () => {
    permissions = ["tenant.project_resources.read"];
    const host = document.createElement("div");
    const root = createRoot(host);

    await act(async () => {
      root.render(<ProjectAssignments projectId="project" />);
    });

    expect(resourceDirectoryCalls).toBe(1);
    const assignmentRow = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Resource One")
    );
    expect(assignmentRow).toBeDefined();

    await act(async () => {
      assignmentRow?.click();
    });

    expect(host.textContent).toContain("Задача alpha");
    expect(host.textContent).toContain("Кривая распределения");
    expect(host.textContent).toContain("Исполнитель");
    expect(host.textContent).toContain("100%");
    expect(host.querySelector('[title="Добавить исполнителя"]')).toBeNull();
    expect(host.querySelector("select")).toBeNull();
    expect(host.querySelector('input[type="number"]')).toBeNull();
    expect(host.textContent).not.toContain("Применить кривую");
    expect(host.textContent).not.toContain("Снять исполнителя");
    expect(host.textContent).not.toContain("+ на строке задачи — добавить исполнителя");

    permissions = ["tenant.project_resources.read", "tenant.project_resources.manage"];
    await act(async () => {
      root.render(<ProjectAssignments projectId="project" />);
    });

    expect(host.querySelector('[title="Добавить исполнителя"]')).not.toBeNull();
    expect(host.querySelector("select")).not.toBeNull();
    expect(host.querySelector('input[type="number"]')).not.toBeNull();
    expect(host.textContent).toContain("Применить кривую");
    expect(host.textContent).toContain("Снять исполнителя");
    expect(host.textContent).toContain("+ на строке задачи — добавить исполнителя");

    await act(async () => {
      root.unmount();
    });
  });
});
