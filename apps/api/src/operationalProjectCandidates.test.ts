import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource, ProjectRecord } from "./apiTypes";
import {
  listOperationalProjectCandidates,
  operationalProjectCandidateHydrationLimit
} from "./operationalProjectCandidates";

describe("operational project candidate selection", () => {
  it("ranks overdue projects before applying the bounded hydration cap", async () => {
    const asOf = new Date("2026-06-10T00:00:00.000Z");
    const requestedOptions: Array<{
      statuses?: Array<"active" | "paused">;
      asOf?: Date;
      limit?: number;
    }> = [];
    const currentProjects = Array.from({ length: operationalProjectCandidateHydrationLimit }, (_, index) =>
      makeProject({
        id: `current-${index}`,
        activatedAt: new Date(Date.UTC(2026, 4, 1, 0, index % 60)),
        createdAt: new Date(Date.UTC(2026, 3, 1, 0, index % 60)),
        plannedFinish: new Date("2026-06-30T00:00:00.000Z")
      })
    );
    const overdueProject = makeProject({
      id: "overdue-outside-response-cap",
      activatedAt: new Date("2026-01-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-01T00:00:00.000Z")
    });
    const draftProject = makeProject({
      id: "draft-overdue",
      status: "draft",
      plannedFinish: new Date("2026-05-01T00:00:00.000Z")
    });
    const otherTenantProject = makeProject({
      id: "other-tenant-overdue",
      tenantId: "tenant-2",
      plannedFinish: new Date("2026-05-01T00:00:00.000Z")
    });
    const dataSource: Pick<ApiTenantDataSource, "listOperationalQueueProjects" | "listProjects"> = {
      async listOperationalQueueProjects(_tenantId, options) {
        requestedOptions.push(options ?? {});
        return [...currentProjects, overdueProject, draftProject, otherTenantProject];
      }
    };

    const selected = await listOperationalProjectCandidates({ dataSource, tenantId: "tenant-1", asOf });

    expect(requestedOptions).toEqual([
      {
        statuses: ["active", "paused"],
        asOf,
        limit: operationalProjectCandidateHydrationLimit
      }
    ]);
    expect(selected).toHaveLength(operationalProjectCandidateHydrationLimit);
    expect(selected[0]?.id).toBe("overdue-outside-response-cap");
    expect(selected.some((project) => project.id === "draft-overdue")).toBe(false);
    expect(selected.some((project) => project.id === "other-tenant-overdue")).toBe(false);
  });

  it("falls back to listProjects while still capping hydration candidates", async () => {
    const asOf = new Date("2026-06-10T00:00:00.000Z");
    const dataSource: Pick<ApiTenantDataSource, "listOperationalQueueProjects" | "listProjects"> = {
      async listProjects() {
        return Array.from({ length: operationalProjectCandidateHydrationLimit + 1 }, (_, index) =>
          makeProject({ id: `fallback-${index}` })
        );
      }
    };

    const selected = await listOperationalProjectCandidates({ dataSource, tenantId: "tenant-1", asOf });

    expect(selected).toHaveLength(operationalProjectCandidateHydrationLimit);
  });
});

function makeProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  const now = new Date("2026-05-01T00:00:00.000Z");
  return {
    id: "project-1",
    tenantId: "tenant-1",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title: "Project",
    clientName: "Client",
    status: "active",
    plannedStart: now,
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 0,
    plannedHours: 0,
    templateId: null,
    createdAt: now,
    activatedAt: now,
    closedAt: null,
    demand: [],
    ...overrides
  };
}
