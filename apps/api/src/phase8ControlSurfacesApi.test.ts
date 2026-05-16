import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

describe("Phase 8 control surface read API", () => {
  it("returns deterministic Portfolio Control read DTOs with severity, source refs, drilldowns, and permission-scoped actions", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request("/api/control/surfaces/portfolio-control/view?testUser=project-manager-a");
    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toMatchObject({
      surface: {
        id: "portfolio-control",
        key: "portfolio.control",
        tenantId: "tenant-a",
        viewType: "hybrid"
      },
      rows: expect.arrayContaining([
        expect.objectContaining({
          id: "row-kpi-signal-kpi-schedule-variance-a",
          severity: "critical",
          sourceRefs: expect.arrayContaining([
            { entityType: "project", entityId: "project-alpha-a" },
            { entityType: "kpi_signal", entityId: "signal-kpi-schedule-variance-a" }
          ]),
          drilldowns: expect.arrayContaining([expect.objectContaining({ key: "open_project_gantt", href: "/projects/project-alpha-a/gantt" })]),
          actions: expect.arrayContaining([
            expect.objectContaining({ key: "create_corrective_action", available: true }),
            expect.objectContaining({ key: "accept_risk", available: false, unavailableReason: "permission_denied" })
          ])
        }),
        expect.objectContaining({
          id: "row-resource-overload-resource-architect-a",
          severity: "critical",
          sourceRefs: expect.arrayContaining([
            { entityType: "resource_overload", entityId: "overload:resource-architect-a:2026-06-01:2026-06-05" }
          ])
        })
      ]),
      widgets: expect.arrayContaining([expect.objectContaining({ key: "critical_signal_count", value: expect.any(Number) })])
    });
  });

  it("allows read-only users to read rows but exposes no executable mutation path", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request("/api/control/surfaces/portfolio-control/view?testUser=readonly-observer-a");
    expect(response.status).toBe(200);
    const body = (await readJson(response)) as { rows: Array<{ actions: Array<{ available: boolean; executeUrl?: string }> }> };

    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.rows.flatMap((row) => row.actions).every((action) => action.available === false)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("/execute");
  });

  it("uses backend policy scope when exposing row action and drilldown availability", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const profilesResponse = await app.request("/admin/access-profiles?testUser=tenant-admin-a");
    expect(profilesResponse.status).toBe(200);
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
    const projectManagerProfile = profilesBody.profiles.find((profile) => profile.systemKey === "project_manager");
    expect(projectManagerProfile).toBeDefined();

    const updateResponse = await app.request("/admin/access-profiles?testUser=tenant-admin-a", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: projectManagerProfile!.id,
        version: projectManagerProfile!.version,
        systemKey: projectManagerProfile!.systemKey,
        label: projectManagerProfile!.label,
        permissions: projectManagerProfile!.permissions,
        scopeRules: projectManagerProfile!.scopeRules.map((rule) =>
          rule.permissionKey === "control.action:write" || rule.permissionKey === "schedule:read"
            ? { ...rule, scope: "own" }
            : rule
        ),
        active: projectManagerProfile!.active
      })
    });
    expect(updateResponse.status).toBe(200);

    const response = await app.request("/api/control/surfaces/portfolio-control/view?testUser=project-manager-a");
    expect(response.status).toBe(200);
    const body = (await readJson(response)) as {
      rows: Array<{
        id: string;
        actions: Array<{ key: string; available: boolean; unavailableReason?: string }>;
        drilldowns: Array<{ key: string; available: boolean; unavailableReason?: string }>;
      }>;
    };
    const criticalRow = body.rows.find((row) => row.id === "row-kpi-signal-kpi-schedule-variance-a");
    expect(criticalRow).toBeDefined();
    expect(criticalRow!.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "create_corrective_action",
          available: false,
          unavailableReason: "permission_denied"
        })
      ])
    );
    expect(criticalRow!.drilldowns).toEqual([
      expect.objectContaining({
        key: "open_project_gantt",
        available: false,
        unavailableReason: "permission_denied"
      })
    ]);
  });

  it("does not leak tenant-private surfaces or rows across tenants", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const tenantBList = await app.request("/api/control/surfaces?testUser=tenant-admin-b");
    expect(tenantBList.status).toBe(200);
    const listText = await tenantBList.text();
    expect(listText).not.toContain("project-alpha-a");
    expect(listText).not.toContain("signal-kpi-schedule-variance-a");

    const tenantBPortfolio = await app.request("/api/control/surfaces/portfolio-control/view?testUser=tenant-admin-b");
    expect(tenantBPortfolio.status).toBe(200);
    const bodyText = await tenantBPortfolio.text();
    expect(bodyText).toContain("project-private-b");
    expect(bodyText).not.toContain("project-alpha-a");
  });

  it("returns not_found for malformed or unknown surface ids without source data leakage", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request("/api/control/surfaces/not-a-surface/view?testUser=project-manager-a");
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).not.toContain("project-alpha-a");
  });

  it("rejects malformed pagination without partial row leakage", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request("/api/control/surfaces/portfolio-control/view?testUser=project-manager-a&offset=abc");
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).not.toContain("project-alpha-a");
  });
});
