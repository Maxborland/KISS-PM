import { expect, test } from "@playwright/test";

import {
  applyImport,
  getProject,
  getTaskAudit,
  openKissPm,
  phase11ApiBaseUrl,
  previewImport,
  requireMapping,
  resetPhase11Fixtures,
  setAdapterFailure,
  tenantA,
  tenantB
} from "./helpers";

test("E2E-103 imported project remains canonical and operable after adapter failure", async ({ page, request }) => {
  await resetPhase11Fixtures(request);
  const preview = await previewImport(request);
  const apply = await applyImport(request, preview.preview.id, tenantA.canonicalContinuityBatchId, `${tenantA.idempotencyKey}-103`);
  const projectMapping = requireMapping(apply.readback.mappings, "project");
  const taskMapping = requireMapping(apply.readback.mappings, "task");

  await setAdapterFailure(request);

  const project = await getProject(request, projectMapping.canonicalEntityId);
  expect(project.project.title).toBe(tenantA.importedProjectTitle);
  expect(project.project.tasks).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: taskMapping.canonicalEntityId, title: tenantA.importedTaskTitle })])
  );
  expect(JSON.stringify(project)).not.toContain(projectMapping.externalEntityId);
  expect(JSON.stringify(project)).not.toContain(taskMapping.externalEntityId);

  await openKissPm(page, tenantA.projectManagerUserId, { projectId: projectMapping.canonicalEntityId });
  await expect(page.getByTestId("managed-project-title")).toContainText(tenantA.importedProjectTitle);
  await expect(page.getByTestId("project-task-list")).toContainText(tenantA.importedTaskTitle);
  await expect(page.getByTestId("kanban-column-todo")).toContainText(taskMapping.canonicalEntityId);

  await page.getByTestId("kanban-column-todo").getByRole("button", { name: "В работу" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Статус задачи изменен");
  await expect(page.getByTestId("kanban-column-in_progress")).toContainText(taskMapping.canonicalEntityId);

  const changedProject = await getProject(request, projectMapping.canonicalEntityId);
  expect(changedProject.project.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskMapping.canonicalEntityId, status: "in_progress" })]));
  const taskAudit = await getTaskAudit(request, taskMapping.canonicalEntityId);
  expect(taskAudit.events).toEqual(expect.arrayContaining([expect.objectContaining({ actionKey: "task.status.change" })]));

  await page.reload();
  await expect(page.getByTestId("managed-project-title")).toContainText(tenantA.importedProjectTitle);
  await expect(page.getByTestId("kanban-column-in_progress")).toContainText(taskMapping.canonicalEntityId);

  const tenantBRead = await request.get(
    `${phase11ApiBaseUrl()}/api/projects/${encodeURIComponent(projectMapping.canonicalEntityId)}?testUser=${encodeURIComponent(
      tenantB.adminUserId
    )}`
  );
  expect(tenantBRead.status()).toBe(404);
  await expect(tenantBRead.text()).resolves.not.toContain(tenantA.importedProjectTitle);

  await resetPhase11Fixtures(request);
  const afterReset = await request.get(
    `${phase11ApiBaseUrl()}/api/projects/${encodeURIComponent(projectMapping.canonicalEntityId)}?testUser=${encodeURIComponent(
      tenantA.projectManagerUserId
    )}`
  );
  expect(afterReset.status()).toBe(404);
});
