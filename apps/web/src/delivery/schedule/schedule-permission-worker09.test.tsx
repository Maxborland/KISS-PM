import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  canManageScheduleResourceControls,
  ProjectSchedule
} from "./schedule-surface";

let permissions: string[] = [];

// SSE-подписка плана: в юнитах не открываем EventSource (happy-dom полез бы в сеть) — noop-подписка
vi.mock("@kiss-pm/planning-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  subscribeToPlanEvents: () => ({ unsubscribe() {} })
}));

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/planning-runtime", () => ({
  usePlanningRuntime: () => ({ live: true, fetchImpl: null })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: {
      project: { plannedStart: "2026-07-06" },
      authored: { assignments: [] },
      planVersion: 1
    },
    setReadModel: vi.fn(),
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
  useResourceDirectory: () => ({ name: (id: string) => id, list: [] })
}));

vi.mock("@/delivery/lib/use-pointer-drag", () => ({
  usePointerDrag: () => ({ state: null, begin: vi.fn() })
}));

// Непустой план: SSR-markup обязан содержать строки — пин честной серверной
// отрисовки окна виртуализации через VIRTUAL_INITIAL_RECT (см. virtual-rows.ts).
vi.mock("@/delivery/schedule/schedule-rows", () => ({
  mapRows: () => ({
    rows: [{
      id: "task-ssr-1",
      wbs: "1",
      name: "Задача SSR",
      level: 0,
      kind: "task",
      hasChildren: false,
      mode: "auto",
      parentId: null,
      durDays: 5,
      durationMinutes: 2_400,
      pct: 0,
      startIso: "2026-07-06",
      finishIso: "2026-07-10",
      predDisplay: "",
      predList: [],
      res: "",
      workH: 40,
      slackDays: 0,
      dayStart: 0,
      dayDur: 5,
      critical: false,
      warning: false,
      effectiveCalendarId: null,
      workingMinutesPerDay: 480
    }],
    deadlineDay: null,
    projectFinishDay: 5
  })
}));

vi.mock("@/delivery/lib/date-origin", () => ({
  currentPlanDate: () => "2026-07-06",
  deriveScheduleTimeline: () => ({ originDay: 0, totalDays: 7, todayOffsetDays: 0 }),
  formatWeekLabel: () => "6-12 Jul"
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

describe("schedule permission controls worker 09", () => {
  beforeEach(() => {
    permissions = [];
  });

  it("hides write controls for read-only plan access and keeps them for manage access", () => {
    permissions = ["tenant.project_plan.read"];
    const readOnlyMarkup = renderToStaticMarkup(<ProjectSchedule projectId="project" />);

    expect(readOnlyMarkup).not.toContain(">Пакет<");
    expect(readOnlyMarkup).not.toContain("Новая задача — Enter");
    expect(readOnlyMarkup).toContain("Baseline");
    // SSR не пустой: окно виртуализации рендерит строки на сервере (VIRTUAL_INITIAL_RECT)
    expect(readOnlyMarkup).toContain("data-schedule-row-id");

    permissions = ["tenant.project_plan.read", "tenant.project_plan.manage"];
    const managerMarkup = renderToStaticMarkup(<ProjectSchedule projectId="project" />);

    expect(managerMarkup).toContain(">Пакет<");
    expect(managerMarkup).toContain("Новая задача — Enter");
    expect(managerMarkup).toContain("data-schedule-row-id");
  });

  it("requires resource-manage permission for resource controls in live mode", () => {
    expect(canManageScheduleResourceControls({
      live: true,
      permissions: ["tenant.project_plan.manage"]
    })).toBe(false);
    expect(canManageScheduleResourceControls({
      live: true,
      permissions: ["tenant.project_plan.manage", "tenant.project_resources.manage"]
    })).toBe(true);
  });
});
