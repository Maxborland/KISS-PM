import { describe, expect, it } from "vitest";

import type { ProjectRecord } from "@/workspace/lib/workspace-client";
import { getVisibleProjects, projectsErrorMessage, PROJECTS_LIST_AVAILABLE_FILTERS } from "./projects-list-surface";

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
  it("exposes exactly the status filters backed by the API ?status contract", () => {
    expect(PROJECTS_LIST_AVAILABLE_FILTERS).toEqual([
      { value: "active", label: "Активные" },
      { value: "paused", label: "Приостановленные" },
      { value: "closed", label: "Закрытые" },
      { value: "all", label: "Все" }
    ]);
  });

  it("does not expose raw network errors", () => {
    expect(projectsErrorMessage("load_failed")).toBe("Не удалось загрузить проекты");
    expect(projectsErrorMessage("invalid_json_response")).toBe("Некорректный ответ сервера");
    expect(projectsErrorMessage("Failed to fetch internal.example")).toBe("Запрос не выполнен");
  });

  it("passes projects through unchanged (server applies the status filter)", () => {
    const visible = getVisibleProjects([
      project({ id: "active-project", status: "active" }),
      project({ id: "closed-project", status: "closed" })
    ]);

    expect(visible.map((p) => p.id)).toEqual(["active-project", "closed-project"]);
  });
});
