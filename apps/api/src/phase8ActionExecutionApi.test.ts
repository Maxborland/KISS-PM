import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

const target = {
  surfaceId: "portfolio-control",
  surfaceKey: "portfolio.control",
  rowId: "row-kpi-signal-kpi-schedule-variance-a",
  entityType: "kpi_signal",
  entityId: "signal-kpi-schedule-variance-a"
};

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

async function createManagedProject(app: ReturnType<typeof createApiApp>, projectId = "project-alpha-a") {
  const projectDraftId = await createDraft(app);
  const response = await app.request(
    "/api/projects/from-template?testUser=project-manager-a",
    jsonRequest({ projectDraftId, projectId })
  );
  if (response.status === 409) return;
  expect(response.status).toBe(201);
}

describe("Phase 8 governed action execution API", () => {
  it("lists action definitions for Portfolio Control without executable mutation URLs", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request("/api/control/surfaces/portfolio-control/actions?testUser=project-manager-a");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({
      actions: expect.arrayContaining([
        expect.objectContaining({
          id: "action-create-corrective-task",
          key: "create_corrective_action",
          requiredPermission: "control.action:write",
          dryRunRequired: true
        }),
        expect.objectContaining({
          id: "action-accept-risk",
          key: "accept_risk",
          requiredPermission: "risk:accept",
          dryRunRequired: true
        })
      ])
    });
    expect(text).not.toContain("/execute");
  });

  it("previews dry-run actions without mutation and does not fake domain execution before bindings exist", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const auditBefore = await app.request("/api/control/audit?testUser=tenant-admin-a");
    expect(auditBefore.status).toBe(200);
    await expect(readJson(auditBefore)).resolves.toMatchObject({ actionExecutions: [] });

    const preview = await app.request(
      "/api/control/actions/action-accept-risk/preview?testUser=tenant-admin-a",
      jsonRequest({
        target,
        input: { reason: "Контролируемый риск до перепланирования", expiresAt: "2026-06-30" }
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string; mutatesState: boolean; after: unknown } };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      after: { status: "would_execute" }
    });

    const auditAfterPreview = await app.request("/api/control/audit?testUser=tenant-admin-a");
    await expect(readJson(auditAfterPreview)).resolves.toMatchObject({ actionExecutions: [] });

    const execute = await app.request(
      "/api/control/actions/action-accept-risk/execute?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(execute.status).toBe(501);
    await expect(readJson(execute)).resolves.toMatchObject({ code: "not_implemented" });

    const auditAfterExecute = await app.request("/api/control/audit?testUser=tenant-admin-a");
    expect(auditAfterExecute.status).toBe(200);
    await expect(readJson(auditAfterExecute)).resolves.toMatchObject({ actionExecutions: [] });
  });

  it("denies direct preview for users without action permission and does not create audit evidence", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request(
      "/api/control/actions/action-accept-risk/preview?testUser=readonly-observer-a",
      jsonRequest({
        target,
        input: { reason: "Не должен пройти" }
      })
    );
    expect(response.status).toBe(403);

    const audit = await app.request("/api/control/audit?testUser=tenant-admin-a");
    await expect(readJson(audit)).resolves.toMatchObject({ actionExecutions: [] });
  });

  it("rejects execution without required dry-run preview and stale preview reuse", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const withoutPreview = await app.request(
      "/api/control/actions/action-accept-risk/execute?testUser=tenant-admin-a",
      jsonRequest({ target, input: { reason: "Нет preview" } })
    );
    expect(withoutPreview.status).toBe(409);
    await expect(readJson(withoutPreview)).resolves.toMatchObject({ code: "dry_run_required" });

    const preview = await app.request(
      "/api/control/actions/action-accept-risk/preview?testUser=tenant-admin-a",
      jsonRequest({ target, input: { reason: "Одноразовый preview" } })
    );
    const previewBody = (await readJson(preview)) as { preview: { id: string } };
    const firstExecute = await app.request(
      "/api/control/actions/action-accept-risk/execute?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(firstExecute.status).toBe(501);

    const secondExecute = await app.request(
      "/api/control/actions/action-accept-risk/execute?testUser=tenant-admin-a",
      jsonRequest({ previewId: "missing-preview" })
    );
    expect(secondExecute.status).toBe(409);
    await expect(readJson(secondExecute)).resolves.toMatchObject({ code: "stale_preview" });
  });

  it("rejects missing required input fields before preview creation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request(
      "/api/control/actions/action-accept-risk/preview?testUser=tenant-admin-a",
      jsonRequest({ target, input: {} })
    );
    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({ code: "validation_error" });
    const audit = await app.request("/api/control/audit?testUser=tenant-admin-a");
    await expect(readJson(audit)).resolves.toMatchObject({ actionExecutions: [] });
  });

  it("rechecks execute permission against the stored preview target", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const profilesResponse = await app.request("/admin/access-profiles?testUser=tenant-admin-a");
    const profilesBody = (await readJson(profilesResponse)) as {
      profiles: Array<{
        id: string;
        version: number;
        systemKey: string;
        label: string;
        permissions: string[];
        scopeRules: Array<{ permissionKey: string; scope: string }>;
        active: boolean;
      }>;
    };
    const tenantAdminProfile = profilesBody.profiles.find((profile) => profile.systemKey === "tenant_admin")!;
    const preview = await app.request(
      "/api/control/actions/action-accept-risk/preview?testUser=tenant-admin-a",
      jsonRequest({ target, input: { reason: "Preview до смены прав" } })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const updateResponse = await app.request("/admin/access-profiles?testUser=tenant-admin-a", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: tenantAdminProfile.id,
        version: tenantAdminProfile.version,
        systemKey: tenantAdminProfile.systemKey,
        label: tenantAdminProfile.label,
        permissions: tenantAdminProfile.permissions,
        scopeRules: tenantAdminProfile.scopeRules.map((rule) =>
          rule.permissionKey === "risk:accept" ? { ...rule, scope: "own" } : rule
        ),
        active: tenantAdminProfile.active
      })
    });
    expect(updateResponse.status).toBe(200);

    const execute = await app.request(
      "/api/control/actions/action-accept-risk/execute?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(execute.status).toBe(403);
    const audit = await app.request("/api/control/audit?testUser=tenant-admin-a");
    await expect(readJson(audit)).resolves.toMatchObject({ actionExecutions: [] });
  });

  it("rejects cross-tenant targets and unknown actions without leaking tenant rows", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const crossTenant = await app.request(
      "/api/control/actions/action-accept-risk/preview?testUser=tenant-admin-b",
      jsonRequest({
        target,
        input: { reason: "Tenant B cannot touch Tenant A signal" }
      })
    );
    expect(crossTenant.status).toBe(404);
    const crossTenantText = await crossTenant.text();
    expect(crossTenantText).not.toContain("signal-kpi-schedule-variance-a");

    const unknown = await app.request(
      "/api/control/actions/not-an-action/preview?testUser=tenant-admin-a",
      jsonRequest({ target, input: {} })
    );
    expect(unknown.status).toBe(404);
  });

  it("executes create_corrective_action as a canonical project task with audit and portfolio readback", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    await createManagedProject(app);

    const preview = await app.request(
      "/api/control/actions/action-create-corrective-task/preview?testUser=project-manager-a",
      jsonRequest({
        target,
        input: {
          title: "Разобрать отклонение трудозатрат",
          dueDate: "2026-06-12"
        }
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string; mutatesState: boolean } };
    expect(previewBody.preview).toMatchObject({ mutatesState: false });

    const tasksBefore = await app.request("/api/projects/project-alpha-a/tasks?testUser=project-manager-a");
    expect(tasksBefore.status).toBe(200);
    await expect(readJson(tasksBefore)).resolves.toMatchObject({ tasks: [] });

    const execute = await app.request(
      "/api/control/actions/action-create-corrective-task/execute?testUser=project-manager-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    const executeText = await execute.text();
    expect(execute.status, executeText).toBe(200);
    const executeBody = JSON.parse(executeText) as {
      result: { id: string; commandType: string; target: { entityId: string } };
    };
    expect(executeBody.result).toMatchObject({
      commandType: "corrective_task.create",
      target: { entityType: "task" }
    });

    const tasksAfter = await app.request("/api/projects/project-alpha-a/tasks?testUser=project-manager-a");
    expect(tasksAfter.status).toBe(200);
    await expect(readJson(tasksAfter)).resolves.toMatchObject({
      tasks: [
        expect.objectContaining({
          id: executeBody.result.target.entityId,
          title: "Разобрать отклонение трудозатрат",
          projectId: "project-alpha-a",
          status: "todo"
        })
      ]
    });

    const controlAudit = await app.request("/api/control/audit?testUser=tenant-admin-a");
    expect(controlAudit.status).toBe(200);
    await expect(readJson(controlAudit)).resolves.toMatchObject({
      actionExecutions: [
        expect.objectContaining({
          id: executeBody.result.id,
          source: { entityType: "kpi_signal", entityId: "signal-kpi-schedule-variance-a" },
          target: { entityType: "task", entityId: executeBody.result.target.entityId },
          sourceSurface: {
            surfaceId: "portfolio-control",
            surfaceKey: "portfolio.control",
            rowId: "row-kpi-signal-kpi-schedule-variance-a",
            actionSlotKey: "create_corrective_action"
          },
          inputSummary: {
            title: "Разобрать отклонение трудозатрат",
            dueDate: "2026-06-12"
          },
          auditEventIds: expect.arrayContaining([expect.stringContaining("audit-")])
        })
      ]
    });

    const taskAudit = await app.request(
      `/api/audit?testUser=tenant-admin-a&targetType=task&targetId=${encodeURIComponent(executeBody.result.target.entityId)}`
    );
    expect(taskAudit.status).toBe(200);
    await expect(readJson(taskAudit)).resolves.toMatchObject({
      events: [expect.objectContaining({ actionKey: "corrective_task.create" })]
    });

    const view = await app.request("/api/control/surfaces/portfolio-control/view?testUser=project-manager-a");
    expect(view.status).toBe(200);
    await expect(readJson(view)).resolves.toMatchObject({
      rows: expect.arrayContaining([
        expect.objectContaining({
          id: "row-kpi-signal-kpi-schedule-variance-a",
          explanation: expect.stringContaining(executeBody.result.target.entityId),
          actions: expect.arrayContaining([
            expect.objectContaining({ key: "create_corrective_action", available: false, unavailableReason: "not_recommended" })
          ])
        })
      ])
    });

    const duplicatePreview = await app.request(
      "/api/control/actions/action-create-corrective-task/preview?testUser=project-manager-a",
      jsonRequest({
        target,
        input: {
          title: "Дубликат корректирующей задачи",
          dueDate: "2026-06-13"
        }
      })
    );
    expect(duplicatePreview.status).toBe(409);
    await expect(readJson(duplicatePreview)).resolves.toMatchObject({ code: "precondition_failed" });
  });

  it("requires preview and task.write before corrective action can create a task", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    await createManagedProject(app);

    const directExecute = await app.request(
      "/api/control/actions/action-create-corrective-task/execute?testUser=project-manager-a",
      jsonRequest({
        target,
        input: {
          title: "Прямое создание без предпросмотра",
          dueDate: "2026-06-12"
        }
      })
    );
    expect(directExecute.status).toBe(409);
    await expect(readJson(directExecute)).resolves.toMatchObject({ code: "dry_run_required" });

    const preview = await app.request(
      "/api/control/actions/action-create-corrective-task/preview?testUser=resource-manager-a",
      jsonRequest({
        target,
        input: {
          title: "Ресурсный менеджер без права task.write",
          dueDate: "2026-06-12"
        }
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const deniedExecute = await app.request(
      "/api/control/actions/action-create-corrective-task/execute?testUser=resource-manager-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(deniedExecute.status).toBe(403);
    await expect(readJson(deniedExecute)).resolves.toMatchObject({ code: "permission_denied" });

    const tasksAfterDenied = await app.request("/api/projects/project-alpha-a/tasks?testUser=project-manager-a");
    expect(tasksAfterDenied.status).toBe(200);
    await expect(readJson(tasksAfterDenied)).resolves.toMatchObject({ tasks: [] });

    const controlAudit = await app.request("/api/control/audit?testUser=tenant-admin-a");
    expect(controlAudit.status).toBe(200);
    await expect(readJson(controlAudit)).resolves.toMatchObject({ actionExecutions: [] });

    const taskAudit = await app.request("/api/audit?testUser=tenant-admin-a&targetType=task&targetId=task-corrective-denied");
    expect(taskAudit.status).toBe(200);
    await expect(readJson(taskAudit)).resolves.toMatchObject({ events: [] });
  });
});
