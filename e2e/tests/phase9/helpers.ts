import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getPhase9FixtureSeed, type Phase9ClosureDataFixture } from "@kiss-pm/shared-test-fixtures";

export const phase9Seed = getPhase9FixtureSeed();
export const tenantA = phase9Seed.tenantA;
export const tenantB = phase9Seed.tenantB;

export type ClosureReadbackDto = {
  project: { id: string; lifecycleStatus: string };
  snapshots: Array<{ id: string }>;
  latestSnapshot: null | { id: string; metrics: { plannedWorkHours: number } };
};

export type SnapshotDto = {
  id: string;
  projectId: string;
  project: { id: string; lifecycleStatus: string; tasks: Array<{ id: string; status: string }> };
  metrics: { plannedWorkHours: number; actualWorkHours: number };
  closure: { finalKpiSummary: string };
};

export type RetrospectiveAuditDto = {
  events: Array<{ actionKey: string; target: { entityId: string }; correlationId: string }>;
  actionExecutions: Array<{
    id: string;
    commandType: string;
    source: { entityType: string; entityId: string };
    target?: { entityType: string; entityId: string };
    auditEventIds?: string[];
  }>;
};

export type ClosedPortfolioDto = {
  rows: Array<{ entityId: string; fieldValues: Record<string, string | number | boolean | null>; explanation: string }>;
  summary: { totalSnapshots: number; trendSignalCount: number; openInsightCount: number };
};

export type TrendsDto = {
  trends: Array<{ id: string; sourceSnapshotIds: string[]; sourceMetricIds: string[]; severity: string }>;
  insights: Array<{ id: string; status: string; sourceSnapshotIds: string[]; sourceTrendId: string }>;
};

export function phase9ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

export function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

export async function resetPhase9Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase9ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function createClosableProject(
  request: APIRequestContext,
  projectId = tenantA.closureProjectId,
  opportunityId = "opportunity-seed-ready"
) {
  const draft = await request.post(
    `${phase9ApiBaseUrl()}/api/crm/opportunities/${encodeURIComponent(
      opportunityId
    )}/project-draft?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`,
    jsonRequest({})
  );
  expect([201, 409]).toContain(draft.status());
  const draftBody =
    draft.status() === 201
      ? ((await draft.json()) as { projectDraft: { id: string } })
      : { projectDraft: { id: `project-draft-${opportunityId}` } };

  const created = await request.post(
    `${phase9ApiBaseUrl()}/api/projects/from-template?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`,
    jsonRequest({ projectDraftId: draftBody.projectDraft.id, projectId })
  );
  await expect(created).toBeOK();
  const project = (await created.json()) as { project: { currentStageId: string } };

  const artifact = await request.post(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(
      project.project.currentStageId
    )}/artifacts?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`,
    jsonRequest({
      templateId: "artifact-charter",
      templateKey: "project_charter",
      status: "accepted",
      evidenceRef: `closure-e2e-charter-${projectId}`
    })
  );
  await expect(artifact).toBeOK();

  const approval = await request.post(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(
      project.project.currentStageId
    )}/approvals?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`,
    jsonRequest({
      templateId: "approval-charter",
      templateKey: "charter_approval",
      decision: "approved"
    })
  );
  await expect(approval).toBeOK();

  const advanced = await request.post(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(
      project.project.currentStageId
    )}/transition?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`,
    jsonRequest({ transition: "advance_stage" })
  );
  await expect(advanced).toBeOK();
  const advancedBody = (await advanced.json()) as { project: { currentStageId: string } };

  const task = await request.post(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/tasks?testUser=${encodeURIComponent(
      tenantA.projectManagerUserId
    )}`,
    jsonRequest({
      id: `${projectId}:delivery-task`,
      stageId: advancedBody.project.currentStageId,
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      dueDate: "2026-06-30",
      plannedWorkHours: 20
    })
  );
  await expect(task).toBeOK();

  const done = await request.patch(
    `${phase9ApiBaseUrl()}/api/tasks/${encodeURIComponent(`${projectId}:delivery-task`)}/status?testUser=${encodeURIComponent(
      tenantA.projectManagerUserId
    )}`,
    jsonRequest({ toStatus: "done" })
  );
  await expect(done).toBeOK();

  return projectId;
}

export async function closeProjectWithApi(
  request: APIRequestContext,
  projectId: string,
  closureData: Phase9ClosureDataFixture = tenantA.closureData
) {
  const preview = await request.post(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/closure/preview?testUser=${encodeURIComponent(
      tenantA.projectManagerUserId
    )}`,
    jsonRequest({ closureData })
  );
  await expect(preview).toBeOK();
  const previewBody = (await preview.json()) as { preview: { id: string } };

  const apply = await request.post(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/closure/apply?testUser=${encodeURIComponent(
      tenantA.projectManagerUserId
    )}`,
    jsonRequest({ previewId: previewBody.preview.id })
  );
  await expect(apply).toBeOK();

  return (await apply.json()) as { result: { snapshotId: string; actionExecution: { id: string; auditEventIds: string[] } } };
}

export async function createClosedRetrospectivePair(request: APIRequestContext) {
  const firstProjectId = await createClosableProject(request, tenantA.snapshotProjectIds[0]);
  const first = await closeProjectWithApi(request, firstProjectId, {
    ...tenantA.closureData,
    lessonsLearned: [{ ...tenantA.closureData.lessonsLearned[0], id: "lesson-phase9-e2e-snapshot-a" }]
  });
  const secondProjectId = await createClosableProject(request, tenantA.snapshotProjectIds[1]);
  const second = await closeProjectWithApi(request, secondProjectId, {
    ...tenantA.closureData,
    lessonsLearned: [{ ...tenantA.closureData.lessonsLearned[0], id: "lesson-phase9-e2e-snapshot-b" }]
  });

  return {
    projectIds: [firstProjectId, secondProjectId],
    snapshotIds: [first.result.snapshotId, second.result.snapshotId]
  };
}

export async function getClosure(request: APIRequestContext, projectId: string, testUser = tenantA.projectManagerUserId) {
  const response = await request.get(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/closure?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as ClosureReadbackDto;
}

export async function getSnapshot(request: APIRequestContext, snapshotId: string, testUser = tenantA.projectManagerUserId) {
  const response = await request.get(
    `${phase9ApiBaseUrl()}/api/retrospectives/snapshots/${encodeURIComponent(snapshotId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { snapshot: SnapshotDto };

  return body.snapshot;
}

export async function getClosedPortfolio(request: APIRequestContext, testUser = tenantA.adminUserId) {
  const response = await request.get(
    `${phase9ApiBaseUrl()}/api/retrospectives/closed-portfolio?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as ClosedPortfolioDto;
}

export async function getTrends(request: APIRequestContext, testUser = tenantA.adminUserId) {
  const response = await request.get(
    `${phase9ApiBaseUrl()}/api/retrospectives/trends?testUser=${encodeURIComponent(testUser)}&groupBy=template`
  );
  await expect(response).toBeOK();

  return (await response.json()) as TrendsDto;
}

export async function getRetrospectiveAudit(request: APIRequestContext, testUser = tenantA.adminUserId) {
  const response = await request.get(`${phase9ApiBaseUrl()}/api/retrospectives/audit?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();

  return (await response.json()) as RetrospectiveAuditDto;
}

export async function openKissPm(page: Page, testUser: string) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export async function openProjectClosure(page: Page, testUser = tenantA.projectManagerUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("project-closure-surface")).toBeVisible();
  await expect(page.getByTestId("project-closure-status")).toContainText("Readback закрытия получен");
}

export async function openClosedPortfolio(page: Page, testUser = tenantA.adminUserId) {
  await openKissPm(page, testUser);
  await expect(page.getByTestId("closed-portfolio-surface")).toBeVisible();
  await expect(page.getByTestId("closed-portfolio-status")).toContainText("Readback закрытого портфеля получен");
}
