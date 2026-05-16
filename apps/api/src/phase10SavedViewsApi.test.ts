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

const layoutDraft = {
  surfaceId: "portfolio-control",
  expectedSurfaceVersion: 1,
  viewLabel: "Портфель без технических полей",
  visibleFieldKeys: ["project_label", "signal_label", "severity"],
  filterKeys: ["severity"],
  sortKeys: ["project_label"],
  groupKeys: ["severity"],
  widgetKeys: ["critical_signal_count"],
  actionSlotKeys: ["create_corrective_action", "accept_risk"],
  savedView: {
    id: "saved-view-critical-portfolio",
    key: "critical_portfolio",
    label: "Критичный портфель",
    ownerType: "tenant",
    filterKeys: ["severity"],
    sortKeys: ["project_label"],
    groupKeys: ["severity"],
    scope: "tenant"
  },
  affectedRuntimeSurfaces: ["portfolio.control"]
};

describe("Phase 10 saved views and layout builder API", () => {
  it("previews and publishes a saved-view layout, then refreshes portfolio readback and audit evidence", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const initial = await app.request("/api/tenant/saved-views?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      activeSurface: {
        id: "portfolio-control",
        version: 1,
        view: {
          savedViews: []
        }
      },
      previousVersions: []
    });

    const preview = await app.request("/api/tenant/saved-views/preview?testUser=tenant-admin-a", jsonRequest(layoutDraft));
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string; mutatesState: false } };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      before: { surfaceVersion: 1, viewVersion: 1 },
      after: {
        surfaceVersion: 2,
        viewVersion: 2,
        visibleFieldKeys: ["project_label", "signal_label", "severity"],
        savedViewKeys: ["critical_portfolio"]
      },
      unavailable: {
        fields: expect.arrayContaining(["primary_assignment_id", "suggested_resource_profile_id"])
      }
    });

    const unchanged = await app.request("/api/tenant/saved-views?testUser=tenant-admin-a");
    expect(unchanged.status).toBe(200);
    await expect(readJson(unchanged)).resolves.toMatchObject({
      activeSurface: { version: 1, view: { savedViews: [] } }
    });

    const publish = await app.request(
      "/api/tenant/saved-views/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(publish.status).toBe(200);
    await expect(readJson(publish)).resolves.toMatchObject({
      result: {
        surface: {
          version: 2,
          view: {
            label: "Портфель без технических полей",
            savedViews: [expect.objectContaining({ key: "critical_portfolio", groupKeys: ["severity"] })]
          }
        },
        audit: {
          commandType: "control_surface_layout.publish",
          beforeSurfaceVersion: 1,
          afterSurfaceVersion: 2,
          savedViewKey: "critical_portfolio"
        },
        actionExecution: {
          commandType: "control_surface_layout.publish",
          requiredPermission: "control_surface.config.write"
        }
      },
      readback: {
        activeSurface: { version: 2 },
        previousVersions: [expect.objectContaining({ version: 1 })]
      }
    });

    const readback = await app.request("/api/tenant/saved-views?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      activeSurface: { version: 2, view: { savedViews: [expect.objectContaining({ key: "critical_portfolio" })] } },
      previousVersions: [expect.objectContaining({ version: 1 })]
    });

    const surface = await app.request("/api/control/surfaces/portfolio-control/view?testUser=tenant-admin-a");
    expect(surface.status).toBe(200);
    await expect(readJson(surface)).resolves.toMatchObject({
      surface: { version: 2 },
      fields: [
        expect.objectContaining({ key: "project_label" }),
        expect.objectContaining({ key: "signal_label" }),
        expect.objectContaining({ key: "severity" })
      ],
      savedViews: [expect.objectContaining({ key: "critical_portfolio", scope: "tenant" })]
    });

    const audit = await app.request("/api/tenant/configuration/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ actionKey: "control_surface_layout.publish" })]),
      actionExecutions: expect.arrayContaining([
        expect.objectContaining({ commandType: "control_surface_layout.publish" })
      ])
    });
  });

  it("denies read-only and Tenant B publish attempts without leaking preview state", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyPreview = await app.request(
      "/api/tenant/saved-views/preview?testUser=readonly-observer-a",
      jsonRequest(layoutDraft)
    );
    expect(readOnlyPreview.status).toBe(403);

    const preview = await app.request("/api/tenant/saved-views/preview?testUser=tenant-admin-a", jsonRequest(layoutDraft));
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const tenantBPublish = await app.request(
      "/api/tenant/saved-views/publish?testUser=tenant-admin-b",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(tenantBPublish.status).toBe(409);
    expect(await tenantBPublish.text()).not.toContain(previewBody.preview.id);

    const afterDenied = await app.request("/api/tenant/saved-views?testUser=tenant-admin-a");
    expect(afterDenied.status).toBe(200);
    await expect(readJson(afterDenied)).resolves.toMatchObject({
      activeSurface: { version: 1, view: { savedViews: [] } }
    });
  });

  it("rejects invalid layouts without partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const invalidPreview = await app.request(
      "/api/tenant/saved-views/preview?testUser=tenant-admin-a",
      jsonRequest({ ...layoutDraft, visibleFieldKeys: ["project_label", "missing_field"] })
    );
    expect(invalidPreview.status).toBe(400);
    expect(await invalidPreview.text()).toContain("Некорректный запрос");

    const readback = await app.request("/api/tenant/saved-views?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      activeSurface: { version: 1, view: { savedViews: [] } }
    });
  });
});
