import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const phase4ProjectId = "project-phase4-main";
export const phase4OpportunityId = "opportunity-seed-ready";
export const phase4TaskId = "task-phase4-kickoff";

export type Phase4ManagedProject = {
  id: string;
  tenantId: string;
  currentStageId: string;
  stages: Array<{ id: string; templateKey: string; status: string }>;
  tasks: Phase4Task[];
  processTemplateSnapshot: {
    stageTemplates: Array<{
      id: string;
      key: string;
      requiredArtifactTemplates: Array<{ id: string; key: string }>;
      approvalTemplates: Array<{ id: string; key: string }>;
      taskTemplates: Array<{ id: string; key: string }>;
    }>;
  };
};

export type Phase4Task = {
  id: string;
  projectId: string;
  stageId: string;
  status: "todo" | "in_progress" | "blocked" | "done" | "cancelled";
  title: string;
};

type JsonRequest = {
  data: unknown;
  headers: Record<string, string>;
  method?: string;
};

export function phase4ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

function jsonRequest(body: unknown, method?: string): JsonRequest {
  return {
    ...(method ? { method } : {}),
    headers: { "content-type": "application/json" },
    data: body
  };
}

function activeStage(project: Phase4ManagedProject) {
  const stage = project.stages.find((candidate) => candidate.id === project.currentStageId);
  if (!stage) {
    throw new Error(`No active stage for project ${project.id}`);
  }

  return stage;
}

function activeStageTemplate(project: Phase4ManagedProject) {
  const stage = activeStage(project);
  const stageTemplate = project.processTemplateSnapshot.stageTemplates.find(
    (candidate) => candidate.key === stage.templateKey
  );
  if (!stageTemplate) {
    throw new Error(`No stage template ${stage.templateKey} for project ${project.id}`);
  }

  return stageTemplate;
}

export async function resetPhase4Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase4ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function openProjectWorkSurface(page: Page, testUser = "project-manager-a") {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("project-work-surface")).toBeVisible();
}

export async function ensureProjectDraft(
  request: APIRequestContext,
  testUser = "project-manager-a",
  opportunityId = phase4OpportunityId
): Promise<string> {
  const response = await request.post(
    `${phase4ApiBaseUrl()}/api/crm/opportunities/${encodeURIComponent(opportunityId)}/project-draft?testUser=${encodeURIComponent(
      testUser
    )}`,
    jsonRequest({})
  );
  if (response.status() === 409) {
    return `project-draft-${opportunityId}`;
  }
  await expect(response).toBeOK();
  const body = (await response.json()) as { projectDraft: { id: string } };

  return body.projectDraft.id;
}

export async function createManagedProject(
  request: APIRequestContext,
  projectId = phase4ProjectId,
  testUser = "project-manager-a"
): Promise<Phase4ManagedProject> {
  const projectDraftId = await ensureProjectDraft(request, testUser);
  const response = await request.post(
    `${phase4ApiBaseUrl()}/api/projects/from-template?testUser=${encodeURIComponent(testUser)}`,
    jsonRequest({ projectDraftId, projectId })
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { project: Phase4ManagedProject };

  return body.project;
}

export async function getManagedProject(
  request: APIRequestContext,
  projectId = phase4ProjectId,
  testUser = "project-manager-a"
): Promise<Phase4ManagedProject> {
  const response = await request.get(
    `${phase4ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { project: Phase4ManagedProject };

  return body.project;
}

export async function createPhase4Task(
  request: APIRequestContext,
  project: Phase4ManagedProject,
  taskId = phase4TaskId
): Promise<Phase4Task> {
  const stage = activeStage(project);
  const taskTemplate = activeStageTemplate(project).taskTemplates[0];
  if (!taskTemplate) {
    throw new Error(`No task template for active stage ${stage.id}`);
  }
  const response = await request.post(
    `${phase4ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/tasks?testUser=project-manager-a`,
    jsonRequest({
      id: taskId,
      stageId: stage.id,
      taskTemplateId: taskTemplate.id,
      taskTemplateKey: taskTemplate.key,
      dueDate: "2026-06-05",
      plannedWorkHours: 12,
      participants: [
        { id: `${taskId}-executor`, userId: "executor-a", role: "executor" },
        { id: `${taskId}-controller`, userId: "project-manager-a", role: "controller" }
      ]
    })
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { task: Phase4Task };

  return body.task;
}

export async function recordRequiredGateEvidence(request: APIRequestContext, project: Phase4ManagedProject) {
  const stage = activeStage(project);
  const stageTemplate = activeStageTemplate(project);
  const artifactTemplate = stageTemplate.requiredArtifactTemplates[0];
  const approvalTemplate = stageTemplate.approvalTemplates[0];
  if (!artifactTemplate || !approvalTemplate) {
    throw new Error(`No required gate evidence templates for active stage ${stage.id}`);
  }

  const artifactResponse = await request.post(
    `${phase4ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/stages/${encodeURIComponent(
      stage.id
    )}/artifacts?testUser=project-manager-a`,
    jsonRequest({
      id: "artifact-phase4-charter",
      templateId: artifactTemplate.id,
      templateKey: artifactTemplate.key,
      status: "accepted",
      evidenceRef: "artifact://phase4/charter"
    })
  );
  await expect(artifactResponse).toBeOK();

  const approvalResponse = await request.post(
    `${phase4ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/stages/${encodeURIComponent(
      stage.id
    )}/approvals?testUser=project-manager-a`,
    jsonRequest({
      id: "approval-phase4-charter",
      templateId: approvalTemplate.id,
      templateKey: approvalTemplate.key,
      decision: "approved"
    })
  );
  await expect(approvalResponse).toBeOK();
}

export async function listMyTasks(request: APIRequestContext, testUser: string, roles: string) {
  const response = await request.get(
    `${phase4ApiBaseUrl()}/api/my/tasks?roles=${encodeURIComponent(roles)}&testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as {
    tasks: Array<Phase4Task & { relationRoles: string[] }>;
  };
}

export async function getKanbanTask(
  request: APIRequestContext,
  projectId = phase4ProjectId,
  taskId = phase4TaskId,
  testUser = "project-manager-a"
) {
  const response = await request.get(
    `${phase4ApiBaseUrl()}/api/kanban/projects/${encodeURIComponent(projectId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as {
    columns: Array<{ status: string; tasks: Phase4Task[] }>;
  };

  return body.columns.flatMap((column) => column.tasks).find((task) => task.id === taskId);
}

export async function getAuditEvents(request: APIRequestContext, targetType: "project" | "task" | "stage", targetId: string) {
  const response = await request.get(
    `${phase4ApiBaseUrl()}/api/audit?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}&testUser=tenant-admin-a`
  );
  await expect(response).toBeOK();

  return (await response.json()) as {
    events: Array<{
      actionKey: string;
      actorId: string;
      target: { entityType: string; entityId: string };
      details?: unknown;
    }>;
  };
}
