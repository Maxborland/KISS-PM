/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectCalendars } from "./calendars-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const harness = vi.hoisted(() => ({
  permissions: [] as string[],
  readModel: null as Record<string, unknown> | null
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>
}));

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions: harness.permissions })
}));

vi.mock("@/delivery/lib/planning-runtime", () => ({
  usePlanningRuntime: () => ({ live: true, fetchImpl: null })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: harness.readModel,
    status: "ready",
    error: null,
    reload: vi.fn(),
    apply: vi.fn(),
    applyBatch: vi.fn()
  })
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  deriveProjectMeta: () => ({}),
  planningErr: (value: string) => value,
  useProjectBase: () => ({ name: "Project", code: "PRJ" })
}));

vi.mock("@/delivery/lib/use-resource-directory", () => ({
  useResourceDirectory: () => ({ list: [], of: () => undefined })
}));

vi.mock("@/delivery/resources/resources-editors", () => ({
  AbsenceDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

function conflictReadModel(calculatedDates: Array<{ start: string | null; finish: string | null }>) {
  const tasks = calculatedDates.map((_, index) => ({
    id: `task-${index + 1}`,
    wbsCode: `1.${index + 1}`,
    title: `Task ${index + 1}`,
    durationMinutes: 480
  }));

  return {
    project: {
      calendarId: "calendar",
      plannedStart: "2026-07-01",
      plannedFinish: "2026-07-31"
    },
    calendars: [{
      id: "calendar",
      workingWeekdays: [1, 2, 3, 4, 5],
      workingMinutesPerDay: 480
    }],
    calendarExceptions: [{
      id: "holiday",
      calendarId: "calendar",
      resourceId: null,
      date: "2026-07-06",
      workingMinutes: 0,
      reason: "Holiday"
    }],
    authored: { tasks },
    calculatedPlan: {
      tasks: tasks.map((task, index) => ({
        id: task.id,
        calculatedStart: calculatedDates[index]!.start,
        calculatedFinish: calculatedDates[index]!.finish
      }))
    },
    planVersion: 1
  };
}

let root: Root | null = null;

async function renderCalendars(projectId = "project-alpha") {
  if (!root) {
    const container = document.body.appendChild(document.createElement("div"));
    root = createRoot(container);
  }
  await act(async () => root!.render(<ProjectCalendars projectId={projectId} />));
}

beforeEach(() => {
  harness.permissions = [];
  harness.readModel = conflictReadModel([]);
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  document.body.replaceChildren();
});

describe.each([
  ["A", ["tenant.project_plan.manage", "tenant.project_resources.manage"]],
  ["PR", ["tenant.project_plan.read"]]
])("ProjectCalendars conflict navigation for %s", (_role, permissions) => {
  it("links the real conflict banner to Schedule and preserves the remaining count", async () => {
    harness.permissions = permissions;
    harness.readModel = conflictReadModel([
      { start: "2026-07-06", finish: "2026-07-06" },
      { start: "2026-07-05", finish: "2026-07-07" }
    ]);

    await renderCalendars();

    expect(document.body.textContent).toContain("Конфликт с расписанием");
    expect(document.body.textContent).toContain("И ещё 1.");
    const scheduleLink = [...document.querySelectorAll<HTMLAnchorElement>("a")]
      .find((link) => link.textContent === "Открыть График");
    expect(scheduleLink?.getAttribute("href")).toBe("/projects/project-alpha/schedule");
  });

  it("starts at the live horizon and resets only when the project horizon changes", async () => {
    harness.permissions = permissions;
    const first = conflictReadModel([{ start: "2026-05-12", finish: "2026-08-02" }]);
    first.project.plannedStart = "2026-06-01";
    first.project.plannedFinish = "2026-07-31";
    harness.readModel = first;

    await renderCalendars();

    const monthLabel = document.querySelector<HTMLElement>('[data-testid="calendar-month-label"]');
    const previous = document.querySelector<HTMLButtonElement>('button[aria-label="Предыдущий месяц"]');
    const next = document.querySelector<HTMLButtonElement>('button[aria-label="Следующий месяц"]');
    expect(monthLabel?.dataset.monthKey).toBe("2026-05");
    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);

    await act(async () => next!.click());
    expect(monthLabel?.dataset.monthKey).toBe("2026-06");

    const second = conflictReadModel([{ start: "2026-09-10", finish: "2026-11-03" }]);
    second.project.plannedStart = "2026-10-01";
    second.project.plannedFinish = "2026-10-31";
    harness.readModel = second;
    await renderCalendars("project-beta");

    expect(monthLabel?.dataset.monthKey).toBe("2026-09");
    expect(previous?.disabled).toBe(true);
  });
});

it("does not render a conflict CTA when calculated task dates are unavailable", async () => {
  harness.permissions = ["tenant.project_plan.read"];
  harness.readModel = conflictReadModel([{ start: null, finish: null }]);

  await renderCalendars();

  expect(document.body.textContent).not.toContain("Конфликт с расписанием");
  expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Открыть График")).toBe(false);
});
