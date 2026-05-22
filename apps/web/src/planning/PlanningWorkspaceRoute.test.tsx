import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlanningWorkspaceRoute } from "./PlanningWorkspaceRoute";
import { createPlanningReadModelFixture } from "./planningReadModel.test-utils";

const queryMocks = vi.hoisted(() => ({
  readModelResult: {
    data: null as unknown,
    isFetching: false,
    error: null as unknown,
    refetch: vi.fn()
  },
  previewMutateAsync: vi.fn(),
  applyMutateAsync: vi.fn(),
  previewPending: false,
  applyPending: false
}));

vi.mock("./planningQueries", () => ({
  usePlanningReadModelQuery: () => queryMocks.readModelResult,
  usePlanningCommandMutations: () => ({
    previewCommand: {
      mutateAsync: queryMocks.previewMutateAsync,
      isPending: queryMocks.previewPending
    },
    applyCommand: {
      mutateAsync: queryMocks.applyMutateAsync,
      isPending: queryMocks.applyPending
    }
  })
}));

describe("PlanningWorkspaceRoute", () => {
  beforeEach(() => {
    queryMocks.readModelResult = {
      data: createPlanningReadModelFixture(),
      isFetching: false,
      error: null,
      refetch: vi.fn()
    };
    queryMocks.previewPending = false;
    queryMocks.applyPending = false;
    queryMocks.previewMutateAsync.mockReset();
    queryMocks.applyMutateAsync.mockReset();
  });

  it("renders planning read model, WBS/Gantt surface and resource summary for permitted users", () => {
    const html = renderToStaticMarkup(
      <PlanningWorkspaceRoute
        projectId="project-alpha"
        permissions={[
          "tenant.projects.read",
          "tenant.project_plan.read",
          "tenant.project_plan.manage",
          "tenant.project_resources.read",
          "tenant.project_baselines.manage"
        ]}
        taskStatuses={[activeTaskStatus]}
        sectionState={{ canRead: true, isLoading: false, error: null }}
        onChanged={() => undefined}
      />
    );

    expect(html).toContain("График проекта");
    expect(html).toContain("data-plan-version=\"3\"");
    expect(html).toContain("data-task-id=\"task-a\"");
    expect(html).toContain("planning-core-v1");
    expect(html).toContain("Инспектор задачи");
    expect(html).toContain("Preview work model");
    expect(html).toContain("Ресурсная загрузка");
    expect(html).toContain("resource-alpha");
  });

  it("keeps the workspace closed without resource read permission", () => {
    const html = renderToStaticMarkup(
      <PlanningWorkspaceRoute
        projectId="project-alpha"
        permissions={[
          "tenant.projects.read",
          "tenant.project_plan.read"
        ]}
        taskStatuses={[activeTaskStatus]}
        sectionState={{ canRead: true, isLoading: false, error: null }}
        onChanged={() => undefined}
      />
    );

    expect(html).toContain("Нужно право tenant.project_resources.read");
    expect(html).not.toContain("data-plan-version");
  });
});

const activeTaskStatus = {
  id: "task-status-active",
  tenantId: "tenant-alpha",
  name: "В работе",
  category: "in_progress" as const,
  sortOrder: 10,
  status: "active" as const,
  isSystem: true,
  createdAt: "2026-05-22T00:00:00.000Z",
  updatedAt: "2026-05-22T00:00:00.000Z"
};
