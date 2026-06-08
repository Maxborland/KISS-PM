import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { PlanSnapshot } from "@kiss-pm/domain";
import type { ApiTenantDataSource } from "./apiTypes";
import { createApp } from "./app";

describe("planning scenario proposal API", () => {
  it("rechecks active project state after acquiring the planning lock before persisting scenario proposals", async () => {
    const permissions: AccessProfile["permissions"] = [
      "tenant.project_plan.read",
      "tenant.planning_scenarios.preview"
    ];
    let projectStatus: "active" | "paused" = "active";
    let planningLockHeld = false;
    let getPlanSnapshotCalled = false;
    let createScenarioRunCount = 0;
    const auditActionTypes: string[] = [];

    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-scenario"
          ? {
              id: "user-scenario",
              tenantId: "tenant-scenario",
              name: "Scenario Planner",
              accessProfileId: "scenario-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-scenario" ? { id: tenantId, name: "Scenario Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "scenario-profile",
          permissions
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-scenario",
          tenantId: "tenant-scenario",
          userId: "user-scenario",
          tokenHash: "ignored",
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async lockTenantResourcePlanning() {
        planningLockHeld = true;
        projectStatus = "paused";
      },
      async listProjects() {
        return [
          {
            id: "project-scenario",
            tenantId: "tenant-scenario",
            sourceType: "manual",
            sourceOpportunityId: null,
            clientId: null,
            projectTypeId: null,
            title: "Scenario Project",
            clientName: "Scenario Client",
            status: projectStatus,
            plannedStart: new Date("2026-06-01T00:00:00.000Z"),
            plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
            contractValue: 0,
            plannedHours: 0,
            templateId: null,
            createdAt: new Date("2026-05-24T00:00:00.000Z"),
            activatedAt: new Date("2026-05-24T00:00:00.000Z"),
            closedAt: null,
            demand: []
          }
        ];
      },
      async getPlanSnapshot() {
        getPlanSnapshotCalled = true;
        return createSnapshot();
      },
      async createPlanningScenarioRun() {
        createScenarioRunCount += 1;
        throw new Error("scenario_run_should_not_be_created");
      },
      async appendAuditEvent(auditInput) {
        auditActionTypes.push(auditInput.actionType);
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request(
      "/api/workspace/projects/project-scenario/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        },
        body: JSON.stringify({
          clientPlanVersion: 3,
          target: {
            type: "resource_overload",
            resourceId: "resource-alpha",
            date: "2026-06-01",
            overloadMinutes: 60,
            taskIds: ["task-alpha"]
          }
        })
      }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("project_not_found");
    expect(planningLockHeld).toBe(true);
    expect(getPlanSnapshotCalled).toBe(false);
    expect(createScenarioRunCount).toBe(0);
    expect(auditActionTypes).toEqual([]);
  });
});

function createSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-scenario",
    projectId: "project-scenario",
    planVersion: 3,
    project: {
      id: "project-scenario",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-05",
      deadline: "2026-06-01",
      calendarId: "calendar-default"
    },
    tasks: [
      {
        id: "task-alpha",
        parentTaskId: null,
        wbsCode: "1",
        title: "Task",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: null,
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 0,
        calendarId: "calendar-default",
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assignment-alpha",
        taskId: "task-alpha",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }
    ],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [
      {
        id: "resource-alpha",
        userId: "resource-alpha",
        positionId: "position-engineer",
        teamId: null,
        name: "Alpha",
        calendarId: "calendar-default"
      }
    ],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-24T00:00:00.000Z"
  };
}
