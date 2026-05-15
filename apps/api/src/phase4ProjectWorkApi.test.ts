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

async function createManagedProject(app: ReturnType<typeof createApiApp>, projectId = "project-phase4-main") {
  const projectDraftId = await createDraft(app);
  const response = await app.request(
    "/api/projects/from-template?testUser=project-manager-a",
    jsonRequest({ projectDraftId, projectId })
  );
  expect(response.status).toBe(201);
  const body = (await readJson(response)) as {
    project: {
      id: string;
      currentStageId: string;
      stages: Array<{ id: string; templateKey: string; status: string }>;
    };
  };

  return body.project;
}

describe("Phase 4 project lifecycle and work API", () => {
  it("creates a managed project, writes task work state, and exposes My Tasks/Kanban/audit projections", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const project = await createManagedProject(app);

    expect(project).toMatchObject({
      id: "project-phase4-main",
      currentStageId: "project-phase4-main:stage-initiation",
      stages: [
        { templateKey: "initiation", status: "active" },
        { templateKey: "delivery", status: "pending" }
      ]
    });

    const taskCreate = await app.request(
      `/api/projects/${project.id}/tasks?testUser=project-manager-a`,
      jsonRequest({
        id: "task-phase4-kickoff",
        stageId: project.currentStageId,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-05",
        plannedWorkHours: 12,
        participants: [
          { id: "participant-kickoff-executor", userId: "executor-a", role: "executor" },
          { id: "participant-kickoff-controller", userId: "project-manager-a", role: "controller" }
        ]
      })
    );
    expect(taskCreate.status).toBe(201);
    const taskCreateBody = (await readJson(taskCreate)) as {
      task: { id: string; status: string; projectId: string };
      participants: Array<{ taskId: string; userId: string; role: string }>;
    };
    expect(taskCreateBody).toMatchObject({
      task: {
        id: "task-phase4-kickoff",
        status: "todo",
        projectId: project.id
      },
      participants: expect.arrayContaining([
        expect.objectContaining({ taskId: "task-phase4-kickoff", userId: "executor-a", role: "executor" }),
        expect.objectContaining({ taskId: "task-phase4-kickoff", userId: "project-manager-a", role: "controller" })
      ])
    });

    const myTasks = await app.request("/api/my/tasks?testUser=executor-a&roles=executor");
    expect(myTasks.status).toBe(200);
    await expect(readJson(myTasks)).resolves.toMatchObject({
      tasks: [
        {
          id: "task-phase4-kickoff",
          projectId: project.id,
          relationRoles: ["executor"]
        }
      ]
    });

    const statusChange = await app.request(
      "/api/tasks/task-phase4-kickoff/status?testUser=executor-a",
      jsonRequest({ toStatus: "in_progress" }, "PATCH")
    );
    expect(statusChange.status).toBe(200);
    await expect(readJson(statusChange)).resolves.toMatchObject({
      task: {
        id: "task-phase4-kickoff",
        status: "in_progress"
      },
      statusHistory: [
        {
          taskId: "task-phase4-kickoff",
          fromStatus: "todo",
          toStatus: "in_progress",
          actorId: "executor-a"
        }
      ]
    });

    const comment = await app.request(
      "/api/tasks/task-phase4-kickoff/comments?testUser=executor-a",
      jsonRequest({ body: "Начал работу по старту проекта" })
    );
    expect(comment.status).toBe(201);
    await expect(readJson(comment)).resolves.toMatchObject({
      comment: {
        taskId: "task-phase4-kickoff",
        body: "Начал работу по старту проекта",
        authorId: "executor-a"
      }
    });

    const kanban = await app.request(`/api/kanban/projects/${project.id}?testUser=project-manager-a`);
    expect(kanban.status).toBe(200);
    await expect(readJson(kanban)).resolves.toMatchObject({
      projectId: project.id,
      columns: expect.arrayContaining([
        expect.objectContaining({
          status: "in_progress",
          tasks: expect.arrayContaining([
            expect.objectContaining({
              id: "task-phase4-kickoff",
              projectId: project.id
            })
          ])
        })
      ])
    });

    const audit = await app.request(
      "/api/audit?testUser=tenant-admin-a&targetType=task&targetId=task-phase4-kickoff"
    );
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({ actionKey: "task.status.change" }),
        expect.objectContaining({ actionKey: "task.comment.add" })
      ])
    });
  });

  it("blocks stage transition until required artifact and approval evidence exists", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const project = await createManagedProject(app, "project-phase4-gated");

    const blockedTransition = await app.request(
      `/api/projects/${project.id}/stages/${project.currentStageId}/transition?testUser=project-manager-a`,
      jsonRequest({ transition: "advance_stage" })
    );
    expect(blockedTransition.status).toBe(409);
    await expect(readJson(blockedTransition)).resolves.toMatchObject({
      code: "precondition_failed",
      transitionError: {
        code: "stage_gate_blocked",
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "missing_required_artifact" }),
          expect.objectContaining({ code: "required_approval_not_approved" })
        ])
      }
    });

    const artifact = await app.request(
      `/api/projects/${project.id}/stages/${project.currentStageId}/artifacts?testUser=project-manager-a`,
      jsonRequest({
        id: "artifact-phase4-charter",
        templateId: "artifact-charter",
        templateKey: "project_charter",
        status: "accepted",
        evidenceRef: "artifact://phase4/charter"
      })
    );
    expect(artifact.status).toBe(201);

    const approval = await app.request(
      `/api/projects/${project.id}/stages/${project.currentStageId}/approvals?testUser=project-manager-a`,
      jsonRequest({
        id: "approval-phase4-charter",
        templateId: "approval-charter",
        templateKey: "charter_approval",
        decision: "approved"
      })
    );
    expect(approval.status).toBe(201);

    const transition = await app.request(
      `/api/projects/${project.id}/stages/${project.currentStageId}/transition?testUser=project-manager-a`,
      jsonRequest({ transition: "advance_stage" })
    );
    expect(transition.status).toBe(200);
    await expect(readJson(transition)).resolves.toMatchObject({
      project: {
        id: project.id,
        currentStageId: "project-phase4-gated:stage-delivery",
        stages: [
          { templateKey: "initiation", status: "completed" },
          { templateKey: "delivery", status: "active" }
        ]
      }
    });
  });

  it("enforces permissions and tenant isolation on project/work routes", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const tenantAProject = await createManagedProject(app, "project-phase4-secure");

    const deniedTask = await app.request(
      `/api/projects/${tenantAProject.id}/tasks?testUser=readonly-observer-a`,
      jsonRequest({
        id: "task-denied",
        stageId: tenantAProject.currentStageId,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-05",
        plannedWorkHours: 1
      })
    );
    expect(deniedTask.status).toBe(403);

    const managerOnlyTask = await app.request(
      `/api/projects/${tenantAProject.id}/tasks?testUser=project-manager-a`,
      jsonRequest({
        id: "task-manager-only",
        stageId: tenantAProject.currentStageId,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-05",
        plannedWorkHours: 1
      })
    );
    expect(managerOnlyTask.status).toBe(201);

    const unrelatedExecutorStatus = await app.request(
      "/api/tasks/task-manager-only/status?testUser=executor-a",
      jsonRequest({ toStatus: "in_progress" }, "PATCH")
    );
    expect(unrelatedExecutorStatus.status).toBe(403);

    const observerOnlyTask = await app.request(
      `/api/projects/${tenantAProject.id}/tasks?testUser=project-manager-a`,
      jsonRequest({
        id: "task-observer-only",
        stageId: tenantAProject.currentStageId,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-06",
        plannedWorkHours: 1,
        participants: [{ id: "participant-observer-only", userId: "executor-a", role: "observer" }]
      })
    );
    expect(observerOnlyTask.status).toBe(201);

    const observerStatus = await app.request(
      "/api/tasks/task-observer-only/status?testUser=executor-a",
      jsonRequest({ toStatus: "in_progress" }, "PATCH")
    );
    expect(observerStatus.status).toBe(403);

    const crossTenantParticipant = await app.request(
      `/api/projects/${tenantAProject.id}/tasks?testUser=project-manager-a`,
      jsonRequest({
        id: "task-cross-tenant-participant",
        stageId: tenantAProject.currentStageId,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-07",
        plannedWorkHours: 1,
        participants: [{ id: "participant-foreign", userId: "tenant-admin-b", role: "executor" }]
      })
    );
    expect(crossTenantParticipant.status).toBe(400);

    const secondTenantAProject = await createManagedProject(app, "project-phase4-second");
    const duplicateTaskId = await app.request(
      `/api/projects/${secondTenantAProject.id}/tasks?testUser=project-manager-a`,
      jsonRequest({
        id: "task-manager-only",
        stageId: secondTenantAProject.currentStageId,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-08",
        plannedWorkHours: 1
      })
    );
    expect(duplicateTaskId.status).toBe(409);

    const tenantBDraft = await app.request(
      "/api/crm/opportunities/opportunity-b-private/project-draft?testUser=tenant-admin-b",
      jsonRequest({})
    );
    expect(tenantBDraft.status).toBe(201);
    const tenantBDraftBody = (await readJson(tenantBDraft)) as { projectDraft: { id: string } };
    const tenantBProject = await app.request(
      "/api/projects/from-template?testUser=tenant-admin-b",
      jsonRequest({ projectDraftId: tenantBDraftBody.projectDraft.id, projectId: tenantAProject.id })
    );
    expect(tenantBProject.status).toBe(201);

    const tenantBProjectBody = (await readJson(tenantBProject)) as { project: { id: string; tenantId: string } };
    expect(tenantBProjectBody.project).toMatchObject({ id: tenantAProject.id, tenantId: "tenant-b" });

    const tenantARead = await app.request(`/api/projects/${tenantAProject.id}?testUser=project-manager-a`);
    expect(tenantARead.status).toBe(200);
    const tenantAReadText = await tenantARead.text();
    expect(tenantAReadText).toContain("tenant-a");
    expect(tenantAReadText).not.toContain("Tenant B");

    const tenantBRead = await app.request(`/api/projects/${tenantAProject.id}?testUser=tenant-admin-b`);
    expect(tenantBRead.status).toBe(200);
    const tenantBReadBody = (await readJson(tenantBRead)) as { project: { tenantId: string } };
    expect(tenantBReadBody.project.tenantId).toBe("tenant-b");

    const hiddenTenantATask = await app.request(
      "/api/tasks/task-manager-only/status?testUser=tenant-admin-b",
      jsonRequest({ toStatus: "done" }, "PATCH")
    );
    expect(hiddenTenantATask.status).toBe(404);
  });
});
