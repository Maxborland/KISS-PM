import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectClosureControlSurface } from "./ProjectClosureControlSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type { ProjectClosureApiClient } from "./projectClosureApiClient";

function renderClosureSurface(apiClient: ProjectClosureApiClient, currentTenant: CurrentTenantDto = currentTenantWithClose()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectClosureControlSurface
        apiClient={apiClient}
        currentTenant={currentTenant}
        projectId="project-phase9-e2e-close-a"
        testUser="project-manager-a"
      />
    </QueryClientProvider>
  );
}

function currentTenantWithClose(): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Tenant A", configurationVersion: 1 },
    actor: { id: "project-manager-a", displayName: "Руководитель проекта", accessProfileId: "profile-project-manager-a" },
    labels: {},
    permissions: ["tenant.read", "project.closure.read", "project.close", "audit.read"]
  };
}

function readonlyTenant(): CurrentTenantDto {
  return {
    ...currentTenantWithClose(),
    actor: { id: "readonly-observer-a", displayName: "Наблюдатель", accessProfileId: "profile-readonly-observer-a" },
    permissions: ["tenant.read", "project.closure.read", "audit.read"]
  };
}

function createApiClient(): ProjectClosureApiClient {
  let latestSnapshotId: string | null = null;
  const apiClient: ProjectClosureApiClient = {
    getClosure: vi.fn(async () => ({
      project: { id: "project-phase9-e2e-close-a", lifecycleStatus: latestSnapshotId === null ? "active" : "completed" },
      checklist: { requirements: [{ key: "final_kpi_summary", label: "Итог KPI", required: true }] },
      readiness: { ok: latestSnapshotId !== null, blockers: latestSnapshotId === null ? [{ code: "missing_closure_requirement" }] : [] },
      snapshots: latestSnapshotId === null ? [] : [{ id: latestSnapshotId }],
      latestSnapshot: latestSnapshotId === null ? null : { id: latestSnapshotId, metrics: { plannedWorkHours: 20 } }
    })),
    previewClosure: vi.fn(async () => ({
      preview: {
        id: "preview-closure-e2e",
        mutatesState: false as const,
        canApply: true,
        snapshotSummary: { projectId: "project-phase9-e2e-close-a", plannedWorkHours: 20, taskCount: 1, lessonCount: 1 }
      }
    })),
    applyClosure: vi.fn(async () => {
      latestSnapshotId = "snapshot-project-phase9-e2e-close-a-1";
      return {
        result: {
          snapshotId: latestSnapshotId,
          actionExecution: {
            id: "action-project-closure-e2e",
            commandType: "project.closure.apply",
            auditEventIds: ["audit-project-closure-e2e"]
          }
        }
      };
    }),
    getAudit: vi.fn(async () => ({
      events: [{ actionKey: "project.closure.apply", target: { entityId: "project-phase9-e2e-close-a" } }],
      actionExecutions: [
        {
          id: "action-project-closure-e2e",
          commandType: "project.closure.apply",
          target: { entityId: "snapshot-project-phase9-e2e-close-a-1" }
        }
      ]
    }))
  };

  return apiClient;
}

describe("ProjectClosureControlSurface", () => {
  it("previews closure before apply, applies through API readback, and shows audit evidence", async () => {
    const apiClient = createApiClient();
    renderClosureSurface(apiClient);

    await expect(screen.findByTestId("project-closure-surface")).resolves.toBeVisible();
    expect(await screen.findByTestId("project-closure-status")).toHaveTextContent("Readback закрытия получен");

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр закрытия" }));
    const preview = await screen.findByTestId("project-closure-preview");
    expect(preview).toHaveTextContent("Без мутации");
    expect(preview).toHaveTextContent("20 ч");
    expect(apiClient.applyClosure).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть проект" }));
    const result = await screen.findByTestId("project-closure-result");
    expect(result).toHaveTextContent("project.closure.apply");
    expect(result).toHaveTextContent("snapshot-project-phase9-e2e-close-a-1");
    expect(within(await screen.findByTestId("project-closure-audit")).getByText(/audit-project-closure-e2e/)).toBeVisible();

    await waitFor(() => expect(apiClient.getClosure).toHaveBeenCalledTimes(2));
  });

  it("shows read-only state and never calls mutation methods without permission", async () => {
    const apiClient = createApiClient();
    renderClosureSurface(apiClient, readonlyTenant());

    await expect(screen.findByTestId("project-closure-readonly")).resolves.toHaveTextContent("Нет права закрывать проект");
    expect(screen.queryByRole("button", { name: "Закрыть проект" })).not.toBeInTheDocument();
    expect(apiClient.previewClosure).not.toHaveBeenCalled();
    expect(apiClient.applyClosure).not.toHaveBeenCalled();
  });
});
