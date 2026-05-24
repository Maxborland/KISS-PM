import { describe, expect, it } from "vitest";

import { proposeAutoPlanningSolutions } from "./autoSolver";
import { buildResourceLoadMatrix } from "./resourcePlanning";
import { calculatePlan } from "./schedulingEngine";
import type { PlanSnapshot } from "./types";

describe("auto planning solver", () => {
  it("returns no-overlap allocation proposal before overload fallback when capacity is feasible", () => {
    const snapshot = createSnapshot({ workMinutes: 480, deadline: "2026-06-01" });
    const input = createSolverInput(snapshot);

    const result = proposeAutoPlanningSolutions(input);

    expect(result.search).toMatchObject({ strategy: "bounded_beam", beamWidth: 20 });
    expect(result.proposals[0]).toMatchObject({
      conflictEffect: "removed",
      explainability: expect.objectContaining({ overloadMinutes: 0 })
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "assignment.allocations.replace" })
      ])
    );
  });

  it("ranks earlier finish before smaller change count through deadline-first cost", () => {
    const snapshot = createSnapshot({ workMinutes: 480, deadline: "2026-06-02" });
    const result = proposeAutoPlanningSolutions(createSolverInput(snapshot));

    const costs = result.proposals.map((proposal) => proposal.explainability.cost);

    expect(costs).toEqual([...costs].sort((left, right) => left - right));
    expect(result.proposals[0]?.explainability.finishDate).toBe("2026-06-01");
  });

  it("records caller supplied beam bounds in deterministic run metadata", () => {
    const snapshot = createSnapshot({ workMinutes: 480, deadline: "2026-06-02" });
    const input = {
      ...createSolverInput(snapshot),
      beamWidth: 2,
      maxIterations: 7,
      maxProposals: 1
    };

    const first = proposeAutoPlanningSolutions(input);
    const second = proposeAutoPlanningSolutions(input);

    expect(first.search).toEqual({
      strategy: "bounded_beam",
      beamWidth: 2,
      maxIterations: 7,
      maxProposals: 1
    });
    expect(first).toEqual(second);
    expect(first.proposals).toHaveLength(1);
  });

  it("keeps authored schedule aligned with delayed allocation dates", () => {
    const snapshot = createSnapshot({
      workMinutes: 480,
      deadline: "2026-06-02",
      reservations: [
        {
          id: "other-project-day-one",
          resourceId: "resource-alpha",
          projectId: "project-other",
          start: "2026-06-01",
          finish: "2026-06-01",
          workMinutes: 480,
          reason: "Other project commitment"
        }
      ]
    });
    const result = proposeAutoPlanningSolutions(createSolverInput(snapshot));

    expect(result.proposals[0]).toMatchObject({
      conflictEffect: "removed",
      explainability: expect.objectContaining({ finishDate: "2026-06-02", overloadMinutes: 0 })
    });
    expect(result.proposals[0]?.planDelta.commands[0]).toEqual({
      type: "task.update_schedule",
      payload: {
        taskId: "task-a",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-02"
      }
    });
  });

  it("reports resource-constrained finish from the latest allocation date when capacity has gaps", () => {
    const snapshot = createSnapshot({
      workMinutes: 960,
      deadline: "2026-06-03",
      reservations: [
        {
          id: "other-project-day-two",
          resourceId: "resource-alpha",
          projectId: "project-other",
          start: "2026-06-02",
          finish: "2026-06-02",
          workMinutes: 480,
          reason: "Other project commitment"
        }
      ]
    });
    const result = proposeAutoPlanningSolutions(createSolverInput(snapshot));

    expect(result.proposals[0]).toMatchObject({
      conflictEffect: "removed",
      explainability: expect.objectContaining({ finishDate: "2026-06-03", overloadMinutes: 0 })
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        {
          type: "task.update_schedule",
          payload: {
            taskId: "task-a",
            plannedStart: "2026-06-01",
            plannedFinish: "2026-06-03"
          }
        }
      ])
    );
  });

  it("splits assignment allocations across same-team resources when one resource cannot fit the work", () => {
    const snapshot = createSnapshot({
      workMinutes: 960,
      deadline: "2026-06-01",
      resources: [
        createResource("resource-alpha", "Alpha"),
        createResource("resource-beta", "Beta")
      ]
    });
    const result = proposeAutoPlanningSolutions(createSolverInput(snapshot));

    expect(result.proposals[0]).toMatchObject({
      conflictEffect: "removed",
      explainability: expect.objectContaining({ finishDate: "2026-06-01", overloadMinutes: 0 })
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        {
          type: "assignment.upsert",
          payload: {
            id: "assignment-a",
            taskId: "task-a",
            resourceId: "resource-alpha",
            role: "executor",
            unitsPermille: 1000,
            workMinutes: 480
          }
        },
        {
          type: "assignment.upsert",
          payload: {
            id: "assignment-a-solver-resource-beta",
            taskId: "task-a",
            resourceId: "resource-beta",
            role: "co_executor",
            unitsPermille: 1000,
            workMinutes: 480
          }
        }
      ])
    );
  });

  it("deletes the source assignment when a beam candidate fully reassigns work", () => {
    const snapshot = createSnapshot({
      workMinutes: 480,
      deadline: "2026-06-01",
      resources: [
        createResource("resource-alpha", "Alpha"),
        createResource("resource-beta", "Beta")
      ],
      reservations: [
        {
          id: "other-project-alpha",
          resourceId: "resource-alpha",
          projectId: "project-other",
          start: "2026-06-01",
          finish: "2026-06-01",
          workMinutes: 480,
          reason: "Other project commitment"
        }
      ]
    });
    const result = proposeAutoPlanningSolutions(createSolverInput(snapshot));

    expect(result.proposals[0]).toMatchObject({
      conflictEffect: "removed",
      explainability: expect.objectContaining({ finishDate: "2026-06-01", overloadMinutes: 0 })
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        { type: "assignment.delete", payload: { assignmentId: "assignment-a" } },
        {
          type: "assignment.upsert",
          payload: {
            id: "assignment-a-solver-resource-beta",
            taskId: "task-a",
            resourceId: "resource-beta",
            role: "co_executor",
            unitsPermille: 1000,
            workMinutes: 480
          }
        }
      ])
    );
  });

  it("repair mode treats completed work as locked occupation before moving open work", () => {
    const snapshot = createRepairSnapshot();
    const result = proposeAutoPlanningSolutions(createSolverInput(snapshot, "repair"));

    expect(result.proposals[0]).toMatchObject({
      conflictEffect: "removed",
      explainability: expect.objectContaining({ overloadMinutes: 0 })
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        {
          type: "task.update_schedule",
          payload: {
            taskId: "task-open",
            plannedStart: "2026-06-02",
            plannedFinish: "2026-06-02"
          }
        }
      ])
    );
    expect(result.proposals[0]?.planDelta.commands).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "assignment.allocations.replace",
          payload: expect.objectContaining({ assignmentId: "assignment-done" })
        })
      ])
    );
  });

  it("does not allocate successors before shifted predecessor dependencies are feasible", () => {
    const snapshot = createDependencyShiftSnapshot();
    const result = proposeAutoPlanningSolutions(createSolverInput(snapshot));

    expect(result.proposals[0]).toMatchObject({
      conflictEffect: "removed",
      explainability: expect.objectContaining({ overloadMinutes: 0 })
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        {
          type: "task.update_schedule",
          payload: {
            taskId: "task-a",
            plannedStart: "2026-06-03",
            plannedFinish: "2026-06-03"
          }
        },
        {
          type: "task.update_schedule",
          payload: {
            taskId: "task-b",
            plannedStart: "2026-06-04",
            plannedFinish: "2026-06-04"
          }
        }
      ])
    );
    const successorAllocationCommand = result.proposals[0]?.planDelta.commands.find(
      (command) =>
        command.type === "assignment.allocations.replace" &&
        command.payload.assignmentId === "assignment-b"
    );
    expect(successorAllocationCommand).toEqual({
      type: "assignment.allocations.replace",
      payload: {
        assignmentId: "assignment-b",
        allocations: [{ date: "2026-06-04", workMinutes: 480 }]
      }
    });
  });

  it("returns an explainable accepted-overload proposal when deadline cannot fit capacity", () => {
    const snapshot = createSnapshot({ workMinutes: 960, deadline: "2026-06-01" });
    const result = proposeAutoPlanningSolutions(createSolverInput(snapshot));

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      conflictEffect: "accepted_overload",
      explainability: expect.objectContaining({
        overloadMinutes: 480,
        acceptedRiskIds: [`auto-solver:${snapshot.projectId}:${snapshot.planVersion}`]
      })
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "risk.accept_overload" })
      ])
    );
  });
});

function createSolverInput(snapshot: PlanSnapshot, mode: "schedule" | "repair" = "schedule") {
  const calculatedPlan = calculatePlan(snapshot, {
    calculatedAt: snapshot.capturedAt,
    engineVersion: "planning-core-v1"
  });
  const resourceLoad = buildResourceLoadMatrix({
    plan: calculatedPlan,
    resources: snapshot.resources,
    assignments: snapshot.assignments,
    assignmentAllocations: snapshot.assignmentAllocations,
    calendars: snapshot.calendars,
    calendarExceptions: snapshot.calendarExceptions,
    reservations: snapshot.reservations,
    rangeStart: snapshot.project.plannedStart,
    rangeFinish: snapshot.project.deadline ?? snapshot.project.plannedFinish,
    granularities: ["day"]
  });
  return {
    mode,
    snapshot,
    calculatedPlan,
    resourceLoad,
    calculatedAt: snapshot.capturedAt
  };
}

function createSnapshot(input: {
  workMinutes: number;
  deadline: string;
  reservations?: PlanSnapshot["reservations"];
  resources?: PlanSnapshot["resources"];
}): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 1,
    project: {
      id: "project-alpha",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-05",
      deadline: input.deadline,
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
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: null,
        durationMinutes: input.workMinutes,
        workMinutes: input.workMinutes,
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
        workMinutes: input.workMinutes,
        calendarId: null
      }
    ],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: input.resources ?? [createResource("resource-alpha", "Alpha")],
    reservations: input.reservations ?? [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}

function createResource(id: string, name: string): PlanSnapshot["resources"][number] {
  return {
    id,
    userId: id.replace("resource", "user"),
    positionId: "engineer",
    teamId: "team-platform",
    name,
    calendarId: "calendar-default"
  };
}

function createRepairSnapshot(): PlanSnapshot {
  return {
    ...createSnapshot({ workMinutes: 480, deadline: "2026-06-02" }),
    tasks: [
      {
        id: "task-done",
        parentTaskId: null,
        wbsCode: "1",
        title: "Done",
        statusId: "done",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 100,
        calendarId: "calendar-default",
        constraint: null
      },
      {
        id: "task-open",
        parentTaskId: null,
        wbsCode: "2",
        title: "Open",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 0,
        calendarId: "calendar-default",
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assignment-done",
        taskId: "task-done",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      },
      {
        id: "assignment-open",
        taskId: "task-open",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }
    ]
  };
}

function createDependencyShiftSnapshot(): PlanSnapshot {
  return {
    ...createSnapshot({
      workMinutes: 480,
      deadline: "2026-06-04",
      resources: [
        createResource("resource-alpha", "Alpha"),
        {
          ...createResource("resource-beta", "Beta"),
          positionId: "designer",
          teamId: "team-design"
        }
      ],
      reservations: [
        {
          id: "other-project-alpha-day-one",
          resourceId: "resource-alpha",
          projectId: "project-other",
          start: "2026-06-01",
          finish: "2026-06-01",
          workMinutes: 480,
          reason: "Other project commitment"
        },
        {
          id: "other-project-alpha-day-two",
          resourceId: "resource-alpha",
          projectId: "project-other",
          start: "2026-06-02",
          finish: "2026-06-02",
          workMinutes: 480,
          reason: "Other project commitment"
        }
      ]
    }),
    tasks: [
      {
        id: "task-a",
        parentTaskId: null,
        wbsCode: "1",
        title: "A",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 0,
        calendarId: "calendar-default",
        constraint: null
      },
      {
        id: "task-b",
        parentTaskId: null,
        wbsCode: "2",
        title: "B",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-02",
        durationMinutes: 480,
        workMinutes: 480,
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
        workMinutes: 480,
        calendarId: null
      },
      {
        id: "assignment-b",
        taskId: "task-b",
        resourceId: "resource-beta",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }
    ],
    dependencies: [
      {
        id: "dependency-a-b",
        predecessorTaskId: "task-a",
        successorTaskId: "task-b",
        type: "FS",
        lagMinutes: 0
      }
    ]
  };
}
