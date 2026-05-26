import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  type PostgresClient
} from "@kiss-pm/persistence";
import { createHash } from "node:crypto";

import { createApp } from "./app";
import {
  createPlanningTestTask,
  loginPlanningTestUser,
  resetPlanningRouteTestData,
  seedPlanningRouteTestData
} from "./planningTestFixture";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

describe("planning API routes", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  async function loginAs(email: string, password: string) {
    return loginPlanningTestUser(app, email, password);
  }

  async function createTask(cookie: string, input: {
    id: string;
    title: string;
    start: string;
    finish: string;
    plannedWork?: number;
  }) {
    await createPlanningTestTask(app, cookie, input);
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await resetPlanningRouteTestData(client);
    await seedPlanningRouteTestData(client);
  });

  afterAll(async () => {
    await resetPlanningRouteTestData(client);
    await client.end();
  });

  it("persists and applies auto-solver proposals through governed planning commands", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-solver-a",
      title: "Первый слот",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 8
    });
    await createTask(adminCookie, {
      id: "task-solver-b",
      title: "Второй слот",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 8
    });
    const initialRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await initialRead.json();

    const runResponse = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          mode: "schedule",
          clientPlanVersion: initialBody.planVersion,
          targetDeadline: "2026-06-02"
        })
      }
    );
    const runBody = await runResponse.json();
    expect(runResponse.status).toBe(200);
    expect(runBody).toMatchObject({
      mode: "schedule",
      clientPlanVersion: initialBody.planVersion,
      proposals: [
        expect.objectContaining({
          kind: "no_overlap",
          explainability: expect.objectContaining({ overloadMinutes: 0 })
        })
      ]
    });

    const fetchedRun = await app.request(
      `/api/workspace/projects/project-alpha/planning/auto-solver-runs/${runBody.id}`,
      { headers: { cookie: adminCookie } }
    );
    expect(fetchedRun.status).toBe(200);

    const applyResponse = await app.request(
      `/api/workspace/projects/project-alpha/planning/auto-solver-runs/${runBody.id}/proposals/${runBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: initialBody.planVersion })
      }
    );
    const applyBody = await applyResponse.json();

    expect(applyResponse.status).toBe(200);
    expect(applyBody).toMatchObject({
      solverRunId: runBody.id,
      proposalId: runBody.proposals[0].id,
      newPlanVersion: initialBody.planVersion + 1,
      readModel: {
        authored: {
          assignmentAllocations: expect.arrayContaining([
            expect.objectContaining({ taskId: "task-solver-a", date: "2026-06-01", workMinutes: 480 }),
            expect.objectContaining({ taskId: "task-solver-b", date: "2026-06-01", workMinutes: 480 })
          ])
        }
      }
    });
  });

  it("rejects stale auto-solver apply after the project plan changes", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-stale-solver-a",
      title: "Первый слот",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 8
    });
    await createTask(adminCookie, {
      id: "task-stale-solver-b",
      title: "Второй слот",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 8
    });
    const initialRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await initialRead.json();
    const runResponse = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          mode: "schedule",
          clientPlanVersion: initialBody.planVersion,
          targetDeadline: "2026-06-02"
        })
      }
    );
    const runBody = await runResponse.json();
    expect(runResponse.status).toBe(200);

    await createTask(adminCookie, {
      id: "task-stale-solver-c",
      title: "Новая задача после run",
      start: "2026-06-03",
      finish: "2026-06-03",
      plannedWork: 8
    });

    const staleApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/auto-solver-runs/${runBody.id}/proposals/${runBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: initialBody.planVersion })
      }
    );
    await expect(staleApply.json()).resolves.toMatchObject({
      error: "plan_version_conflict",
      currentPlanVersion: initialBody.planVersion + 1
    });
    expect(staleApply.status).toBe(409);
  });

  it("requires resource management permission for auto-solver allocation proposals", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const planManagerCookie = await loginAs(
      "plan-manager-reader-no-resource-manage@kiss-pm.local",
      "manager12345"
    );
    await createTask(adminCookie, {
      id: "task-resource-permission-a",
      title: "Первый слот",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 8
    });
    await createTask(adminCookie, {
      id: "task-resource-permission-b",
      title: "Второй слот",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 8
    });
    const initialRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await initialRead.json();
    const runResponse = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          mode: "schedule",
          clientPlanVersion: initialBody.planVersion,
          targetDeadline: "2026-06-02"
        })
      }
    );
    const runBody = await runResponse.json();
    expect(runResponse.status).toBe(200);

    const deniedApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/auto-solver-runs/${runBody.id}/proposals/${runBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: planManagerCookie
        },
        body: JSON.stringify({ clientPlanVersion: initialBody.planVersion })
      }
    );
    await expect(deniedApply.json()).resolves.toEqual({
      error: "permission_missing"
    });
    expect(deniedApply.status).toBe(403);
  });

  it("requires plan read permission before returning auto-solver apply read models", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const managerNoReadCookie = await loginAs("plan-resource-manager-no-read@kiss-pm.local", "manager12345");
    await createTask(adminCookie, {
      id: "task-read-gate-a",
      title: "Первый слот",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 8
    });
    await createTask(adminCookie, {
      id: "task-read-gate-b",
      title: "Второй слот",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 8
    });
    const initialRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await initialRead.json();
    const runResponse = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          mode: "schedule",
          clientPlanVersion: initialBody.planVersion,
          targetDeadline: "2026-06-02"
        })
      }
    );
    const runBody = await runResponse.json();
    expect(runResponse.status).toBe(200);

    const deniedApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/auto-solver-runs/${runBody.id}/proposals/${runBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: managerNoReadCookie
        },
        body: JSON.stringify({ clientPlanVersion: initialBody.planVersion })
      }
    );
    await expect(deniedApply.json()).resolves.toEqual({
      error: "permission_missing"
    });
    expect(deniedApply.status).toBe(403);

    const afterDeniedRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    await expect(afterDeniedRead.json()).resolves.toMatchObject({
      planVersion: initialBody.planVersion
    });
  });

  it("requires an accepted risk reason for auto-solver overload fallback proposals", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-overload-risk-a",
      title: "Первый перегруз",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 80
    });
    await createTask(adminCookie, {
      id: "task-overload-risk-b",
      title: "Второй перегруз",
      start: "2026-06-01",
      finish: "2026-06-01",
      plannedWork: 80
    });
    const initialRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await initialRead.json();
    const runResponse = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          mode: "schedule",
          clientPlanVersion: initialBody.planVersion,
          targetDeadline: "2026-06-01"
        })
      }
    );
    const runBody = await runResponse.json();
    expect(runResponse.status).toBe(200);
    expect(runBody.proposals[0]).toMatchObject({
      kind: "accepted_overload"
    });

    const applyWithoutReason = await app.request(
      `/api/workspace/projects/project-alpha/planning/auto-solver-runs/${runBody.id}/proposals/${runBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: initialBody.planVersion })
      }
    );
    await expect(applyWithoutReason.json()).resolves.toEqual({
      error: "accepted_risk_reason_required"
    });
    expect(applyWithoutReason.status).toBe(400);
  });

  it("exposes task CRUD records through planning read-model and applies dependency commands with versioned audit", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    const planOnlyReaderCookie = await loginAs("plan-reader-no-resources@kiss-pm.local", "reader12345");
    await createTask(adminCookie, {
      id: "task-plan-a",
      title: "Подготовить план",
      start: "2026-06-01",
      finish: "2026-06-03"
    });
    await createTask(adminCookie, {
      id: "task-plan-b",
      title: "Согласовать план",
      start: "2026-06-04",
      finish: "2026-06-05"
    });
    await createTask(adminCookie, {
      id: "task-plan-overload",
      title: "Перегруженная настройка",
      start: "2026-06-08",
      finish: "2026-06-08",
      plannedWork: 40
    });

    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const readerReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: readerCookie } }
    );
    const planOnlyReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: planOnlyReaderCookie } }
    );
    const initialBody = await readModel.json();

    expect(readModel.status).toBe(200);
    expect(readerReadModel.status).toBe(200);
    expect(planOnlyReadModel.status).toBe(403);
    await expect(planOnlyReadModel.json()).resolves.toEqual({ error: "permission_missing" });
    expect(initialBody).toMatchObject({
      authored: {
        tasks: expect.arrayContaining([
          expect.objectContaining({ id: "task-plan-a", title: "Подготовить план" }),
          expect.objectContaining({ id: "task-plan-b", title: "Согласовать план" })
        ]),
        dependencies: []
      },
      planVersion: 4,
      engineVersion: "planning-core-v1"
    });
    expect(initialBody.resourceLoad.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: "user-alpha-executor",
          taskIds: expect.arrayContaining(["task-plan-a"])
        })
      ])
    );

    const command = {
      type: "dependency.upsert",
      payload: {
        id: "dep-plan-a-b",
        predecessorTaskId: "task-plan-a",
        successorTaskId: "task-plan-b",
        dependencyType: "FS",
        lagMinutes: 0
      }
    };

    const preview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: initialBody.planVersion })
      }
    );
    const afterPreviewRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const previewBody = await preview.json();
    const afterPreviewBody = await afterPreviewRead.json();

    expect(preview.status).toBe(200);
    expect(previewBody.after.authored.dependencies).toEqual([
      expect.objectContaining({ id: "dep-plan-a-b", type: "FS" })
    ]);
    expect(afterPreviewBody).toMatchObject({
      authored: { dependencies: [] },
      planVersion: initialBody.planVersion
    });

    const deniedApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: readerCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: initialBody.planVersion })
      }
    );
    expect(deniedApply.status).toBe(403);
    await expect(deniedApply.json()).resolves.toEqual({ error: "permission_missing" });

    const applied = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-test-1"
        })
      }
    );
    const appliedBody = await applied.json();

    expect(applied.status).toBe(200);
    expect(appliedBody).toMatchObject({
      newPlanVersion: 5,
      auditEventId: expect.stringMatching(/^audit-/),
      readModel: {
        authored: {
          dependencies: [
            expect.objectContaining({
              id: "dep-plan-a-b",
              predecessorTaskId: "task-plan-a",
              successorTaskId: "task-plan-b"
            })
          ]
        },
        planVersion: 5
      }
    });

    const retried = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-test-1"
        })
      }
    );
    const retriedBody = await retried.json();

    expect(retried.status).toBe(200);
    expect(retriedBody).toEqual(appliedBody);

    const idempotencyConflict = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            ...command,
            payload: { ...command.payload, id: "dep-plan-a-b-conflicting-retry" }
          },
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-test-1"
        })
      }
    );

    expect(idempotencyConflict.status).toBe(409);
    await expect(idempotencyConflict.json()).resolves.toEqual({
      error: "idempotency_key_conflict"
    });

    const stale = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            ...command,
            payload: { ...command.payload, id: "dep-plan-a-b-stale" }
          },
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      error: "plan_version_conflict",
      currentPlanVersion: 5
    });

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    expect(audit.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "planning.command_denied",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-alpha" }
        }),
        expect.objectContaining({
          actionType: "planning.dependency.upserted",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-alpha" },
          afterState: expect.objectContaining({ planVersion: 5 })
        }),
        expect.objectContaining({
          actionType: "planning.command_conflict",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-alpha" }
        })
      ])
    });

    const assignmentApplied = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "assignment.upsert",
            payload: {
              id: "assignment-plan-overload",
              taskId: "task-plan-overload",
              resourceId: "user-alpha-executor",
              role: "executor",
              unitsPermille: 1000,
              workMinutes: 4_800
            }
          },
          clientPlanVersion: appliedBody.newPlanVersion
        })
      }
    );
    expect(assignmentApplied.status).toBe(200);
    const assignmentAppliedBody = await assignmentApplied.json();
    expect(assignmentAppliedBody.newPlanVersion).toBe(6);

    const overload = assignmentAppliedBody.readModel.resourceLoad.overloads.find(
      (candidate: { resourceId: string; date: string; taskIds: string[] }) =>
        candidate.resourceId === "user-alpha-executor" &&
        candidate.taskIds.includes("task-plan-overload")
    );
    expect(overload).toBeTruthy();
    expect(overload).toMatchObject({
      taskIds: expect.arrayContaining(["task-plan-overload"]),
      assignmentIds: expect.arrayContaining(["assignment-plan-overload"]),
      reasons: expect.arrayContaining([
        { type: "task", id: "task-plan-overload" },
        { type: "assignment", id: "assignment-plan-overload" }
      ])
    });

    const scenarioPreviewRequest = {
      clientPlanVersion: assignmentAppliedBody.newPlanVersion,
      target: {
        type: "resource_overload",
        resourceId: overload.resourceId,
        date: overload.date,
        overloadMinutes: overload.overloadMinutes,
        taskIds: overload.taskIds
      }
    };
    const scenarioPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const scenarioPreviewBody = await scenarioPreview.json();
    expect(scenarioPreview.status).toBe(200);
    expect(scenarioPreviewBody).toMatchObject({
      planVersion: assignmentAppliedBody.newPlanVersion,
      proposals: expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^planning-scenario-/),
          planDelta: expect.objectContaining({
            commands: expect.any(Array)
          })
        })
      ])
    });

    const deniedScenarioApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${scenarioPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: readerCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(deniedScenarioApply.status).toBe(403);
    await expect(deniedScenarioApply.json()).resolves.toEqual({ error: "permission_missing" });

    const missingRiskReasonApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${scenarioPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(missingRiskReasonApply.status).toBe(400);
    await expect(missingRiskReasonApply.json()).resolves.toEqual({
      error: "accepted_risk_reason_required"
    });

    const missingScenarioApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals/planning-scenario-missing/apply",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(missingScenarioApply.status).toBe(404);
    await expect(missingScenarioApply.json()).resolves.toEqual({
      error: "scenario_not_found"
    });

    const expiredPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const expiredPreviewBody = await expiredPreview.json();
    await client`
      UPDATE planning_scenario_runs
      SET expires_at = '2026-05-21T00:00:00.000Z'
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${expiredPreviewBody.proposals[0].id}
    `;
    const expiredApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${expiredPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(expiredApply.status).toBe(409);
    await expect(expiredApply.json()).resolves.toEqual({
      error: "scenario_expired"
    });

    const engineMismatchPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const engineMismatchPreviewBody = await engineMismatchPreview.json();
    expect(engineMismatchPreview.status).toBe(200);
    await client`
      UPDATE planning_scenario_runs
      SET engine_version = 'planning-core-v0'
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${engineMismatchPreviewBody.proposals[0].id}
    `;
    const engineMismatchApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${engineMismatchPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(engineMismatchApply.status).toBe(409);
    await expect(engineMismatchApply.json()).resolves.toMatchObject({
      error: "planning_scenario_engine_mismatch"
    });

    const targetMismatchPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const targetMismatchPreviewBody = await targetMismatchPreview.json();
    expect(targetMismatchPreview.status).toBe(200);
    const corruptedTarget = {
      type: "resource_overload",
      resourceId: overload.resourceId,
      date: overload.date,
      overloadMinutes: overload.overloadMinutes + 1,
      taskIds: overload.taskIds
    };
    await client`
      UPDATE planning_scenario_runs
      SET target_conflict = ${JSON.stringify(corruptedTarget)}::jsonb
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${targetMismatchPreviewBody.proposals[0].id}
    `;
    const targetMismatchApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${targetMismatchPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(targetMismatchApply.status).toBe(409);
    await expect(targetMismatchApply.json()).resolves.toMatchObject({
      error: "planning_scenario_target_mismatch"
    });

    const invalidCommandPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const invalidCommandPreviewBody = await invalidCommandPreview.json();
    expect(invalidCommandPreview.status).toBe(200);
    const invalidCommandProposal = {
      ...invalidCommandPreviewBody.proposals[0],
      planDelta: {
        ...invalidCommandPreviewBody.proposals[0].planDelta,
        commands: [
          {
            type: "dependency.upsert",
            payload: {
              id: "dep-scenario-self",
              predecessorTaskId: "task-plan-overload",
              successorTaskId: "task-plan-overload",
              dependencyType: "FS",
              lagMinutes: 0
            }
          }
        ],
        changedTaskIds: [],
        changedAssignmentIds: [],
        changedDependencyIds: ["dep-scenario-self"],
        acceptedRiskIds: []
      }
    };
    await client`
      UPDATE planning_scenario_runs
      SET proposal_payload = ${JSON.stringify(invalidCommandProposal)}::jsonb,
          proposal_payload_hash = ${hashJson(invalidCommandProposal)}
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${invalidCommandProposal.id}
    `;
    const invalidCommandApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${invalidCommandProposal.id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    const invalidCommandApplyBody = await invalidCommandApply.json();
    expect(invalidCommandApply.status).toBe(409);
    expect(invalidCommandApplyBody).toMatchObject({
      error: "planning_precondition_failed",
      validationIssues: [
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      ]
    });
    const invalidScenarioRows = await client`
      SELECT applied_at
      FROM planning_scenario_runs
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${invalidCommandProposal.id}
    `;
    expect(invalidScenarioRows[0]?.applied_at).toBeNull();
    const afterInvalidScenarioRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    await expect(afterInvalidScenarioRead.json()).resolves.toMatchObject({
      planVersion: assignmentAppliedBody.newPlanVersion,
      authored: {
        dependencies: [
          expect.objectContaining({
            id: "dep-plan-a-b"
          })
        ]
      }
    });

    const scenarioApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${scenarioPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          clientPlanVersion: assignmentAppliedBody.newPlanVersion,
          acceptedRiskReason: "Перегруз принят руководителем проекта до ресурсного комитета"
        })
      }
    );
    expect(scenarioApply.status).toBe(200);
    await expect(scenarioApply.json()).resolves.toMatchObject({
      scenarioRunId: scenarioPreviewBody.proposals[0].id,
      newPlanVersion: 7,
      auditEventId: expect.stringMatching(/^audit-/),
      readModel: { planVersion: 7 }
    });

    const scenarioAudit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    await expect(scenarioAudit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "planning.scenario.previewed",
          sourceWorkflow: "planning"
        }),
        expect.objectContaining({
          actionType: "planning.scenario_denied",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-alpha" }
        }),
        expect.objectContaining({
          actionType: "planning.scenario.applied",
          sourceWorkflow: "planning",
          input: expect.objectContaining({
            acceptedRiskReason: "Перегруз принят руководителем проекта до ресурсного комитета"
          }),
          afterState: expect.objectContaining({ planVersion: 7 })
        })
      ])
    });
  });

  it("returns baseline comparison in the planning read-model", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-baseline-a",
      title: "Сравнить baseline",
      start: "2026-06-02",
      finish: "2026-06-02",
      plannedWork: 8
    });

    const initialReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await initialReadModel.json();
    expect(initialReadModel.status).toBe(200);
    expect(initialBody.baselineComparison).toEqual({
      baselineId: null,
      capturedAt: null,
      tasks: []
    });

    const baselineCapture = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "baseline.capture",
            payload: {
              baselineId: "baseline-api-a",
              label: "Стартовый baseline"
            }
          },
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const baselineCaptureBody = await baselineCapture.json();
    expect(baselineCapture.status).toBe(200);

    const workUpdate = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.update_work_model",
            payload: {
              taskId: "task-baseline-a",
              taskType: "fixed_work",
              effortDriven: false,
              durationMinutes: 960,
              workMinutes: 960
            }
          },
          clientPlanVersion: baselineCaptureBody.newPlanVersion
        })
      }
    );
    const workUpdateBody = await workUpdate.json();
    expect(workUpdate.status).toBe(200);

    const finalReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const finalBody = await finalReadModel.json();

    expect(finalReadModel.status).toBe(200);
    expect(finalBody.planVersion).toBe(workUpdateBody.newPlanVersion);
    expect(finalBody.baselineComparison).toMatchObject({
      baselineId: "baseline-api-a",
      tasks: [
        expect.objectContaining({
          taskId: "task-baseline-a",
          baselineStart: "2026-06-02",
          baselineFinish: "2026-06-02",
          baselineWorkMinutes: 480,
          currentStart: "2026-06-02",
          currentFinish: "2026-06-03",
          currentWorkMinutes: 960,
          startDeltaDays: 0,
          finishDeltaDays: 1,
          workDeltaMinutes: 480
        })
      ]
    });
  });

  it("emits distinct audit actions for archived and hard-deleted planning tasks", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-archive-a",
      title: "Архивируемая задача",
      start: "2026-06-02",
      finish: "2026-06-02",
      plannedWork: 8
    });
    await createTask(adminCookie, {
      id: "task-delete-a",
      title: "Удаляемая задача",
      start: "2026-06-03",
      finish: "2026-06-03",
      plannedWork: 8
    });

    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await readModel.json();
    expect(readModel.status).toBe(200);

    const archiveApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.delete_or_archive",
            payload: { taskId: "task-archive-a", mode: "archive" }
          },
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const archiveBody = await archiveApply.json();
    expect(archiveApply.status).toBe(200);

    const deleteApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.delete_or_archive",
            payload: { taskId: "task-delete-a", mode: "delete" }
          },
          clientPlanVersion: archiveBody.newPlanVersion
        })
      }
    );
    expect(deleteApply.status).toBe(200);

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    expect(audit.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "planning.task.archived",
          input: expect.objectContaining({
            command: expect.objectContaining({
              payload: expect.objectContaining({ taskId: "task-archive-a", mode: "archive" })
            })
          })
        }),
        expect.objectContaining({
          actionType: "planning.task.deleted",
          input: expect.objectContaining({
            command: expect.objectContaining({
              payload: expect.objectContaining({ taskId: "task-delete-a", mode: "delete" })
            })
          })
        })
      ])
    });
  });

  it("requires plan read permission before returning command preview read models", async () => {
    const managerWithoutReadCookie = await loginAs(
      "plan-manager-no-read@kiss-pm.local",
      "manager12345"
    );

    const preview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: managerWithoutReadCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.update_identity",
            payload: {
              taskId: "task-plan-a",
              title: "Не должно раскрыть модель"
            }
          },
          clientPlanVersion: 1
        })
      }
    );
    const body = await preview.json();

    expect(preview.status).toBe(403);
    expect(body).toMatchObject({
      error: "permission_missing",
      permissionPreview: {
        allowed: false,
        reason: "permission_missing"
      }
    });
    expect(body.before).toBeUndefined();
    expect(body.after).toBeUndefined();
  });

  it("requires plan read permission before returning apply and scenario planning details", async () => {
    const managerWithoutReadCookie = await loginAs(
      "plan-manager-no-read@kiss-pm.local",
      "manager12345"
    );
    const scenarioOperatorWithoutReadCookie = await loginAs(
      "scenario-no-read@kiss-pm.local",
      "scenario12345"
    );

    const applyCommand = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: managerWithoutReadCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.update_identity",
            payload: {
              taskId: "task-plan-a",
              title: "Не должно примениться без чтения"
            }
          },
          clientPlanVersion: 1
        })
      }
    );
    const applyCommandBody = await applyCommand.json();
    expect(applyCommand.status).toBe(403);
    expect(applyCommandBody).toEqual({ error: "permission_missing" });
    expect(applyCommandBody.readModel).toBeUndefined();

    const scenarioPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: scenarioOperatorWithoutReadCookie
        },
        body: JSON.stringify({
          clientPlanVersion: 1,
          target: {
            type: "resource_overload",
            resourceId: "user-alpha-executor",
            date: "2026-06-01",
            overloadMinutes: 60,
            taskIds: ["task-plan-a"]
          }
        })
      }
    );
    const scenarioPreviewBody = await scenarioPreview.json();
    expect(scenarioPreview.status).toBe(403);
    expect(scenarioPreviewBody).toMatchObject({
      error: "permission_missing",
      permissionPreview: {
        allowed: false,
        reason: "permission_missing"
      }
    });
    expect(scenarioPreviewBody.proposals).toBeUndefined();

    const scenarioApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals/planning-scenario-missing/apply",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: scenarioOperatorWithoutReadCookie
        },
        body: JSON.stringify({ clientPlanVersion: 1 })
      }
    );
    const scenarioApplyBody = await scenarioApply.json();
    expect(scenarioApply.status).toBe(403);
    expect(scenarioApplyBody).toEqual({ error: "permission_missing" });
    expect(scenarioApplyBody.readModel).toBeUndefined();
  });

  it("returns planning validation errors for invalid commands without mutating plan state", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-plan-a",
      title: "Подготовить план",
      start: "2026-06-01",
      finish: "2026-06-03"
    });
    await createTask(adminCookie, {
      id: "task-plan-b",
      title: "Согласовать план",
      start: "2026-06-04",
      finish: "2026-06-05"
    });

    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await readModel.json();
    expect(readModel.status).toBe(200);
    expect(initialBody).toMatchObject({
      authored: { dependencies: [] },
      planVersion: 3
    });

    const invalidCommand = {
      type: "dependency.upsert",
      payload: {
        id: "dep-self",
        predecessorTaskId: "task-plan-a",
        successorTaskId: "task-plan-a",
        dependencyType: "FS",
        lagMinutes: 0
      }
    };

    const preview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: invalidCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const previewBody = await preview.json();

    expect(preview.status).toBe(200);
    expect(previewBody).toMatchObject({
      after: {
        authored: { dependencies: [] },
        planVersion: initialBody.planVersion
      },
      auditPreview: {
        planVersionBefore: initialBody.planVersion,
        planVersionAfter: initialBody.planVersion
      },
      validationIssues: [
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      ]
    });

    const apply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: invalidCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const applyBody = await apply.json();

    expect(apply.status).toBe(409);
    expect(applyBody).toMatchObject({
      error: "planning_precondition_failed",
      validationIssues: [
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      ]
    });

    const afterApplyRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const afterApplyBody = await afterApplyRead.json();
    expect(afterApplyBody).toMatchObject({
      authored: { dependencies: [] },
      planVersion: initialBody.planVersion
    });

    const invalidStatusCommand = {
      type: "task.update_status",
      payload: {
        taskId: "task-plan-a",
        statusId: "task-status-missing"
      }
    };
    const invalidStatusPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: invalidStatusCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const invalidStatusPreviewBody = await invalidStatusPreview.json();
    expect(invalidStatusPreview.status).toBe(200);
    expect(invalidStatusPreviewBody.validationIssues).toEqual([
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    ]);

    const invalidStatusApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: invalidStatusCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const invalidStatusApplyBody = await invalidStatusApply.json();
    expect(invalidStatusApply.status).toBe(409);
    expect(invalidStatusApplyBody).toMatchObject({
      error: "planning_precondition_failed",
      validationIssues: [
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      ]
    });

    await client`
      UPDATE tenant_users
      SET status = 'inactive'
      WHERE tenant_id = 'tenant-alpha'
        AND id = 'user-alpha-executor'
    `;
    const inactiveResourceCommand = {
      type: "assignment.upsert",
      payload: {
        id: "assignment-inactive-resource",
        taskId: "task-plan-a",
        resourceId: "user-alpha-executor",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480
      }
    };
    const inactiveResourcePreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: inactiveResourceCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const inactiveResourcePreviewBody = await inactiveResourcePreview.json();
    expect(inactiveResourcePreview.status).toBe(200);
    expect(inactiveResourcePreviewBody.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    ]));

    const inactiveResourceApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: inactiveResourceCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const inactiveResourceApplyBody = await inactiveResourceApply.json();
    expect(inactiveResourceApply.status).toBe(409);
    expect(inactiveResourceApplyBody).toMatchObject({
      error: "planning_precondition_failed"
    });
    expect(inactiveResourceApplyBody.validationIssues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
    ]));

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    const auditBody = await audit.json();
    expect(audit.status).toBe(200);
    expect(
      auditBody.auditEvents.some(
        (event: { actionType: string; sourceWorkflow: string }) =>
          event.actionType === "planning.dependency.upserted" &&
          event.sourceWorkflow === "planning"
      )
    ).toBe(false);
  });
});

function hashJson(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
