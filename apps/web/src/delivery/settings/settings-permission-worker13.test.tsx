import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSettings } from "./settings-surface";

let permissions: string[] = [];

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
        calendarId: "calendar",
        sourceType: "manual",
        sourceOpportunityId: null
      },
      calendars: [{
        id: "calendar",
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480
      }],
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

describe("settings planning permissions worker 13", () => {
  beforeEach(() => {
    permissions = [];
  });

  it("hides deadline write controls without project plan manage permission", () => {
    permissions = ["tenant.project_plan.read"];
    const readOnlyMarkup = renderToStaticMarkup(<ProjectSettings projectId="project" />);
    expect(readOnlyMarkup).not.toContain(">Изменить<");
    expect(readOnlyMarkup).toContain("31.07.2026");

    permissions = ["tenant.project_plan.read", "tenant.project_plan.manage"];
    const managerMarkup = renderToStaticMarkup(<ProjectSettings projectId="project" />);
    expect(managerMarkup).toContain(">Изменить<");
  });
});
