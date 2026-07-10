import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectResources } from "./resources-surface";

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
      project: { calendarId: "calendar" },
      calendars: [{ id: "calendar" }],
      authored: { tasks: [], assignments: [] },
      calculatedPlan: { tasks: [] },
      resourceLoad: { buckets: [] }
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
  useResourceDirectory: () => ({ list: [] })
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

vi.mock("@/delivery/resources/resource-load-matrix", () => ({
  canManageResourceControls: ({ live, permissions: keys }: { live: boolean; permissions: readonly string[] }) => !live || keys.includes("tenant.project_resources.manage"),
  ResourceLoadMatrix: ({ callbacks = {} }: { callbacks?: Record<string, unknown> }) => (
    <section>
      <span>Матрица ресурсов</span>
      {callbacks.onCreateTask ? <span>Создать задачу</span> : null}
      {callbacks.onEditTask ? <span>Редактировать задачу</span> : null}
      {callbacks.onEditAssignmentHours ? <span>Изменить часы</span> : null}
      {callbacks.onAbsence ? <span>Добавить отсутствие</span> : null}
      {callbacks.onAcceptOverload ? <span>Принять перегруз</span> : null}
    </section>
  )
}));

vi.mock("@/delivery/schedule/schedule-editors", () => ({
  TaskModal: () => <span>Редактор задачи</span>
}));

describe("resources permission controls worker 12", () => {
  beforeEach(() => {
    permissions = [];
  });

  it("keeps the resource view read-only without manage permission and exposes writes with it", () => {
    permissions = ["tenant.project_resources.read"];
    const readOnlyMarkup = renderToStaticMarkup(<ProjectResources projectId="project" />);

    expect(readOnlyMarkup).toContain("Матрица ресурсов");
    expect(readOnlyMarkup).not.toContain("Создать задачу");
    expect(readOnlyMarkup).not.toContain("Редактировать задачу");
    expect(readOnlyMarkup).not.toContain("Изменить часы");
    expect(readOnlyMarkup).not.toContain("Добавить отсутствие");
    expect(readOnlyMarkup).not.toContain("Принять перегруз");

    permissions = ["tenant.project_resources.read", "tenant.project_plan.manage"];
    const planManagerMarkup = renderToStaticMarkup(<ProjectResources projectId="project" />);
    expect(planManagerMarkup).not.toContain("Создать задачу");
    expect(planManagerMarkup).not.toContain("Редактировать задачу");
    expect(planManagerMarkup).not.toContain("Изменить часы");
    expect(planManagerMarkup).not.toContain("Добавить отсутствие");
    expect(planManagerMarkup).toContain("Принять перегруз");

    permissions = ["tenant.project_resources.read", "tenant.project_resources.manage"];
    const resourceManagerMarkup = renderToStaticMarkup(<ProjectResources projectId="project" />);
    expect(resourceManagerMarkup).not.toContain("Создать задачу");
    expect(resourceManagerMarkup).not.toContain("Редактировать задачу");
    expect(resourceManagerMarkup).toContain("Изменить часы");
    expect(resourceManagerMarkup).toContain("Добавить отсутствие");
    expect(resourceManagerMarkup).not.toContain("Принять перегруз");

    permissions = ["tenant.project_resources.read", "tenant.project_plan.manage", "tenant.project_resources.manage"];
    const managerMarkup = renderToStaticMarkup(<ProjectResources projectId="project" />);
    expect(managerMarkup).toContain("Матрица ресурсов");
    expect(managerMarkup).toContain("Создать задачу");
    expect(managerMarkup).toContain("Редактировать задачу");
    expect(managerMarkup).toContain("Изменить часы");
    expect(managerMarkup).toContain("Добавить отсутствие");
    expect(managerMarkup).toContain("Принять перегруз");
  });
});
