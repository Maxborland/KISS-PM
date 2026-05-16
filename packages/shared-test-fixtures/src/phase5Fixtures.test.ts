import { describe, expect, it } from "vitest";

import { getPhase5FixtureSeed, PHASE5_FIXTURE_TIMESTAMP } from "./phase5Fixtures";

describe("Phase 5 deterministic scheduling fixture seed", () => {
  it("provides stable project, task, dependency, baseline, and E2E identifiers", () => {
    const seed = getPhase5FixtureSeed();

    expect(seed.generatedAt).toBe(PHASE5_FIXTURE_TIMESTAMP);
    expect(seed.tenantA.projectId).toBe("project-phase4-main");
    expect(seed.tenantA.tasks.map((task) => task.id)).toEqual([
      "task-phase5-e2e-kickoff",
      "task-phase5-e2e-delivery",
      "task-phase5-e2e-review"
    ]);
    expect(seed.tenantA.validDependency).toEqual({
      id: "dependency-phase5-e2e-kickoff-delivery",
      predecessorTaskId: "task-phase5-e2e-kickoff",
      successorTaskId: "task-phase5-e2e-delivery",
      type: "finish_to_start"
    });
    expect(seed.tenantA.baselineId).toBe("baseline-project-phase4-main-draft");
    expect(seed.tenantB.projectId).toBe("project-phase5-tenant-b-private");
    expect(seed.e2eIds).toEqual(["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"]);
  });

  it("returns defensive copies so E2E tests cannot contaminate later resets", () => {
    const seed = getPhase5FixtureSeed();

    seed.tenantA.tasks[0].plannedStartDate = "2099-01-01";
    seed.tenantA.tasks.push({
      id: "mutated-task",
      stageKey: "delivery",
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2099-01-02",
      plannedFinishDate: "2099-01-03",
      plannedWorkHours: 1,
      progressPercent: 1
    });

    const nextSeed = getPhase5FixtureSeed();

    expect(nextSeed.tenantA.tasks[0]?.plannedStartDate).toBe("2026-06-01");
    expect(nextSeed.tenantA.tasks.map((task) => task.id)).not.toContain("mutated-task");
  });
});
