import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getPhase5FixtureSeed, type Phase5FixtureTask, type Phase5TenantScheduleFixture } from "@kiss-pm/shared-test-fixtures";

export const phase5Seed = getPhase5FixtureSeed();

type ManagedProjectDto = {
  id: string;
  tenantId: string;
  currentStageId: string;
  stages: Array<{ id: string; templateKey: string }>;
};

type ScheduleDto = {
  schedulePlan: {
    projectId: string;
    wbsNodes: Array<{
      id: string;
      taskId?: string;
      stageId?: string;
      schedule?: {
        plannedStartDate?: string;
        plannedFinishDate?: string;
        durationDays?: number;
      };
      plannedWorkHours?: number;
      progressPercent?: number;
    }>;
    dependencies: Array<{
      id: string;
      predecessorTaskId: string;
      successorTaskId: string;
      type: "finish_to_start";
    }>;
  };
  validationIssues: Array<{ code: string; dependencyId?: string; nodeId?: string; severity: string }>;
  baseline?: {
    id: string;
    taskBaselineValues: Array<{
      taskId: string;
      plannedStartDate?: string;
      plannedFinishDate?: string;
      durationDays?: number;
      progressPercent?: number;
    }>;
  };
};

export function phase5ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

function jsonRequest(body: unknown, method = "POST"): { data: unknown; headers: Record<string, string>; method?: string } {
  return {
    ...(method !== "POST" ? { method } : {}),
    headers: { "content-type": "application/json" },
    data: body
  };
}

export async function resetPhase5Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase5ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

async function ensureProjectDraft(request: APIRequestContext, testUser: string, opportunityId: string): Promise<string> {
  const response = await request.post(
    `${phase5ApiBaseUrl()}/api/crm/opportunities/${encodeURIComponent(opportunityId)}/project-draft?testUser=${encodeURIComponent(
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
  fixture: Phase5TenantScheduleFixture = phase5Seed.tenantA,
  testUser = "project-manager-a"
): Promise<ManagedProjectDto> {
  const projectDraftId = await ensureProjectDraft(request, testUser, fixture.seedOpportunityId);
  const response = await request.post(
    `${phase5ApiBaseUrl()}/api/projects/from-template?testUser=${encodeURIComponent(testUser)}`,
    jsonRequest({ projectDraftId, projectId: fixture.projectId })
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { project: ManagedProjectDto };

  return body.project;
}

function stageIdFor(project: ManagedProjectDto, task: Phase5FixtureTask): string {
  const stage = project.stages.find((candidate) => candidate.templateKey === task.stageKey);
  if (!stage) {
    throw new Error(`No stage ${task.stageKey} in project ${project.id}`);
  }

  return stage.id;
}

export async function createScheduleTask(
  request: APIRequestContext,
  project: ManagedProjectDto,
  task: Phase5FixtureTask,
  options: {
    testUser?: string;
    participants?: Array<{ id?: string; userId: string; role: "executor" | "controller" | "observer" }>;
  } = {}
) {
  const response = await request.post(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/schedule/tasks?testUser=${encodeURIComponent(
      options.testUser ?? "project-manager-a"
    )}`,
    jsonRequest({
      id: task.id,
      stageId: stageIdFor(project, task),
      taskTemplateId: task.taskTemplateId,
      taskTemplateKey: task.taskTemplateKey,
      plannedStartDate: task.plannedStartDate,
      plannedFinishDate: task.plannedFinishDate,
      plannedWorkHours: task.plannedWorkHours,
      progressPercent: task.progressPercent,
      ...(options.participants !== undefined ? { participants: options.participants } : {})
    })
  );
  await expect(response).toBeOK();

  return response.json();
}

export async function seedScheduleProject(
  request: APIRequestContext,
  fixture: Phase5TenantScheduleFixture = phase5Seed.tenantA,
  testUser = "project-manager-a"
): Promise<ManagedProjectDto> {
  const project = await createManagedProject(request, fixture, testUser);
  for (const task of fixture.tasks) {
    await createScheduleTask(request, project, task, { testUser });
  }

  return project;
}

export async function openKissPm(page: Page, testUser = "project-manager-a") {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export async function getSchedule(
  request: APIRequestContext,
  projectId = phase5Seed.tenantA.projectId,
  testUser = "project-manager-a"
): Promise<ScheduleDto> {
  const response = await request.get(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/schedule?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as ScheduleDto;
}

export async function getScheduleAudit(request: APIRequestContext, projectId = phase5Seed.tenantA.projectId) {
  const response = await request.get(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/schedule/audit?testUser=tenant-admin-a`
  );
  await expect(response).toBeOK();

  return (await response.json()) as {
    events: Array<{ actionKey: string; target: { entityType: string; entityId: string }; correlationId: string }>;
    actionExecutions: Array<{ commandType: string; status: string; target?: { entityType: string; entityId: string } }>;
  };
}

export async function listProjectTasks(request: APIRequestContext, projectId = phase5Seed.tenantA.projectId) {
  const response = await request.get(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/tasks?testUser=project-manager-a`
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { tasks: Array<{ id: string; projectId: string }> };

  return body.tasks;
}

export async function listMyExecutorTasks(request: APIRequestContext, testUser = "executor-a") {
  const response = await request.get(`${phase5ApiBaseUrl()}/api/my/tasks?roles=executor&testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  const body = (await response.json()) as { tasks: Array<{ id: string; projectId: string; relationRoles: string[] }> };

  return body.tasks;
}

export async function getKanbanTaskIds(request: APIRequestContext, projectId = phase5Seed.tenantA.projectId) {
  const response = await request.get(
    `${phase5ApiBaseUrl()}/api/kanban/projects/${encodeURIComponent(projectId)}?testUser=project-manager-a`
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as {
    columns: Array<{ tasks: Array<{ id: string; projectId: string }> }>;
  };

  return body.columns.flatMap((column) => column.tasks.map((task) => task.id));
}
