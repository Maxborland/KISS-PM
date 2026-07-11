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

describe("baseline permission controls", () => {
  beforeEach(() => {
    permissions = [];
  });

  it("shows capture controls only with project baselines manage", () => {
    permissions = ["tenant.project_plan.read"];
    const readOnlyMarkup = renderToStaticMarkup(<ProjectBaseline projectId="project" />);

    expect(readOnlyMarkup).toContain("Базовый план");
    expect(readOnlyMarkup).not.toContain("Зафиксировать базовый план");

    permissions = ["tenant.project_plan.read", "tenant.project_baselines.manage"];
    const managerMarkup = renderToStaticMarkup(<ProjectBaseline projectId="project" />);

    expect(managerMarkup).toContain("Зафиксировать базовый план");
  });
});
