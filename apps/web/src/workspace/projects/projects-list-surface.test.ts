import { describe, expect, it } from "vitest";

import type { ProjectRecord } from "@/workspace/lib/workspace-client";
import { getVisibleProjects, PROJECTS_LIST_AVAILABLE_FILTERS } from "./projects-list-surface";

const project = (overrides: Partial<ProjectRecord>): ProjectRecord => {
  const base: ProjectRecord = {
    id: "project-1",
    tenantId: "tenant-alpha",
    sourceType: "opportunity",
    sourceOpportunityId: null,
    clientId: "client-1",
    projectTypeId: null,
    title: "Project 1",
    clientName: "Client 1",
    status: "active",
    plannedStart: "2026-01-01",
    plannedFinish: "2026-02-01",
    contractValue: 1_000_000,
    plannedHours: 100,
    templateId: null,
    demand: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    activatedAt: "2026-01-01T00:00:00.000Z",
    closedAt: null
  };
  return { ...base, ...overrides };
};

describe("projects list honest scope", () => {
  it("only exposes filters backed by the active-projects API contract", () => {
    expect(PROJECTS_LIST_AVAILABLE_FILTERS).toEqual([{ value: "active", label: "Активные" }]);
  });

  it("shows active projects only", () => {
    const visible = getVisibleProjects([
      project({ id: "active-project", status: "active" }),
      project({ id: "closed-project", status: "closed" })
    ]);

    expect(visible.map((p) => p.id)).toEqual(["active-project"]);
  });
});
