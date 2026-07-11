/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectCalendars } from "./calendars-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const absenceCapture = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
const planningCapture = vi.hoisted(() => ({ applyBatch: vi.fn() }));
const toastCapture = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const liveResources = [
  {
    id: "live-one",
    name: "Live One",
    positionId: "engineer",
    positionName: "Engineer",
    teamId: "delivery",
    teamName: "Delivery",
    capacityMinPerDay: 480
  },
  {
    id: "live-two",
    name: "Live Two",
    positionId: "analyst",
    positionName: "Analyst",
    teamId: "delivery",
    teamName: "Delivery",
    capacityMinPerDay: 480
  }
];

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ permissions: ["tenant.project_resources.manage"] })
}));

vi.mock("@/delivery/lib/planning-runtime", () => ({
  usePlanningRuntime: () => ({ live: true, fetchImpl: null })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: {
      project: {
        calendarId: "calendar",
        plannedStart: "2026-07-10",
        plannedFinish: "2026-08-03"
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
        date: "2026-07-13",
        workingMinutes: 0,
        reason: "Праздник"
      }],
      authored: { tasks: [] },
      calculatedPlan: { tasks: [] },
      planVersion: 1
    },
    status: "ready",
    error: null,
    reload: vi.fn(),
    apply: vi.fn(),
    applyBatch: planningCapture.applyBatch
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
    list: liveResources,
    of: (id: string) => liveResources.find((resource) => resource.id === id)
  })
}));

vi.mock("@/delivery/resources/resources-editors", () => ({
  AbsenceDialog: (props: Record<string, unknown> & { children: React.ReactNode }) => {
    absenceCapture.props = props;
    return <>{props.children}</>;
  }
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));
vi.mock("sonner", () => ({ toast: toastCapture }));

function buttonWithText(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.includes(text));
}

afterEach(() => {
  absenceCapture.props = null;
  planningCapture.applyBatch.mockReset();
  toastCapture.error.mockReset();
  toastCapture.success.mockReset();
  document.body.replaceChildren();
});

describe("ProjectCalendars absence dialog", () => {
  it("passes the live directory, selected resource and focused project dates", async () => {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(<ProjectCalendars projectId="project" />));

    await act(async () => buttonWithText("Live Two")!.click());
    expect(absenceCapture.props).toMatchObject({
      resources: liveResources,
      initialResourceId: "live-two",
      initialStart: "2026-07-10",
      initialFinish: "2026-07-14"
    });

    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Следующий месяц"]')!.click());
    expect(absenceCapture.props).toMatchObject({
      resources: liveResources,
      initialResourceId: "live-two",
      initialStart: "2026-08-01",
      initialFinish: "2026-08-03"
    });
  });

  it("keeps only working non-holiday dates in a mixed absence range", async () => {
    planningCapture.applyBatch.mockResolvedValue({ ok: true, planVersion: 2 });
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(<ProjectCalendars projectId="project" />));

    await act(async () => buttonWithText("Live Two")!.click());
    const submit = absenceCapture.props?.onSubmit as (
      resourceId: string,
      typeLabel: string,
      start: string,
      finish: string
    ) => Promise<void>;
    await act(async () => submit("live-two", "Отпуск", "2026-07-10", "2026-07-14"));

    expect(planningCapture.applyBatch).toHaveBeenCalledTimes(1);
    const commands = planningCapture.applyBatch.mock.calls[0]![0] as Array<{
      type: string;
      payload: { resourceId: string; date: string };
    }>;
    expect(commands.map((command) => command.payload.date)).toEqual([
      "2026-07-10",
      "2026-07-14"
    ]);
    expect(commands.every((command) =>
      command.type === "calendar.exception.upsert" &&
      command.payload.resourceId === "live-two"
    )).toBe(true);
  });  it("explains a fully non-working range without opening preview or applying a batch", async () => {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(<ProjectCalendars projectId="project" />));

    await act(async () => buttonWithText("Live Two")!.click());
    const submit = absenceCapture.props?.onSubmit as (
      resourceId: string,
      typeLabel: string,
      start: string,
      finish: string
    ) => Promise<void>;
    await act(async () => submit("live-two", "Отпуск", "2026-07-11", "2026-07-12"));

    expect(planningCapture.applyBatch).not.toHaveBeenCalled();
    expect(toastCapture.error).toHaveBeenCalledWith(
      "В выбранном диапазоне нет рабочих дней"
    );
  });
});
