import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSettings } from "./settings-surface";

let permissions: string[] = [];
let calendarId: string | null = "calendar";
let calendars = [{
  id: "calendar",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
}];

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: {
      project: {
        id: "project",
        plannedStart: "2026-07-01",
        deadline: "2026-07-31",
        calendarId,
        sourceType: "manual",
        sourceOpportunityId: null
      },
      calendars,
      authored: { tasks: [] },
      calculatedPlan: { projectFinish: "2026-07-20" },
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
  planningErr: (value: string) => value,
  useProjectBase: () => ({ name: "Project", code: "PRJ" })
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

function renderSettings(projectId = "project-110") {
  return renderToStaticMarkup(<ProjectSettings projectId={projectId} />);
}

describe("settings calendar navigation", () => {
  beforeEach(() => {
    permissions = [];
    calendarId = "calendar";
    calendars = [{
      id: "calendar",
      workingWeekdays: [1, 2, 3, 4, 5],
      workingMinutesPerDay: 480
    }];
  });

  it.each([
    ["A", ["tenant.project_plan.read"]],
    ["PR", ["tenant.project_plan.read", "tenant.project_plan.manage"]]
  ])("keeps the %s read path on the real calendar and Calendars route", (_role, rolePermissions) => {
    permissions = rolePermissions;

    const markup = renderSettings();

    expect(markup).toContain("Производственный · Пн–Пт 8 ч");
    expect(markup).toContain('href="/projects/project-110/calendars"');
    expect(markup).toContain(">Открыть Календарь</a>");
  });

  it("shows the raw calendar id when the referenced calendar is missing", () => {
    calendarId = "calendar-from-import";
    calendars = [];

    expect(renderSettings()).toContain("calendar-from-import");
  });

  it("shows the no-calendar label when the project has no calendar id", () => {
    calendarId = null;
    calendars = [];

    expect(renderSettings()).toContain("— (не задан)");
  });
});
