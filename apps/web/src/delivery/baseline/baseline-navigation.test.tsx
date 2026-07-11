import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectBaseline } from "./baseline-surface";

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
      project: { deadline: null },
      authored: { baselines: [], tasks: [] },
      baselineComparison: { baselineId: null, label: null, capturedAt: null, tasks: [] },
      calculatedPlan: { criticalPathTaskIds: [], projectFinish: null },
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
  useProjectBase: () => ({ name: "Project", code: "PRJ", status: "В работе" })
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

describe("baseline schedule navigation", () => {
  beforeEach(() => {
    permissions = [];
  });

  it.each([
    ["A", ["tenant.project_plan.read", "tenant.project_baselines.manage"]],
    ["PR", ["tenant.project_plan.read"]]
  ])("renders a real schedule link for the %s read profile", (_profile, profilePermissions) => {
    permissions = profilePermissions;

    const markup = renderToStaticMarkup(<ProjectBaseline projectId="project-proj-087" />);
    const window = new Window();
    window.document.body.innerHTML = markup;
    const cta = Array.from(window.document.querySelectorAll("a")).find((link) => link.textContent === "Слой в «Графике»");

    expect(cta?.getAttribute("href")).toBe("/projects/project-proj-087/schedule");
    expect(cta?.hasAttribute("disabled")).toBe(false);
    expect(cta?.getAttribute("aria-disabled")).not.toBe("true");

    window.close();
  });
});
