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

const target = {
  surfaceId: "portfolio-control",
  surfaceKey: "portfolio.control",
  rowId: "row-kpi-signal-kpi-schedule-variance-a",
  entityType: "kpi_signal",
  entityId: "signal-kpi-schedule-variance-a"
};

describe("Phase 10 action configuration API", () => {
  it("previews and publishes disabled action config with runtime readback and audit evidence", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const initial = await app.request("/api/tenant/action-configs?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      configuration: { version: 1 },
      actions: expect.arrayContaining([
        expect.objectContaining({ key: "accept_risk", enabled: true })
      ])
    });

    const preview = await app.request(
      "/api/tenant/action-configs/preview?testUser=tenant-admin-a",
      jsonRequest({
        expectedVersion: 1,
        actionConfigs: [
          {
            actionKey: "accept_risk",
            enabled: false,
            formFields: [{ fieldKey: "reason", label: "Причина принятия риска", defaultValue: "Риск принят до комитета" }]
          }
        ],
        affectedRuntimeSurfaces: ["portfolio.control"]
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      before: { version: 1, disabledActionKeys: [] },
      after: { version: 2, disabledActionKeys: ["accept_risk"] }
    });

    const unchanged = await app.request("/api/tenant/action-configs?testUser=tenant-admin-a");
    await expect(readJson(unchanged)).resolves.toMatchObject({
      configuration: { version: 1 },
      actions: expect.arrayContaining([expect.objectContaining({ key: "accept_risk", enabled: true })])
    });

    const publish = await app.request(
      "/api/tenant/action-configs/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(publish.status).toBe(200);
    await expect(readJson(publish)).resolves.toMatchObject({
      result: {
        audit: {
          commandType: "action_configuration.publish",
          beforeVersion: 1,
          afterVersion: 2
        },
        actionExecution: {
          commandType: "action_configuration.publish",
          requiredPermission: "action.config.write"
        }
      },
      readback: {
        configuration: { version: 2 },
        actions: expect.arrayContaining([
          expect.objectContaining({
            key: "accept_risk",
            enabled: false,
            disabledReason: "configuration_disabled"
          })
        ])
      }
    });

    const view = await app.request("/api/control/surfaces/portfolio-control/view?testUser=tenant-admin-a");
    expect(view.status).toBe(200);
    await expect(readJson(view)).resolves.toMatchObject({
      rows: expect.arrayContaining([
        expect.objectContaining({
          id: target.rowId,
          actions: expect.arrayContaining([
            expect.objectContaining({ key: "accept_risk", available: false, unavailableReason: "configuration_disabled" })
          ])
        })
      ])
    });

    const directPreview = await app.request(
      "/api/control/actions/action-accept-risk/preview?testUser=tenant-admin-a",
      jsonRequest({ target, input: { reason: "Не должен пройти" } })
    );
    expect(directPreview.status).toBe(403);

    const audit = await app.request("/api/tenant/configuration/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ actionKey: "action_configuration.publish" })]),
      actionExecutions: expect.arrayContaining([expect.objectContaining({ commandType: "action_configuration.publish" })])
    });
  });

  it("denies read-only and Tenant B publishes and rejects invalid form defaults without mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyPreview = await app.request(
      "/api/tenant/action-configs/preview?testUser=readonly-observer-a",
      jsonRequest({
        expectedVersion: 1,
        actionConfigs: [{ actionKey: "accept_risk", enabled: false, formFields: [] }],
        affectedRuntimeSurfaces: ["portfolio.control"]
      })
    );
    expect(readOnlyPreview.status).toBe(403);

    const preview = await app.request(
      "/api/tenant/action-configs/preview?testUser=tenant-admin-a",
      jsonRequest({
        expectedVersion: 1,
        actionConfigs: [{ actionKey: "accept_risk", enabled: false, formFields: [] }],
        affectedRuntimeSurfaces: ["portfolio.control"]
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const tenantBPublish = await app.request(
      "/api/tenant/action-configs/publish?testUser=tenant-admin-b",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(tenantBPublish.status).toBe(409);
    expect(await tenantBPublish.text()).not.toContain(previewBody.preview.id);

    const invalidPreview = await app.request(
      "/api/tenant/action-configs/preview?testUser=tenant-admin-a",
      jsonRequest({
        expectedVersion: 1,
        actionConfigs: [
          {
            actionKey: "accept_risk",
            enabled: true,
            formFields: [{ fieldKey: "expiresAt", defaultValue: "not-a-date" }]
          }
        ],
        affectedRuntimeSurfaces: ["portfolio.control"]
      })
    );
    expect(invalidPreview.status).toBe(400);

    const readback = await app.request("/api/tenant/action-configs?testUser=tenant-admin-a");
    await expect(readJson(readback)).resolves.toMatchObject({
      configuration: { version: 1 },
      actions: expect.arrayContaining([expect.objectContaining({ key: "accept_risk", enabled: true })])
    });
  });
});
