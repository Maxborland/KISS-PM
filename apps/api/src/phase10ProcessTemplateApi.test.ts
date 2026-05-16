import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function processDraft(label = "Внедрение enterprise") {
  return {
    label,
    stages: [
      {
        id: "stage-delivery",
        label: "Поставка",
        sortOrder: 10,
        active: true,
        taskTemplates: [
          {
            id: "task-template-delivery",
            label: "Поставить результат",
            defaultParticipantRoleKeys: ["executor", "controller"],
            required: true
          }
        ]
      },
      {
        id: "stage-initiation",
        label: "Старт",
        sortOrder: 20,
        active: true,
        taskTemplates: [
          {
            id: "task-template-kickoff",
            label: "Провести старт проекта",
            defaultParticipantRoleKeys: ["executor"],
            required: true
          }
        ]
      }
    ]
  };
}

describe("Phase 10 process template builder API", () => {
  it("previews and publishes a future process template version with audit and readback", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const initial = await app.request("/api/tenant/process-templates?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      templates: [
        expect.objectContaining({
          id: "process-template-integrations-tenant-a",
          version: 2,
          label: "Внедрение с интеграциями"
        })
      ]
    });

    const preview = await app.request(
      "/api/tenant/process-templates/preview?testUser=tenant-admin-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        expectedTemplateVersion: 2,
        draft: processDraft(),
        affectedRuntimeSurfaces: ["project.create_from_template", "project.stage.header"]
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as {
      preview: { id: string; mutatesState: false; before: { templateVersion: number }; after: { templateVersion: number } };
    };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      before: { templateVersion: 2 },
      after: { templateVersion: 3 }
    });

    const unchanged = await app.request("/api/tenant/process-templates?testUser=tenant-admin-a");
    expect(unchanged.status).toBe(200);
    await expect(readJson(unchanged)).resolves.toMatchObject({
      templates: [expect.objectContaining({ version: 2, label: "Внедрение с интеграциями" })]
    });

    const publish = await app.request(
      "/api/tenant/process-templates/publish?testUser=tenant-admin-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        previewId: previewBody.preview.id
      })
    );
    expect(publish.status).toBe(200);
    await expect(readJson(publish)).resolves.toMatchObject({
      result: {
        template: { version: 3, label: "Внедрение enterprise" },
        audit: {
          commandType: "process_template.publish",
          beforeTemplateVersion: 2,
          afterTemplateVersion: 3
        },
        actionExecution: {
          commandType: "process_template.publish",
          requiredPermission: "project.template.write"
        }
      },
      readback: {
        activeTemplate: { version: 3, label: "Внедрение enterprise" }
      }
    });

    const readback = await app.request("/api/tenant/process-templates?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      templates: [
        expect.objectContaining({
          version: 3,
          label: "Внедрение enterprise",
          stages: [
            expect.objectContaining({ id: "stage-delivery", sortOrder: 10, label: "Поставка" }),
            expect.objectContaining({ id: "stage-initiation", sortOrder: 20, label: "Старт" })
          ]
        })
      ]
    });

    const futureDraft = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=tenant-admin-a",
      jsonRequest({})
    );
    expect(futureDraft.status).toBe(201);
    const futureDraftBody = (await readJson(futureDraft)) as { projectDraft: { id: string; processTemplate: { version: number; label: string } } };
    expect(futureDraftBody.projectDraft.processTemplate).toMatchObject({
      version: 3,
      label: "Внедрение enterprise"
    });

    const futureProject = await app.request(
      "/api/projects/from-template?testUser=tenant-admin-a",
      jsonRequest({ projectDraftId: futureDraftBody.projectDraft.id, projectId: "project-p10-future-template" })
    );
    expect(futureProject.status).toBe(201);
    await expect(readJson(futureProject)).resolves.toMatchObject({
      project: {
        id: "project-p10-future-template",
        processTemplateSnapshot: { version: 3, label: "Внедрение enterprise" },
        stages: expect.arrayContaining([expect.objectContaining({ templateKey: "delivery", label: "Поставка" })])
      }
    });

    const audit = await app.request("/api/tenant/configuration/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ actionKey: "process_template.publish" })]),
      actionExecutions: expect.arrayContaining([expect.objectContaining({ commandType: "process_template.publish" })])
    });
  });

  it("denies read-only and cross-tenant publish without leaked preview or partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyRead = await app.request("/api/tenant/process-templates?testUser=readonly-observer-a");
    expect(readOnlyRead.status).toBe(200);

    const readOnlyPreview = await app.request(
      "/api/tenant/process-templates/preview?testUser=readonly-observer-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        expectedTemplateVersion: 2,
        draft: processDraft(),
        affectedRuntimeSurfaces: ["project.create_from_template"]
      })
    );
    expect(readOnlyPreview.status).toBe(403);

    const adminPreview = await app.request(
      "/api/tenant/process-templates/preview?testUser=tenant-admin-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        expectedTemplateVersion: 2,
        draft: processDraft(),
        affectedRuntimeSurfaces: ["project.create_from_template"]
      })
    );
    expect(adminPreview.status).toBe(200);
    const adminPreviewBody = (await readJson(adminPreview)) as { preview: { id: string } };

    const tenantBPublish = await app.request(
      "/api/tenant/process-templates/publish?testUser=tenant-admin-b",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        previewId: adminPreviewBody.preview.id
      })
    );
    expect(tenantBPublish.status).toBe(404);
    expect(await tenantBPublish.text()).not.toContain(adminPreviewBody.preview.id);

    const afterDenied = await app.request("/api/tenant/process-templates?testUser=tenant-admin-a");
    expect(afterDenied.status).toBe(200);
    await expect(readJson(afterDenied)).resolves.toMatchObject({
      templates: [expect.objectContaining({ version: 2, label: "Внедрение с интеграциями" })]
    });
  });

  it("rejects unsafe drafts and stale previews without partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const invalid = await app.request(
      "/api/tenant/process-templates/preview?testUser=tenant-admin-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        expectedTemplateVersion: 2,
        draft: {
          stages: [
            { id: "stage-initiation", active: false },
            { id: "stage-delivery", active: false }
          ]
        },
        affectedRuntimeSurfaces: ["project.create_from_template"]
      })
    );
    expect(invalid.status).toBe(400);

    const firstPreview = await app.request(
      "/api/tenant/process-templates/preview?testUser=tenant-admin-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        expectedTemplateVersion: 2,
        draft: processDraft("Первый вариант"),
        affectedRuntimeSurfaces: ["project.create_from_template"]
      })
    );
    expect(firstPreview.status).toBe(200);
    const firstPreviewBody = (await readJson(firstPreview)) as { preview: { id: string } };

    const secondPreview = await app.request(
      "/api/tenant/process-templates/preview?testUser=tenant-admin-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        expectedTemplateVersion: 2,
        draft: processDraft("Второй вариант"),
        affectedRuntimeSurfaces: ["project.create_from_template"]
      })
    );
    expect(secondPreview.status).toBe(200);
    const secondPreviewBody = (await readJson(secondPreview)) as { preview: { id: string } };
    const secondPublish = await app.request(
      "/api/tenant/process-templates/publish?testUser=tenant-admin-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        previewId: secondPreviewBody.preview.id
      })
    );
    expect(secondPublish.status).toBe(200);

    const stalePublish = await app.request(
      "/api/tenant/process-templates/publish?testUser=tenant-admin-a",
      jsonRequest({
        templateId: "process-template-integrations-tenant-a",
        previewId: firstPreviewBody.preview.id
      })
    );
    expect(stalePublish.status).toBe(409);
    await expect(readJson(stalePublish)).resolves.toMatchObject({ code: "stale_preview" });

    const readback = await app.request("/api/tenant/process-templates?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      templates: [expect.objectContaining({ version: 3, label: "Второй вариант" })]
    });
  });
});
