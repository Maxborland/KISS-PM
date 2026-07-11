import { describe, expect, it } from "vitest";

import {
  applyPlanDeltaToSnapshot,
  proposePlanningScenarios,
  type ScenarioProposal
} from "./scenarioPlanning";
import { buildResourceLoadMatrix, type ResourceLoadMatrix } from "./resourcePlanning";
import { calculatePlan } from "./schedulingEngine";
import type { PlanSnapshot } from "./types";

describe("scenario planning", () => {
  it("returns aggressive, balanced and resilient proposals with proven effects", () => {
    const snapshot = createOverloadedSnapshot();
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });
    const proposals = proposePlanningScenarios({
      snapshot,
      calculatedPlan,
      resourceLoad,
      target: {
        type: "resource_overload",
        resourceId: "resource-alpha",
        date: "2026-06-01",
        overloadMinutes: 480,
        taskIds: ["task-a"]
      }
    });

    expect(proposals.map((proposal) => proposal.profile)).toEqual([
      "aggressive",
      "balanced",
      "resilient"
    ]);
    expect(proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profile: "aggressive", conflictEffect: "accepted" }),
        expect.objectContaining({ profile: "balanced", conflictEffect: "reduced" }),
        expect.objectContaining({ profile: "resilient", conflictEffect: "removed" })
      ])
    );
    expect(proposals.find((proposal) => proposal.profile === "balanced")?.explainability)
      .toMatchObject({
        overloadMinutes: 240,
        overloadedResourceIds: ["resource-alpha"]
      });
    expect(proposals.find((proposal) => proposal.profile === "resilient")?.explainability)
      .toMatchObject({
        overloadMinutes: 0,
        overloadedResourceIds: []
      });

    for (const proposal of proposals) {
      assertProposalEffect(snapshot, proposal);
    }
  });

  it("does not mark reassignment proposals as fixes when they move overload to another resource", () => {
    const snapshot = {
      ...createOverloadedSnapshot(),
      reservations: [
        {
          id: "reservation-beta",
          resourceId: "resource-beta",
          projectId: "project-beta",
          start: "2026-06-01",
          finish: "2026-06-01",
          workMinutes: 480,
          reason: "support"
        }
      ]
    };
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });

    const proposals = proposePlanningScenarios({
      snapshot,
      calculatedPlan,
      resourceLoad,
      target: {
        type: "resource_overload",
        resourceId: "resource-alpha",
        date: "2026-06-01",
        overloadMinutes: 480,
        taskIds: ["task-a"]
      }
    });

    expect(proposals.map((proposal) => proposal.profile)).toEqual([
      "aggressive",
      "balanced",
      "resilient"
    ]);
    expect(proposals.find((proposal) => proposal.profile === "balanced")).toMatchObject({
      availability: "unavailable",
      unavailableReason: "alternate_resource_has_insufficient_capacity",
      planDelta: { commands: [] }
    });
    expect(proposals.find((proposal) => proposal.profile === "resilient")).toMatchObject({
      availability: "unavailable",
      unavailableReason: "alternate_resource_has_insufficient_capacity",
      planDelta: { commands: [] }
    });
  });

  // Регресс BUG-PROJ-25: переназначение не предлагает ресурс ДРУГОЙ позиции (посторонний).
  it("does not reassign overload to a resource of a different position", () => {
    const base = createOverloadedSnapshot();
    // единственный альтернативный ресурс — другой позиции (analyst, а перегружен engineer)
    const snapshot: PlanSnapshot = {
      ...base,
      resources: base.resources.map((resource) =>
        resource.id === "resource-beta" ? { ...resource, positionId: "analyst" } : resource
      )
    };
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: snapshot.project.plannedStart,
      rangeFinish: snapshot.project.plannedFinish
    });
    const proposals = proposePlanningScenarios({
      snapshot,
      calculatedPlan,
      resourceLoad,
      target: {
        type: "resource_overload",
        resourceId: "resource-alpha",
        date: "2026-06-01",
        overloadMinutes: 480,
        taskIds: ["task-a"]
      }
    });
    expect(proposals).toHaveLength(3);
    expect(proposals.filter((proposal) => proposal.availability === "unavailable")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile: "balanced",
          unavailableReason: "no_eligible_alternate_resource",
          planDelta: expect.objectContaining({ commands: [] })
        }),
        expect.objectContaining({
          profile: "resilient",
          unavailableReason: "no_eligible_alternate_resource",
          planDelta: expect.objectContaining({ commands: [] })
        })
      ])
    );
    // ни один профиль не переносит нагрузку на постороннюю позицию resource-beta
    const reassignsToBeta = proposals.some((proposal) =>
      proposal.planDelta.commands.some(
        (command) => command.type === "assignment.upsert" && command.payload.resourceId === "resource-beta"
      )
    );
    expect(reassignsToBeta).toBe(false);
  });

  it("removes a multi-task overload by moving only the excess work", () => {
    const base = createOverloadedSnapshot();
    const firstTask = { ...base.tasks[0]!, workMinutes: 300 };
    const secondTask = {
      ...base.tasks[0]!,
      id: "task-b",
      wbsCode: "2",
      title: "B",
      workMinutes: 300
    };
    const firstAssignment = { ...base.assignments[0]!, workMinutes: 300 };
    const secondAssignment = {
      ...base.assignments[0]!,
      id: "assignment-b",
      taskId: "task-b",
      workMinutes: 300
    };
    const snapshot: PlanSnapshot = {
      ...base,
      tasks: [firstTask, secondTask],
      assignments: [firstAssignment, secondAssignment]
    };
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });
    const proposals = proposePlanningScenarios({
      snapshot,
      calculatedPlan,
      resourceLoad,
      target: {
        type: "resource_overload",
        resourceId: "resource-alpha",
        date: "2026-06-01",
        overloadMinutes: 120,
        taskIds: ["task-a", "task-b"]
      }
    });
    const resilient = proposals.find((proposal) => proposal.profile === "resilient")!;

    expect(resilient).toMatchObject({
      availability: "available",
      conflictEffect: "removed",
      explainability: { overloadMinutes: 0 }
    });
    expect(resilient.planDelta.commands.filter((command) => command.type === "assignment.upsert"))
      .toHaveLength(2);
    assertProposalEffect(snapshot, resilient);
  });
});

function assertProposalEffect(snapshot: PlanSnapshot, proposal: ScenarioProposal): void {
  const nextSnapshot = applyPlanDeltaToSnapshot(snapshot, proposal.planDelta);
  const nextPlan = calculatePlan(nextSnapshot, {
    calculatedAt: "2026-05-21T00:00:00.000Z",
    engineVersion: "planning-core-v1"
  });
  const nextLoad = buildResourceLoadMatrix({
    plan: nextPlan,
    resources: nextSnapshot.resources,
    assignments: nextSnapshot.assignments,
    calendars: nextSnapshot.calendars,
    calendarExceptions: nextSnapshot.calendarExceptions,
    reservations: nextSnapshot.reservations,
    rangeStart: "2026-06-01",
    rangeFinish: "2026-06-01",
    granularities: ["day"]
  });
  const overload = findTargetOverload(nextLoad);

  if (proposal.conflictEffect === "accepted") {
    expect(proposal.planDelta.commands).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "risk.accept_overload" })])
    );
    return;
  }
  if (proposal.conflictEffect === "reduced") {
    expect(overload?.overloadMinutes ?? 0).toBeGreaterThan(0);
    expect(overload?.overloadMinutes ?? 0).toBeLessThan(480);
    return;
  }
  expect(overload).toBeUndefined();
}

function findTargetOverload(resourceLoad: ResourceLoadMatrix) {
  return resourceLoad.overloads.find(
    (overload) =>
      overload.resourceId === "resource-alpha" &&
      overload.date === "2026-06-01" &&
      overload.granularity === "day"
  );
}

function createOverloadedSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 1,
    project: {
      id: "project-alpha",
      sourceType: "opportunity",
      sourceOpportunityId: "opportunity-alpha",
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: "2026-06-30",
      calendarId: "calendar-default"
    },
    tasks: [
      {
        id: "task-a",
        parentTaskId: null,
        wbsCode: "1",
        title: "A",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_duration",
        effortDriven: false,
        plannedStart: "2026-06-01",
        plannedFinish: null,
        durationMinutes: 480,
        workMinutes: 960,
        percentComplete: 0,
        calendarId: "calendar-default",
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 960,
        calendarId: null
      }
    ],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [
      {
        id: "resource-alpha",
        userId: "user-alpha",
        positionId: "engineer",
        teamId: "team-platform",
        name: "Alpha",
        calendarId: "calendar-default"
      },
      {
        id: "resource-beta",
        userId: "user-beta",
        positionId: "engineer",
        teamId: "team-platform",
        name: "Beta",
        calendarId: "calendar-default"
      }
    ],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}
