import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

async function createDraft(app: ReturnType<typeof createApiApp>, testUser = "project-manager-a") {
  const response = await app.request(
    `/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=${testUser}`,
    jsonRequest({})
  );
  if (response.status === 409) {
    return "project-draft-opportunity-seed-ready";
  }
  expect(response.status).toBe(201);
  const body = (await readJson(response)) as { projectDraft: { id: string } };

  return body.projectDraft.id;
}

async function createManagedProject(app: ReturnType<typeof createApiApp>, projectId = "project-phase5-main") {
  const projectDraftId = await createDraft(app);
  const response = await app.request(
    "/api/projects/from-template?testUser=project-manager-a",
    jsonRequest({ projectDraftId, projectId })
  );
  expect(response.status).toBe(201);
  const body = (await readJson(response)) as {
    project: {
      id: string;
      tenantId: string;
      currentStageId: string;
    };
  };

  return body.project;
}

async function createScheduleTask(
  app: ReturnType<typeof createApiApp>,
  projectId: string,
  input: {
    id: string;
    stageId: string;
    taskTemplateId: string;
    taskTemplateKey: string;
    plannedStartDate: string;
    plannedFinishDate: string;
    plannedWorkHours: number;
    progressPercent: number;
  }
) {
  const response = await app.request(
    `/api/projects/${projectId}/schedule/tasks?testUser=project-manager-a`,
    jsonRequest(input)
  );
  expect(response.status).toBe(201);

  return (await readJson(response)) as {
    task: { id: string; projectId: string };
    schedulePlan: {
      wbsNodes: Array<{
        id: string;
        taskId?: string;
        schedule?: { plannedStartDate?: string; plannedFinishDate?: string; durationDays?: number };
        plannedWorkHours?: number;
        progressPercent?: number;
      }>;
    };
    actionExecution: { commandType: string; target?: { entityType: string; entityId: string } };
  };
}

describe("Phase 5 schedule and Gantt API", () => {
  it("reads schedule, creates canonical tasks, updates fields, creates dependencies, captures baseline, and exposes audit", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const project = await createManagedProject(app);

    const emptySchedule = await app.request(`/api/projects/${project.id}/schedule?testUser=project-manager-a`);
    expect(emptySchedule.status).toBe(200);
    await expect(readJson(emptySchedule)).resolves.toMatchObject({
      schedulePlan: {
        id: `schedule-plan-${project.id}`,
        projectId: project.id,
        wbsNodes: expect.arrayContaining([expect.objectContaining({ stageId: project.currentStageId })])
      },
      validationIssues: []
    });

    const kickoff = await createScheduleTask(app, project.id, {
      id: "task-phase5-kickoff",
      stageId: project.currentStageId,
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      plannedWorkHours: 12,
      progressPercent: 20
    });
    expect(kickoff).toMatchObject({
      task: { id: "task-phase5-kickoff", projectId: project.id },
      actionExecution: {
        commandType: "schedule.task.create",
        target: { entityType: "task", entityId: "task-phase5-kickoff" }
      }
    });
    expect(kickoff.schedulePlan.wbsNodes).toContainEqual(
      expect.objectContaining({
        taskId: "task-phase5-kickoff",
        schedule: {
          plannedStartDate: "2026-06-01",
          plannedFinishDate: "2026-06-03",
          durationDays: 3
        },
        plannedWorkHours: 12,
        progressPercent: 20
      })
    );

    await createScheduleTask(app, project.id, {
      id: "task-phase5-delivery",
      stageId: `${project.id}:stage-delivery`,
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-04",
      plannedFinishDate: "2026-06-08",
      plannedWorkHours: 24,
      progressPercent: 0
    });

    const update = await app.request(
      `/api/projects/${project.id}/schedule/tasks/task-phase5-kickoff?testUser=project-manager-a`,
      jsonRequest(
        {
          plannedStartDate: "2026-06-02",
          plannedFinishDate: "2026-06-04",
          plannedWorkHours: 14,
          progressPercent: 40
        },
        "PATCH"
      )
    );
    expect(update.status).toBe(200);
    await expect(readJson(update)).resolves.toMatchObject({
      task: { id: "task-phase5-kickoff", dueDate: "2026-06-04", plannedWorkHours: 14 },
      schedulePlan: {
        wbsNodes: expect.arrayContaining([
          expect.objectContaining({
            taskId: "task-phase5-kickoff",
            schedule: {
              plannedStartDate: "2026-06-02",
              plannedFinishDate: "2026-06-04",
              durationDays: 3
            },
            plannedWorkHours: 14,
            progressPercent: 40
          })
        ])
      },
      validationIssues: []
    });

    const dependency = await app.request(
      `/api/projects/${project.id}/schedule/dependencies?testUser=project-manager-a`,
      jsonRequest({
        id: "dependency-phase5-kickoff-delivery",
        predecessorTaskId: "task-phase5-kickoff",
        successorTaskId: "task-phase5-delivery",
        type: "finish_to_start"
      })
    );
    expect(dependency.status).toBe(201);
    await expect(readJson(dependency)).resolves.toMatchObject({
      dependency: {
        id: "dependency-phase5-kickoff-delivery",
        predecessorTaskId: "task-phase5-kickoff",
        successorTaskId: "task-phase5-delivery",
        type: "finish_to_start"
      },
      validationIssues: []
    });

    const baseline = await app.request(
      `/api/projects/${project.id}/schedule/baseline?testUser=project-manager-a`,
      jsonRequest({ id: "baseline-phase5-draft" })
    );
    expect(baseline.status).toBe(201);
    await expect(readJson(baseline)).resolves.toMatchObject({
      baseline: {
        id: "baseline-phase5-draft",
        schedulePlanId: `schedule-plan-${project.id}`,
        taskBaselineValues: expect.arrayContaining([
          expect.objectContaining({
            taskId: "task-phase5-kickoff",
            plannedStartDate: "2026-06-02",
            plannedFinishDate: "2026-06-04",
            durationDays: 3,
            progressPercent: 40
          })
        ])
      }
    });

    const liveDrift = await app.request(
      `/api/projects/${project.id}/schedule/tasks/task-phase5-kickoff?testUser=project-manager-a`,
      jsonRequest(
        {
          plannedStartDate: "2026-06-05",
          plannedFinishDate: "2026-06-06",
          plannedWorkHours: 10,
          progressPercent: 50
        },
        "PATCH"
      )
    );
    expect(liveDrift.status).toBe(200);

    const schedule = await app.request(`/api/projects/${project.id}/schedule?testUser=project-manager-a`);
    expect(schedule.status).toBe(200);
    await expect(readJson(schedule)).resolves.toMatchObject({
      baseline: {
        taskBaselineValues: expect.arrayContaining([
          expect.objectContaining({
            taskId: "task-phase5-kickoff",
            plannedStartDate: "2026-06-02",
            plannedFinishDate: "2026-06-04",
            progressPercent: 40
          })
        ])
      },
      schedulePlan: {
        wbsNodes: expect.arrayContaining([
          expect.objectContaining({
            taskId: "task-phase5-kickoff",
            schedule: expect.objectContaining({
              plannedStartDate: "2026-06-05",
              plannedFinishDate: "2026-06-06"
            }),
            progressPercent: 50
          })
        ])
      }
    });

    const audit = await app.request(`/api/projects/${project.id}/schedule/audit?testUser=tenant-admin-a`);
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({ actionKey: "schedule.task.create" }),
        expect.objectContaining({ actionKey: "schedule.task.update" }),
        expect.objectContaining({ actionKey: "schedule.dependency.create" }),
        expect.objectContaining({ actionKey: "schedule.baseline.capture" })
      ]),
      actionExecutions: expect.arrayContaining([
        expect.objectContaining({ commandType: "schedule.task.create", status: "succeeded" }),
        expect.objectContaining({ commandType: "schedule.baseline.capture", status: "succeeded" })
      ])
    });
  });

  it("denies read-only writes and hides tenant-private schedules", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const project = await createManagedProject(app, "project-phase5-secure");

    const deniedCreate = await app.request(
      `/api/projects/${project.id}/schedule/tasks?testUser=readonly-observer-a`,
      jsonRequest({
        id: "task-phase5-denied",
        stageId: project.currentStageId,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-02",
        plannedWorkHours: 4,
        progressPercent: 0
      })
    );
    expect(deniedCreate.status).toBe(403);

    const readOnlySchedule = await app.request(`/api/projects/${project.id}/schedule?testUser=readonly-observer-a`);
    expect(readOnlySchedule.status).toBe(200);

    const hiddenTenantAProject = await app.request(`/api/projects/${project.id}/schedule?testUser=tenant-admin-b`);
    expect(hiddenTenantAProject.status).toBe(404);
  });

  it("returns safe blocker DTOs without partial mutation for invalid dependencies", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const project = await createManagedProject(app, "project-phase5-dependency-blocker");

    await createScheduleTask(app, project.id, {
      id: "task-phase5-predecessor",
      stageId: project.currentStageId,
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      plannedStartDate: "2026-06-05",
      plannedFinishDate: "2026-06-06",
      plannedWorkHours: 8,
      progressPercent: 0
    });
    await createScheduleTask(app, project.id, {
      id: "task-phase5-successor",
      stageId: `${project.id}:stage-delivery`,
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-04",
      plannedFinishDate: "2026-06-08",
      plannedWorkHours: 16,
      progressPercent: 0
    });

    const invalidDependency = await app.request(
      `/api/projects/${project.id}/schedule/dependencies?testUser=project-manager-a`,
      jsonRequest({
        id: "dependency-phase5-invalid",
        predecessorTaskId: "task-phase5-predecessor",
        successorTaskId: "task-phase5-successor",
        type: "finish_to_start"
      })
    );
    expect(invalidDependency.status).toBe(409);
    await expect(readJson(invalidDependency)).resolves.toMatchObject({
      code: "precondition_failed",
      validationIssues: [
        expect.objectContaining({
          code: "finish_to_start_conflict",
          dependencyId: "dependency-phase5-invalid"
        })
      ]
    });

    const schedule = await app.request(`/api/projects/${project.id}/schedule?testUser=project-manager-a`);
    expect(schedule.status).toBe(200);
    await expect(readJson(schedule)).resolves.toMatchObject({
      schedulePlan: {
        dependencies: []
      }
    });
  });

  it("rejects duplicate dependency ids inside one schedule plan", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const project = await createManagedProject(app, "project-phase5-duplicate-dependency-id");

    await createScheduleTask(app, project.id, {
      id: "task-phase5-dup-a",
      stageId: project.currentStageId,
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-02",
      plannedWorkHours: 8,
      progressPercent: 0
    });
    await createScheduleTask(app, project.id, {
      id: "task-phase5-dup-b",
      stageId: `${project.id}:stage-delivery`,
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-03",
      plannedFinishDate: "2026-06-04",
      plannedWorkHours: 8,
      progressPercent: 0
    });
    await createScheduleTask(app, project.id, {
      id: "task-phase5-dup-c",
      stageId: `${project.id}:stage-delivery`,
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-05",
      plannedFinishDate: "2026-06-06",
      plannedWorkHours: 8,
      progressPercent: 0
    });

    const first = await app.request(
      `/api/projects/${project.id}/schedule/dependencies?testUser=project-manager-a`,
      jsonRequest({
        id: "dependency-phase5-duplicate-id",
        predecessorTaskId: "task-phase5-dup-a",
        successorTaskId: "task-phase5-dup-b",
        type: "finish_to_start"
      })
    );
    expect(first.status).toBe(201);

    const duplicate = await app.request(
      `/api/projects/${project.id}/schedule/dependencies?testUser=project-manager-a`,
      jsonRequest({
        id: "dependency-phase5-duplicate-id",
        predecessorTaskId: "task-phase5-dup-b",
        successorTaskId: "task-phase5-dup-c",
        type: "finish_to_start"
      })
    );
    expect(duplicate.status).toBe(409);

    const schedule = await app.request(`/api/projects/${project.id}/schedule?testUser=project-manager-a`);
    expect(schedule.status).toBe(200);
    await expect(readJson(schedule)).resolves.toMatchObject({
      schedulePlan: {
        dependencies: [
          expect.objectContaining({
            id: "dependency-phase5-duplicate-id",
            predecessorTaskId: "task-phase5-dup-a",
            successorTaskId: "task-phase5-dup-b"
          })
        ]
      }
    });
  });

  it("keeps schedule audit scoped when dependency ids collide across projects", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const projectA = await createManagedProject(app, "project-phase5-audit-a");
    const projectB = await createManagedProject(app, "project-phase5-audit-b");

    await createScheduleTask(app, projectA.id, {
      id: "task-phase5-audit-a-one",
      stageId: projectA.currentStageId,
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-02",
      plannedWorkHours: 8,
      progressPercent: 0
    });
    await createScheduleTask(app, projectA.id, {
      id: "task-phase5-audit-a-two",
      stageId: `${projectA.id}:stage-delivery`,
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-03",
      plannedFinishDate: "2026-06-04",
      plannedWorkHours: 8,
      progressPercent: 0
    });
    await createScheduleTask(app, projectB.id, {
      id: "task-phase5-audit-b-one",
      stageId: projectB.currentStageId,
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-02",
      plannedWorkHours: 8,
      progressPercent: 0
    });
    await createScheduleTask(app, projectB.id, {
      id: "task-phase5-audit-b-two",
      stageId: `${projectB.id}:stage-delivery`,
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-03",
      plannedFinishDate: "2026-06-04",
      plannedWorkHours: 8,
      progressPercent: 0
    });

    for (const [project, predecessorTaskId, successorTaskId] of [
      [projectA, "task-phase5-audit-a-one", "task-phase5-audit-a-two"],
      [projectB, "task-phase5-audit-b-one", "task-phase5-audit-b-two"]
    ] as const) {
      const response = await app.request(
        `/api/projects/${project.id}/schedule/dependencies?testUser=project-manager-a`,
        jsonRequest({
          id: "dependency-shared-audit-id",
          predecessorTaskId,
          successorTaskId,
          type: "finish_to_start"
        })
      );
      expect(response.status).toBe(201);
    }

    const audit = await app.request(`/api/projects/${projectA.id}/schedule/audit?testUser=tenant-admin-a`);
    expect(audit.status).toBe(200);
    const body = (await readJson(audit)) as {
      events: Array<{ actionKey: string; correlationId: string }>;
      actionExecutions: Array<{ commandType: string; correlationId: string }>;
    };
    const dependencyEvents = body.events.filter((event) => event.actionKey === "schedule.dependency.create");
    const dependencyActions = body.actionExecutions.filter(
      (actionExecution) => actionExecution.commandType === "schedule.dependency.create"
    );

    expect(dependencyEvents).toHaveLength(1);
    expect(dependencyActions).toHaveLength(1);
    expect(dependencyEvents[0]?.correlationId).toBe(dependencyActions[0]?.correlationId);
  });

  it("rejects malformed schedule commands before partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const project = await createManagedProject(app, "project-phase5-invalid-commands");

    await createScheduleTask(app, project.id, {
      id: "task-phase5-stable",
      stageId: project.currentStageId,
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      plannedWorkHours: 8,
      progressPercent: 10
    });

    const invalidPatch = await app.request(
      `/api/projects/${project.id}/schedule/tasks/task-phase5-stable?testUser=project-manager-a`,
      jsonRequest(
        {
          plannedStartDate: "2026-06-05",
          plannedFinishDate: "2026-06-04",
          plannedWorkHours: 8,
          progressPercent: 20
        },
        "PATCH"
      )
    );
    expect(invalidPatch.status).toBe(400);

    const unknownEndpoint = await app.request(
      `/api/projects/${project.id}/schedule/dependencies?testUser=project-manager-a`,
      jsonRequest({
        id: "dependency-phase5-unknown",
        predecessorTaskId: "task-phase5-stable",
        successorTaskId: "task-phase5-missing",
        type: "finish_to_start"
      })
    );
    expect(unknownEndpoint.status).toBe(400);

    const schedule = await app.request(`/api/projects/${project.id}/schedule?testUser=project-manager-a`);
    expect(schedule.status).toBe(200);
    await expect(readJson(schedule)).resolves.toMatchObject({
      schedulePlan: {
        dependencies: [],
        wbsNodes: expect.arrayContaining([
          expect.objectContaining({
            taskId: "task-phase5-stable",
            schedule: {
              plannedStartDate: "2026-06-01",
              plannedFinishDate: "2026-06-03",
              durationDays: 3
            },
            plannedWorkHours: 8,
            progressPercent: 10
          })
        ])
      }
    });
  });
});
