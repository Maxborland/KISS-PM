import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSchedule } from "./schedule-surface";

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
      project: { plannedStart: "2026-07-06" },
      authored: { assignments: [] },
      planVersion: 3
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

vi.mock("@/delivery/schedule/schedule-rows", () => ({
  mapRows: () => ({ rows: [], deadlineDay: null, projectFinishDay: 5 })
}));

vi.mock("@/delivery/lib/date-origin", () => ({
  currentPlanDate: () => "2026-07-06",
  deriveScheduleTimeline: () => ({ originDay: 0, totalDays: 7, todayOffsetDays: 0 }),
  formatWeekLabel: () => "6-12 Jul"
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

describe("schedule productivity UI", () => {
  beforeEach(() => {
    permissions = [];
  });

  it("renders real productivity controls for plan managers", () => {
    permissions = ["tenant.project_plan.read", "tenant.project_plan.manage"];

    const markup = renderToStaticMarkup(<ProjectSchedule projectId="project" />);

    expect(markup).toContain("schedule-productivity-workspace");
    expect(markup).toContain("Вставить TSV");
    expect(markup).toContain("Заполнить даты");
    expect(markup).toContain("Insert создаёт задачу");
  });

  it("does not render paste, date-fill or quick-create writes for read-only access", () => {
    permissions = ["tenant.project_plan.read"];

    const markup = renderToStaticMarkup(<ProjectSchedule projectId="project" />);

    expect(markup).not.toContain("Вставить TSV");
    expect(markup).not.toContain("Заполнить даты");
    expect(markup).not.toContain("Создать задачу (Enter");
    expect(markup).toContain("Baseline");
  });
});
