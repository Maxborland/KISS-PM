/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectCalendars } from "./calendars-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let permissions: string[] = [];

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/planning-runtime", () => ({
  usePlanningRuntime: () => ({ live: true, fetchImpl: null })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: {
      project: {
        calendarId: "calendar",
        plannedStart: "2026-07-01",
        plannedFinish: "2026-07-31"
      },
      calendars: [{
        id: "calendar",
        workingWeekdays: [2, 3, 4, 5, 6],
        workingMinutesPerDay: 360
      }],
      calendarExceptions: [
        {
          id: "holiday",
          calendarId: "calendar",
          resourceId: null,
          date: "2026-07-07",
          workingMinutes: 0,
          reason: "Праздник"
        },
        {
          id: "absence",
          calendarId: "calendar",
          resourceId: "resource",
          date: "2026-07-08",
          workingMinutes: 0,
          reason: "Отпуск"
        }
      ],
      authored: { tasks: [] },
      calculatedPlan: { tasks: [] },
      planVersion: 1
    },
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
  useResourceDirectory: () => {
    const resource = {
      id: "resource",
      name: "Test Resource",
      positionId: "position",
      positionName: "Engineer",
      teamId: "team",
      teamName: "Team",
      capacityMinPerDay: 480
    };
    return {
      list: [resource],
      of: (id: string) => id === resource.id ? resource : undefined
    };
  }
}));

vi.mock("@/delivery/resources/resources-editors", () => ({
  AbsenceDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

async function renderCalendars(): Promise<Root> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<ProjectCalendars projectId="project" />));
  return root;
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find((button) => button.textContent?.includes(text));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("calendar planning permissions worker 11", () => {
  beforeEach(() => {
    permissions = [];
  });

  it("matches project and resource controls to their distinct manage permissions", async () => {
    permissions = ["tenant.project_plan.read"];
    const readOnlyRoot = await renderCalendars();
    expect([...document.querySelectorAll<HTMLButtonElement>('button[title="Рабочий день"]')].some((button) => !button.disabled)).toBe(false);
    expect(document.querySelector('button[title="Снять исключение"]')).toBeNull();
    await act(async () => buttonWithText("Test Resource")?.click());
    expect(buttonWithText("Исключение")).toBeUndefined();
    expect([...document.querySelectorAll<HTMLButtonElement>('button[title="Рабочий день"]')].some((button) => !button.disabled)).toBe(false);
    await act(async () => readOnlyRoot.unmount());

    permissions = ["tenant.project_plan.read", "tenant.project_plan.manage"];
    const planManagerRoot = await renderCalendars();
    expect(document.body.textContent).toContain("Вт, Ср, Чт, Пт, Сб");
    expect(document.body.textContent).toContain("6 ч/день");
    const julyFourth = [...document.querySelectorAll<HTMLButtonElement>('button[title="Рабочий день — клик: нерабочий"]')]
      .find((button) => button.textContent?.trim().startsWith("4"));
    expect(julyFourth?.disabled).toBe(false);
    const julySixth = [...document.querySelectorAll<HTMLButtonElement>('button[title="Выходной"]')]
      .find((button) => button.textContent?.trim().startsWith("6"));
    expect(julySixth?.disabled).toBe(true);
    expect([...document.querySelectorAll<HTMLButtonElement>('button[title="Рабочий день — клик: нерабочий"]')].some((button) => !button.disabled)).toBe(true);
    expect(document.querySelector('button[title="Снять исключение"]')).not.toBeNull();
    await act(async () => buttonWithText("Test Resource")?.click());
    expect(buttonWithText("Исключение")).toBeUndefined();
    expect([...document.querySelectorAll<HTMLButtonElement>('button[title="Рабочий день"]')].some((button) => !button.disabled)).toBe(false);
    await act(async () => planManagerRoot.unmount());

    permissions = ["tenant.project_plan.read", "tenant.project_resources.manage"];
    const resourceManagerRoot = await renderCalendars();
    expect([...document.querySelectorAll<HTMLButtonElement>('button[title="Рабочий день"]')].some((button) => !button.disabled)).toBe(false);
    await act(async () => buttonWithText("Test Resource")?.click());
    expect(buttonWithText("Исключение")).toBeDefined();
    expect([...document.querySelectorAll<HTMLButtonElement>('button[title="Рабочий день — клик: нерабочий"]')].some((button) => !button.disabled)).toBe(true);
    expect(document.querySelector('button[title="Снять исключение"]')).not.toBeNull();
    await act(async () => resourceManagerRoot.unmount());

    permissions = ["tenant.project_plan.manage", "tenant.project_resources.manage"];
    const fullManagerRoot = await renderCalendars();
    expect([...document.querySelectorAll<HTMLButtonElement>('button[title="Рабочий день — клик: нерабочий"]')].some((button) => !button.disabled)).toBe(true);
    await act(async () => buttonWithText("Test Resource")?.click());
    expect(buttonWithText("Исключение")).toBeDefined();
    await act(async () => fullManagerRoot.unmount());
  });

});
