import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GanttControlSurface } from "./GanttControlSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type { Phase5ScheduleApiClient, ProjectScheduleDto } from "./phase5ScheduleApiClient";

const projectId = "project-phase4-main";

function createCurrentTenant(permissions = ["tenant.read", "project.read", "task.read", "audit.read"]): CurrentTenantDto {
  return {
    tenant: {
      id: "tenant-a",
      label: "Студия A",
      configurationVersion: 1
    },
    actor: {
      id: "project-manager-a",
      displayName: "Руководитель проекта",
      accessProfileId: "profile-project-manager-a"
    },
    labels: {},
    permissions
  };
}

function createSchedule(): ProjectScheduleDto {
  return {
    schedulePlan: {
      id: `schedule-plan-${projectId}`,
      tenantId: "tenant-a",
      projectId,
      version: 4,
      baselineId: "baseline-phase5-draft",
      status: "active",
      wbsNodes: [
        {
          id: "wbs-stage-initiation",
          tenantId: "tenant-a",
          projectId,
          stageId: `${projectId}:stage-initiation`,
          sortOrder: 10
        },
        {
          id: "wbs-task-kickoff",
          tenantId: "tenant-a",
          projectId,
          parentId: "wbs-stage-initiation",
          taskId: "task-phase5-kickoff",
          sortOrder: 20,
          schedule: {
            plannedStartDate: "2026-06-01",
            plannedFinishDate: "2026-06-03",
            durationDays: 3
          },
          plannedWorkHours: 12,
          progressPercent: 40
        }
      ],
      dependencies: []
    },
    baseline: {
      id: "baseline-phase5-draft",
      tenantId: "tenant-a",
      projectId,
      schedulePlanId: `schedule-plan-${projectId}`,
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T15:00:00.000Z",
      taskBaselineValues: [
        {
          taskId: "task-phase5-kickoff",
          plannedStartDate: "2026-06-01",
          plannedFinishDate: "2026-06-03",
          durationDays: 3,
          progressPercent: 40
        }
      ]
    },
    validationIssues: [
      {
        code: "finish_to_start_conflict",
        severity: "blocking",
        message: "Successor task starts before predecessor task finishes.",
        nodeId: "wbs-task-kickoff",
        dependencyId: "dependency-phase5",
        fieldRefs: ["plannedStartDate", "plannedFinishDate"]
      }
    ]
  };
}

function createApiClient(schedule: ProjectScheduleDto = createSchedule()): Phase5ScheduleApiClient {
  return {
    getProjectSchedule: vi.fn(async () => schedule),
    getProjectScheduleAudit: vi.fn(async () => ({
      events: [],
      actionExecutions: [
        {
          id: "action-schedule-1",
          tenantId: "tenant-a",
          actorId: "project-manager-a",
          commandType: "schedule.task.update",
          requiredPermission: "task.write",
          status: "succeeded",
          source: { entityType: "project", entityId: projectId },
          target: { entityType: "task", entityId: "task-phase5-kickoff" },
          before: null,
          after: null,
          timestamp: "2026-05-15T15:00:00.000Z",
          correlationId: "schedule-project-phase4-main-1",
          trace: ["schedule:task schedule fields updated"]
        }
      ]
    }))
  };
}

describe("Gantt control surface", () => {
  it("renders WBS schedule rows, baseline values, validation warnings, and audit evidence", async () => {
    render(
      <GanttControlSurface
        apiClient={createApiClient()}
        currentTenant={createCurrentTenant()}
        testUser="project-manager-a"
      />
    );

    expect(await screen.findByTestId("gantt-surface")).toBeInTheDocument();
    expect(screen.getByTestId("gantt-status")).toHaveTextContent("Гантт загружен");

    const row = screen.getByTestId("gantt-row-task-phase5-kickoff");
    expect(row).toHaveTextContent("task-phase5-kickoff");
    expect(row).toHaveTextContent("2026-06-01");
    expect(row).toHaveTextContent("2026-06-03");
    expect(row).toHaveTextContent("12");
    expect(row).toHaveTextContent("40");
    expect(row).toHaveTextContent("finish_to_start_conflict");
    expect(screen.getByTestId("gantt-wbs-table")).toHaveTextContent("project-phase4-main:stage-initiation");
    expect(screen.getByTestId("gantt-bars")).toHaveTextContent("task-phase5-kickoff");
    expect(screen.getByTestId("gantt-action-evidence")).toHaveTextContent("Расписание обновлено");
  });

  it("shows a denied state without calling schedule APIs when user cannot read schedule", async () => {
    const apiClient = createApiClient();

    render(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant(["tenant.read"])}
        testUser="readonly-observer-a"
      />
    );

    expect(await screen.findByTestId("gantt-denied")).toHaveTextContent("Нет доступа к Гантту");
    expect(apiClient.getProjectSchedule).not.toHaveBeenCalled();
  });

  it("opens a selected project from the portfolio entrypoint", async () => {
    const apiClient = createApiClient({
      ...createSchedule(),
      schedulePlan: {
        ...createSchedule().schedulePlan,
        projectId: "project-phase5-selected",
        wbsNodes: []
      },
      validationIssues: [],
      baseline: undefined
    });

    render(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        testUser="project-manager-a"
      />
    );

    const input = await screen.findByLabelText("ID проекта для Гантта");
    fireEvent.change(input, { target: { value: "project-phase5-selected" } });
    fireEvent.click(screen.getByRole("button", { name: "Открыть Гантт" }));

    await waitFor(() => {
      expect(apiClient.getProjectSchedule).toHaveBeenLastCalledWith("project-manager-a", "project-phase5-selected");
    });
    expect(within(screen.getByTestId("gantt-empty-state")).getByText("В расписании пока нет задач")).toBeInTheDocument();
  });

  it("renders loading and error states without showing the empty schedule message", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.getProjectSchedule).mockRejectedValueOnce(new Error("API расписания недоступен"));

    render(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        testUser="project-manager-a"
      />
    );

    expect(await screen.findByTestId("gantt-loading-state")).toHaveTextContent("Получаем WBS");
    expect(screen.queryByTestId("gantt-empty-state")).not.toBeInTheDocument();
    expect(await screen.findByTestId("gantt-error-state")).toHaveTextContent("API расписания недоступен");
    expect(screen.queryByTestId("gantt-empty-state")).not.toBeInTheDocument();
  });
});
