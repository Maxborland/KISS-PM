import type { AccessProfile } from "@kiss-pm/access-control";
import type { PlanSnapshot, PlanTask, TenantUser } from "@kiss-pm/domain";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "../apiTypes";
import {
  registerPlanningBatchPreviewRoute
} from "./planningBatchPreviewRoute";
import type { PlanningRouteDeps } from "./planningRouteHelpers";

function task(id: string): PlanTask {
  return {
    id,
    parentTaskId: null,
    wbsCode: id,
    title: id,
    statusId: "task-status-new",
    schedulingMode: "auto",
    taskType: "fixed_units",
    effortDriven: false,
    plannedStart: "2026-06-01",
    plannedFinish: null,
    durationMinutes: 480,
    workMinutes: 480,
    percentComplete: 0,
    calendarId: "calendar-default",
    constraint: null
  };
}

function snapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 4,
    project: {
      id: "project-alpha",
      sourceType: "opportunity",
      sourceOpportunityId: "opp",
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: "2026-06-30",
      calendarId: "calendar-default"
    },
    tasks: [task("task-a")],
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [
      {
        id: "calendar-default",
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480
      }
    ],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}

describe("planning batch preview route", () => {
  it("previews commands cumulatively without mutating the stored snapshot", async () => {
    const stored = snapshot();
    const dataSource = {
      async getPlanSnapshot() {
        return stored;
      }
    } as unknown as ApiTenantDataSource;
    const actor = {
      id: "user-admin",
      tenantId: "tenant-alpha",
      name: "Admin",
      accessProfileId: "profile-admin"
    } as TenantUser;
    const profile = {
      id: "profile-admin",
      permissions: [
        "tenant.project_plan.read",
        "tenant.project_plan.manage"
      ]
    } as AccessProfile;
    const app = new Hono();
    registerPlanningBatchPreviewRoute(app, {
      dataSource,
      async getSessionActorFromHeaders() {
        return actor;
      },
      async getActorProfile() {
        return profile;
      },
      async runDataSourceTransaction(operation) {
        return operation(dataSource);
      },
      async appendManagementAuditEvent() {
        return "unused";
      }
    } satisfies PlanningRouteDeps);

    const response = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command-batch",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "session=test"
        },
        body: JSON.stringify({
          clientPlanVersion: 4,
          commands: [
            {
              type: "task.delete_or_archive",
              payload: { taskId: "task-a", mode: "archive" }
            },
            {
              type: "task.update_progress",
              payload: { taskId: "task-a", percentComplete: 50 }
            }
          ]
        })
      }
    );
    const body = (await response.json()) as {
      before: { authored: { tasks: PlanTask[] } };
      after: { authored: { tasks: PlanTask[] } };
      validationIssues: Array<{ code: string; severity: string }>;
      planDelta: { changedTaskIds: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.before.authored.tasks.map((item) => item.id)).toEqual(["task-a"]);
    expect(body.after.authored.tasks).toEqual([]);
    expect(body.planDelta.changedTaskIds).toEqual(["task-a"]);
    expect(body.validationIssues).toContainEqual(
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    );
    expect(stored.tasks.map((item) => item.id)).toEqual(["task-a"]);
    expect(stored.planVersion).toBe(4);
  });
});
