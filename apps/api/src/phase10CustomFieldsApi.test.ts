import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

const draft = {
  id: "cf-project-risk-level",
  targetEntityType: "project",
  key: "risk_level",
  label: "Уровень риска",
  valueType: "single_select",
  required: false,
  active: true,
  validationRules: { options: ["low", "medium", "high"] },
  visibilityRules: [{ surfaceKey: "portfolio.control", visible: true }],
  permissionRules: { readPermissionKey: "project.read", writePermissionKey: "custom_field.write" },
  bindingFlags: {
    usableInFilters: true,
    usableInControlSurfaces: true,
    usableInKpiSourceBindings: false
  }
};

async function createManagedProject(app: ReturnType<typeof createApiApp>, projectId = "project-p10-custom-field") {
  const draftResponse = await app.request(
    "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=tenant-admin-a",
    jsonRequest({})
  );
  expect(draftResponse.status).toBe(201);
  const draftBody = (await readJson(draftResponse)) as { projectDraft: { id: string } };
  const projectResponse = await app.request(
    "/api/projects/from-template?testUser=tenant-admin-a",
    jsonRequest({ projectDraftId: draftBody.projectDraft.id, projectId })
  );
  expect(projectResponse.status).toBe(201);
  return projectId;
}

describe("Phase 10 custom field builder API", () => {
  it("previews and publishes a project custom field, then binds project values into portfolio control readback", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const projectId = await createManagedProject(app);

    const initial = await app.request("/api/tenant/custom-fields?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      registry: { version: 1, definitions: [] }
    });

    const preview = await app.request(
      "/api/tenant/custom-fields/preview?testUser=tenant-admin-a",
      jsonRequest({
        expectedRegistryVersion: 1,
        draft,
        affectedRuntimeSurfaces: ["portfolio.control"]
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string; mutatesState: false } };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      before: { registryVersion: 1, definitionCount: 0 },
      after: { registryVersion: 2, definitionCount: 1 }
    });

    const unchanged = await app.request("/api/tenant/custom-fields?testUser=tenant-admin-a");
    expect(unchanged.status).toBe(200);
    await expect(readJson(unchanged)).resolves.toMatchObject({
      registry: { version: 1, definitions: [] }
    });

    const publish = await app.request(
      "/api/tenant/custom-fields/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(publish.status).toBe(200);
    await expect(readJson(publish)).resolves.toMatchObject({
      result: {
        registry: {
          version: 2,
          definitions: [expect.objectContaining({ id: "cf-project-risk-level", key: "risk_level" })]
        },
        audit: {
          commandType: "custom_field.publish",
          beforeRegistryVersion: 1,
          afterRegistryVersion: 2
        },
        actionExecution: {
          commandType: "custom_field.publish",
          requiredPermission: "custom_field.write"
        }
      },
      readback: { registry: { version: 2 } }
    });

    const valueWrite = await app.request(
      `/api/projects/${projectId}/custom-fields/risk_level?testUser=project-manager-a`,
      jsonRequest({ value: "high" }, "PUT")
    );
    expect(valueWrite.status).toBe(200);
    await expect(readJson(valueWrite)).resolves.toMatchObject({
      result: {
        valueRecord: {
          projectId,
          fieldKey: "risk_level",
          value: "high",
          definitionVersion: 1
        },
        actionExecution: {
          commandType: "project.custom_field.set",
          requiredPermission: "custom_field.write"
        }
      },
      readback: {
        project: {
          id: projectId,
          customFieldValues: [expect.objectContaining({ fieldKey: "risk_level", value: "high" })]
        }
      }
    });

    const surface = await app.request("/api/control/surfaces/portfolio-control/view?testUser=tenant-admin-a");
    expect(surface.status).toBe(200);
    await expect(readJson(surface)).resolves.toMatchObject({
      fields: expect.arrayContaining([expect.objectContaining({ key: "custom.risk_level", label: "Уровень риска" })]),
      rows: expect.arrayContaining([
        expect.objectContaining({
          fieldValues: expect.objectContaining({ "custom.risk_level": "high" })
        })
      ])
    });

    const audit = await app.request("/api/tenant/configuration/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({ actionKey: "custom_field.publish" }),
        expect.objectContaining({ actionKey: "project.custom_field.set" })
      ]),
      actionExecutions: expect.arrayContaining([
        expect.objectContaining({ commandType: "custom_field.publish" }),
        expect.objectContaining({ commandType: "project.custom_field.set" })
      ])
    });
  });

  it("denies read-only and Tenant B publish/value writes without leaking state", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const projectId = await createManagedProject(app, "project-p10-custom-field-denial");

    const readOnlyPreview = await app.request(
      "/api/tenant/custom-fields/preview?testUser=readonly-observer-a",
      jsonRequest({ expectedRegistryVersion: 1, draft, affectedRuntimeSurfaces: ["portfolio.control"] })
    );
    expect(readOnlyPreview.status).toBe(403);

    const preview = await app.request(
      "/api/tenant/custom-fields/preview?testUser=tenant-admin-a",
      jsonRequest({ expectedRegistryVersion: 1, draft, affectedRuntimeSurfaces: ["portfolio.control"] })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const tenantBPublish = await app.request(
      "/api/tenant/custom-fields/publish?testUser=tenant-admin-b",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(tenantBPublish.status).toBe(409);
    expect(await tenantBPublish.text()).not.toContain(previewBody.preview.id);

    const publish = await app.request(
      "/api/tenant/custom-fields/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(publish.status).toBe(200);

    const readOnlyValue = await app.request(
      `/api/projects/${projectId}/custom-fields/risk_level?testUser=readonly-observer-a`,
      jsonRequest({ value: "high" }, "PUT")
    );
    expect(readOnlyValue.status).toBe(403);

    const tenantBValue = await app.request(
      `/api/projects/${projectId}/custom-fields/risk_level?testUser=tenant-admin-b`,
      jsonRequest({ value: "high" }, "PUT")
    );
    expect(tenantBValue.status).toBe(404);

    const readback = await app.request(`/api/projects/${projectId}?testUser=tenant-admin-a`);
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      project: { customFieldValues: [] }
    });
  });

  it("enforces custom field definition write permission on project value writes", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const projectId = await createManagedProject(app, "project-p10-custom-field-permission");
    const restrictedDraft = {
      ...draft,
      id: "cf-project-review-gate",
      key: "review_gate",
      label: "Ревизионный уровень",
      permissionRules: { readPermissionKey: "project.read", writePermissionKey: "tenant.config.import" }
    };

    const preview = await app.request(
      "/api/tenant/custom-fields/preview?testUser=tenant-admin-a",
      jsonRequest({ expectedRegistryVersion: 1, draft: restrictedDraft, affectedRuntimeSurfaces: ["portfolio.control"] })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };
    const publish = await app.request(
      "/api/tenant/custom-fields/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(publish.status).toBe(200);

    const projectManagerWrite = await app.request(
      `/api/projects/${projectId}/custom-fields/review_gate?testUser=project-manager-a`,
      jsonRequest({ value: "high" }, "PUT")
    );
    expect(projectManagerWrite.status).toBe(403);

    const tenantAdminWrite = await app.request(
      `/api/projects/${projectId}/custom-fields/review_gate?testUser=tenant-admin-a`,
      jsonRequest({ value: "high" }, "PUT")
    );
    expect(tenantAdminWrite.status).toBe(200);
    await expect(readJson(tenantAdminWrite)).resolves.toMatchObject({
      result: {
        actionExecution: {
          commandType: "project.custom_field.set",
          requiredPermission: "tenant.config.import"
        }
      },
      readback: {
        project: {
          customFieldValues: [expect.objectContaining({ fieldKey: "review_gate", value: "high" })]
        }
      }
    });
  });

  it("rejects invalid custom field definitions and values without partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const projectId = await createManagedProject(app, "project-p10-custom-field-invalid");

    const invalidPreview = await app.request(
      "/api/tenant/custom-fields/preview?testUser=tenant-admin-a",
      jsonRequest({
        expectedRegistryVersion: 1,
        draft: { ...draft, targetEntityType: "task" },
        affectedRuntimeSurfaces: ["portfolio.control"]
      })
    );
    expect(invalidPreview.status).toBe(400);

    const preview = await app.request(
      "/api/tenant/custom-fields/preview?testUser=tenant-admin-a",
      jsonRequest({ expectedRegistryVersion: 1, draft, affectedRuntimeSurfaces: ["portfolio.control"] })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };
    const publish = await app.request(
      "/api/tenant/custom-fields/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(publish.status).toBe(200);

    const invalidValue = await app.request(
      `/api/projects/${projectId}/custom-fields/risk_level?testUser=project-manager-a`,
      jsonRequest({ value: "urgent" }, "PUT")
    );
    expect(invalidValue.status).toBe(400);

    const readback = await app.request(`/api/projects/${projectId}?testUser=tenant-admin-a`);
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      project: { customFieldValues: [] }
    });
  });
});
