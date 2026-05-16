import { describe, expect, it } from "vitest";

import {
  SchedulingEngineModelError,
  captureScheduleBaselineSnapshot,
  createScheduleBaselineSnapshot,
  createScheduleDateRange,
  createSchedulePlan,
  updateScheduleBaselineSnapshot,
  validateSchedulePlan
} from "./index";

const tenantId = "tenant-a";
const projectId = "project-alpha";

function makeValidPlan() {
  return createSchedulePlan({
    id: "schedule-plan-alpha",
    tenantId,
    projectId,
    version: 1,
    status: "draft",
    wbsNodes: [
      {
        id: "wbs-stage-initiation",
        tenantId,
        projectId,
        stageId: "stage-initiation",
        sortOrder: 10
      },
      {
        id: "wbs-task-kickoff",
        tenantId,
        projectId,
        parentId: "wbs-stage-initiation",
        taskId: "task-kickoff",
        sortOrder: 20,
        schedule: {
          plannedStartDate: "2026-06-01",
          plannedFinishDate: "2026-06-03"
        },
        plannedWorkHours: 12,
        progressPercent: 25
      },
      {
        id: "wbs-task-delivery",
        tenantId,
        projectId,
        parentId: "wbs-stage-initiation",
        taskId: "task-delivery",
        sortOrder: 30,
        schedule: {
          plannedStartDate: "2026-06-04",
          plannedFinishDate: "2026-06-08"
        },
        plannedWorkHours: 24,
        progressPercent: 0
      }
    ],
    dependencies: [
      {
        id: "dependency-kickoff-delivery",
        tenantId,
        projectId,
        predecessorTaskId: "task-kickoff",
        successorTaskId: "task-delivery",
        type: "finish_to_start"
      }
    ]
  });
}

describe("schedule primitives", () => {
  it("creates a tenant/project-scoped schedule plan without Gantt-only task entities", () => {
    const plan = makeValidPlan();

    expect(plan).toMatchObject({
      id: "schedule-plan-alpha",
      tenantId,
      projectId,
      version: 1,
      status: "draft",
      baselineId: undefined
    });
    expect(plan.wbsNodes.map((node) => node.id)).toEqual([
      "wbs-stage-initiation",
      "wbs-task-kickoff",
      "wbs-task-delivery"
    ]);
    expect(plan.wbsNodes[1]).toMatchObject({
      taskId: "task-kickoff",
      schedule: {
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-03",
        durationDays: 3
      },
      plannedWorkHours: 12,
      progressPercent: 25
    });
    expect(Object.keys(plan.wbsNodes[1] ?? {})).not.toContain("ganttTaskId");
  });

  it("derives deterministic inclusive duration and rejects invalid date ranges", () => {
    expect(createScheduleDateRange({ plannedStartDate: "2026-06-01", plannedFinishDate: "2026-06-01" })).toEqual({
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-01",
      durationDays: 1
    });
    expect(createScheduleDateRange({ plannedStartDate: "2026-06-01", plannedFinishDate: "2026-06-03" })).toEqual({
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      durationDays: 3
    });

    expect(() =>
      createScheduleDateRange({ plannedStartDate: "2026-06-04", plannedFinishDate: "2026-06-03" })
    ).toThrow("schedule.plannedFinishDate must be on or after plannedStartDate");

    expect(() =>
      createScheduleDateRange({ plannedStartDate: "2026-02-30", plannedFinishDate: "2026-03-01" })
    ).toThrow(SchedulingEngineModelError);
  });

  it("rejects duplicate WBS ids, missing canonical backing, and invalid planning fields", () => {
    expect(() =>
      createSchedulePlan({
        ...makeValidPlan(),
        wbsNodes: [
          ...makeValidPlan().wbsNodes,
          {
            id: "wbs-task-kickoff",
            tenantId,
            projectId,
            taskId: "task-duplicate",
            sortOrder: 40
          }
        ]
      })
    ).toThrow("schedule WBS node ids must be unique");

    expect(() =>
      createSchedulePlan({
        ...makeValidPlan(),
        wbsNodes: [
          ...makeValidPlan().wbsNodes,
          {
            id: "wbs-task-kickoff-duplicate-canonical-task",
            tenantId,
            projectId,
            taskId: "task-kickoff",
            sortOrder: 40
          }
        ]
      })
    ).toThrow("schedule WBS task ids must be unique");

    expect(() =>
      createSchedulePlan({
        ...makeValidPlan(),
        wbsNodes: [
          {
            id: "wbs-gantt-only",
            tenantId,
            projectId,
            sortOrder: 10
          }
        ]
      })
    ).toThrow("wbsNode must reference a canonical task or project stage");

    expect(() =>
      createSchedulePlan({
        ...makeValidPlan(),
        wbsNodes: [
          {
            id: "wbs-invalid-progress",
            tenantId,
            projectId,
            taskId: "task-invalid-progress",
            sortOrder: 10,
            progressPercent: 101
          }
        ]
      })
    ).toThrow("wbsNode.progressPercent must be between 0 and 100");

    expect(() =>
      createSchedulePlan({
        ...makeValidPlan(),
        wbsNodes: [
          {
            id: "wbs-cross-tenant",
            tenantId: "tenant-b",
            projectId,
            taskId: "task-cross-tenant",
            sortOrder: 10
          }
        ]
      })
    ).toThrow("wbsNode tenant mismatch");

    expect(() =>
      createSchedulePlan({
        ...makeValidPlan(),
        wbsNodes: [
          {
            id: "wbs-cross-project",
            tenantId,
            projectId: "project-other",
            taskId: "task-cross-project",
            sortOrder: 10
          }
        ]
      })
    ).toThrow("wbsNode project mismatch");
  });

  it("rejects malformed dependency endpoints and cross-tenant or cross-project references", () => {
    const basePlan = makeValidPlan();

    expect(() =>
      createSchedulePlan({
        ...basePlan,
        dependencies: [
          {
            id: "dependency-missing-successor",
            tenantId,
            projectId,
            predecessorTaskId: "task-kickoff",
            successorTaskId: "task-missing",
            type: "finish_to_start"
          }
        ]
      })
    ).toThrow("schedule dependency successorTaskId must reference a task WBS node");

    expect(() =>
      createSchedulePlan({
        ...basePlan,
        dependencies: [
          {
            id: "dependency-self",
            tenantId,
            projectId,
            predecessorTaskId: "task-kickoff",
            successorTaskId: "task-kickoff",
            type: "finish_to_start"
          }
        ]
      })
    ).toThrow("schedule dependency cannot link a task to itself");

    expect(() =>
      createSchedulePlan({
        ...basePlan,
        dependencies: [
          {
            id: "dependency-cross-tenant",
            tenantId: "tenant-b",
            projectId,
            predecessorTaskId: "task-kickoff",
            successorTaskId: "task-delivery",
            type: "finish_to_start"
          }
        ]
      })
    ).toThrow("schedule dependency tenant mismatch");

    expect(() =>
      createSchedulePlan({
        ...basePlan,
        dependencies: [
          {
            id: "dependency-cross-project",
            tenantId,
            projectId: "project-other",
            predecessorTaskId: "task-kickoff",
            successorTaskId: "task-delivery",
            type: "finish_to_start"
          }
        ]
      })
    ).toThrow("schedule dependency project mismatch");

    expect(() =>
      createSchedulePlan({
        ...basePlan,
        dependencies: [
          {
            id: "dependency-kickoff-delivery-a",
            tenantId,
            projectId,
            predecessorTaskId: "task-kickoff",
            successorTaskId: "task-delivery",
            type: "finish_to_start"
          },
          {
            id: "dependency-kickoff-delivery-b",
            tenantId,
            projectId,
            predecessorTaskId: "task-kickoff",
            successorTaskId: "task-delivery",
            type: "finish_to_start"
          }
        ]
      })
    ).toThrow("schedule dependencies must be unique");

    const cyclicInput = {
      ...basePlan,
      dependencies: [
        ...basePlan.dependencies,
        {
          id: "dependency-delivery-kickoff",
          tenantId,
          projectId,
          predecessorTaskId: "task-delivery",
          successorTaskId: "task-kickoff",
          type: "finish_to_start" as const
        }
      ]
    };
    const beforeCycleValidation = JSON.stringify(cyclicInput);

    expect(() => createSchedulePlan(cyclicInput)).toThrow("schedule dependencies must not create cycles");
    expect(JSON.stringify(cyclicInput)).toBe(beforeCycleValidation);
  });

  it("reports deterministic validation issues for obvious schedule conflicts", () => {
    const plan = createSchedulePlan({
      ...makeValidPlan(),
      wbsNodes: [
        makeValidPlan().wbsNodes[0]!,
        {
          ...makeValidPlan().wbsNodes[1]!,
          schedule: {
            plannedStartDate: "2026-06-05",
            plannedFinishDate: "2026-06-06"
          }
        },
        {
          ...makeValidPlan().wbsNodes[2]!,
          schedule: {
            plannedStartDate: "2026-06-04",
            plannedFinishDate: "2026-06-08"
          }
        }
      ]
    });

    expect(validateSchedulePlan(plan)).toEqual([
      {
        code: "finish_to_start_conflict",
        severity: "blocking",
        message: "Successor task starts before predecessor task finishes.",
        nodeId: "wbs-task-delivery",
        dependencyId: "dependency-kickoff-delivery",
        fieldRefs: ["plannedStartDate", "plannedFinishDate"]
      }
    ]);
  });

  it("returns typed issues for missing required planned task fields without mutating input", () => {
    const plan = makeValidPlan();
    const rawPlan = {
      ...plan,
      wbsNodes: [
        plan.wbsNodes[0]!,
        {
          ...plan.wbsNodes[1]!,
          schedule: {},
          plannedWorkHours: undefined,
          progressPercent: undefined
        },
        plan.wbsNodes[2]!
      ]
    };
    const before = JSON.stringify(rawPlan);

    expect(validateSchedulePlan(rawPlan)).toEqual([
      {
        code: "missing_planned_start_date",
        severity: "blocking",
        message: "Task WBS node is missing planned start date.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["plannedStartDate"]
      },
      {
        code: "missing_planned_finish_date",
        severity: "blocking",
        message: "Task WBS node is missing planned finish date.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["plannedFinishDate"]
      },
      {
        code: "missing_planned_work_hours",
        severity: "blocking",
        message: "Task WBS node is missing planned work hours.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["plannedWorkHours"]
      },
      {
        code: "missing_progress_percent",
        severity: "blocking",
        message: "Task WBS node is missing progress percent.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["progressPercent"]
      }
    ]);
    expect(JSON.stringify(rawPlan)).toBe(before);
  });

  it("rejects duplicate canonical task ids in validation before dependency checks become order-dependent", () => {
    const plan = makeValidPlan();

    expect(() =>
      validateSchedulePlan({
        ...plan,
        wbsNodes: [
          ...plan.wbsNodes,
          {
            id: "wbs-task-duplicate-kickoff",
            tenantId,
            projectId,
            taskId: "task-kickoff",
            sortOrder: 40,
            schedule: {
              plannedStartDate: "2026-06-09",
              plannedFinishDate: "2026-06-10"
            },
            plannedWorkHours: 8,
            progressPercent: 0
          }
        ]
      })
    ).toThrow("schedule WBS task ids must be unique");
  });

  it("returns typed issues for invalid planned ranges, work, and progress", () => {
    const plan = makeValidPlan();
    const rawPlan = {
      ...plan,
      wbsNodes: [
        plan.wbsNodes[0]!,
        {
          ...plan.wbsNodes[1]!,
          schedule: {
            plannedStartDate: "2026-06-04",
            plannedFinishDate: "2026-06-03"
          },
          plannedWorkHours: -1,
          progressPercent: 101
        },
        plan.wbsNodes[2]!
      ]
    };

    expect(validateSchedulePlan(rawPlan)).toEqual([
      {
        code: "invalid_date_range",
        severity: "blocking",
        message: "Task WBS node planned finish date must be on or after planned start date.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["plannedStartDate", "plannedFinishDate"]
      },
      {
        code: "invalid_planned_work_hours",
        severity: "blocking",
        message: "Task WBS node planned work hours must be a non-negative number.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["plannedWorkHours"]
      },
      {
        code: "invalid_progress_percent",
        severity: "blocking",
        message: "Task WBS node progress percent must be between 0 and 100.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["progressPercent"]
      }
    ]);
  });

  it("keeps dependency conflict issues visible when another task has planned field issues", () => {
    const plan = makeValidPlan();
    const rawPlan = {
      ...plan,
      wbsNodes: [
        plan.wbsNodes[0]!,
        {
          ...plan.wbsNodes[1]!,
          schedule: {
            plannedStartDate: "2026-06-05",
            plannedFinishDate: "2026-06-06"
          },
          plannedWorkHours: undefined,
          progressPercent: undefined
        },
        {
          ...plan.wbsNodes[2]!,
          schedule: {
            plannedStartDate: "2026-06-04",
            plannedFinishDate: "2026-06-08"
          }
        }
      ]
    };

    expect(validateSchedulePlan(rawPlan)).toEqual([
      {
        code: "missing_planned_work_hours",
        severity: "blocking",
        message: "Task WBS node is missing planned work hours.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["plannedWorkHours"]
      },
      {
        code: "missing_progress_percent",
        severity: "blocking",
        message: "Task WBS node is missing progress percent.",
        nodeId: "wbs-task-kickoff",
        fieldRefs: ["progressPercent"]
      },
      {
        code: "finish_to_start_conflict",
        severity: "blocking",
        message: "Successor task starts before predecessor task finishes.",
        nodeId: "wbs-task-delivery",
        dependencyId: "dependency-kickoff-delivery",
        fieldRefs: ["plannedStartDate", "plannedFinishDate"]
      }
    ]);
  });

  it("rejects structural dependency cycles during validation even when planned fields have issues", () => {
    const plan = makeValidPlan();
    const rawPlan = {
      ...plan,
      wbsNodes: [
        plan.wbsNodes[0]!,
        {
          ...plan.wbsNodes[1]!,
          plannedWorkHours: undefined
        },
        plan.wbsNodes[2]!
      ],
      dependencies: [
        ...plan.dependencies,
        {
          id: "dependency-delivery-kickoff",
          tenantId,
          projectId,
          predecessorTaskId: "task-delivery",
          successorTaskId: "task-kickoff",
          type: "finish_to_start" as const
        }
      ]
    };

    expect(() => validateSchedulePlan(rawPlan)).toThrow("schedule dependencies must not create cycles");
  });

  it("keeps derived duration deterministic when planned start and finish exist", () => {
    const plan = makeValidPlan();

    expect(plan.wbsNodes[1]?.schedule).toEqual({
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      durationDays: 3
    });
    expect(validateSchedulePlan(plan)).toEqual([]);
  });

  it("creates baseline snapshot values as defensive copies", () => {
    const plan = makeValidPlan();
    const snapshot = createScheduleBaselineSnapshot({
      id: "baseline-alpha",
      tenantId,
      projectId,
      schedulePlanId: plan.id,
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T10:00:00.000Z",
      taskBaselineValues: [
        {
          taskId: "task-kickoff",
          plannedStartDate: "2026-06-01",
          plannedFinishDate: "2026-06-03",
          durationDays: 3,
          progressPercent: 25
        }
      ]
    });
    const values = snapshot.taskBaselineValues;
    values[0]!.plannedStartDate = "2026-07-01";

    expect(snapshot.taskBaselineValues[0]).toEqual({
      taskId: "task-kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      durationDays: 3,
      progressPercent: 25
    });
  });

  it("captures visible baseline values from the live plan in stable WBS order", () => {
    const plan = makeValidPlan();

    const snapshot = captureScheduleBaselineSnapshot({
      id: "baseline-alpha",
      tenantId,
      projectId,
      schedulePlanId: plan.id,
      schedulePlan: {
        ...plan,
        wbsNodes: [plan.wbsNodes[2]!, plan.wbsNodes[0]!, plan.wbsNodes[1]!]
      },
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T10:00:00.000Z"
    });

    expect(snapshot).toMatchObject({
      id: "baseline-alpha",
      tenantId,
      projectId,
      schedulePlanId: "schedule-plan-alpha",
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T10:00:00.000Z"
    });
    expect(snapshot.taskBaselineValues).toEqual([
      {
        taskId: "task-kickoff",
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-03",
        durationDays: 3,
        progressPercent: 25
      },
      {
        taskId: "task-delivery",
        plannedStartDate: "2026-06-04",
        plannedFinishDate: "2026-06-08",
        durationDays: 5,
        progressPercent: 0
      }
    ]);
  });

  it("freezes baseline snapshot identity fields at runtime", () => {
    const plan = makeValidPlan();
    const snapshot = captureScheduleBaselineSnapshot({
      id: "baseline-alpha",
      tenantId,
      projectId,
      schedulePlanId: plan.id,
      schedulePlan: plan,
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T10:00:00.000Z"
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      (snapshot as { createdAt: string }).createdAt = "2026-05-16T10:00:00.000Z";
    }).toThrow(TypeError);
    expect(snapshot.createdAt).toBe("2026-05-15T10:00:00.000Z");
  });

  it("rejects baseline capture when visible task baseline fields are incomplete", () => {
    const plan = makeValidPlan();

    expect(() =>
      captureScheduleBaselineSnapshot({
        id: "baseline-alpha",
        tenantId,
        projectId,
        schedulePlanId: plan.id,
        schedulePlan: {
          ...plan,
          wbsNodes: [
            plan.wbsNodes[0]!,
            {
              ...plan.wbsNodes[1]!,
              progressPercent: undefined
            },
            plan.wbsNodes[2]!
          ]
        },
        createdBy: "project-manager-a",
        createdAt: "2026-05-15T10:00:00.000Z"
      })
    ).toThrow("baseline capture task WBS node must have planned start, finish, duration, and progress");
  });

  it("keeps captured baseline immutable when live plan values drift", () => {
    const plan = makeValidPlan();
    const snapshot = captureScheduleBaselineSnapshot({
      id: "baseline-alpha",
      tenantId,
      projectId,
      schedulePlanId: plan.id,
      schedulePlan: plan,
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T10:00:00.000Z"
    });

    plan.wbsNodes[1]!.schedule = {
      plannedStartDate: "2026-07-01",
      plannedFinishDate: "2026-07-04",
      durationDays: 4
    };
    plan.wbsNodes[1]!.progressPercent = 90;

    expect(snapshot.taskBaselineValues[0]).toEqual({
      taskId: "task-kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      durationDays: 3,
      progressPercent: 25
    });
  });

  it("requires baseline capture to match tenant, project, and schedule plan scope", () => {
    const plan = makeValidPlan();
    const baseInput = {
      id: "baseline-alpha",
      tenantId,
      projectId,
      schedulePlanId: plan.id,
      schedulePlan: plan,
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T10:00:00.000Z"
    };

    expect(() => captureScheduleBaselineSnapshot({ ...baseInput, tenantId: "tenant-b" })).toThrow(
      "baseline capture schedulePlan tenant mismatch"
    );
    expect(() => captureScheduleBaselineSnapshot({ ...baseInput, projectId: "project-other" })).toThrow(
      "baseline capture schedulePlan project mismatch"
    );
    expect(() => captureScheduleBaselineSnapshot({ ...baseInput, schedulePlanId: "schedule-plan-other" })).toThrow(
      "baseline capture schedulePlanId must match schedule plan id"
    );
  });

  it("rejects invalid baseline values without accepting incoherent visible dates", () => {
    expect(() =>
      createScheduleBaselineSnapshot({
        id: "baseline-alpha",
        tenantId,
        projectId,
        schedulePlanId: "schedule-plan-alpha",
        createdBy: "project-manager-a",
        createdAt: "2026-05-15T10:00:00.000Z",
        taskBaselineValues: [
          {
            taskId: "task-kickoff",
            plannedStartDate: "2026-06-04",
            plannedFinishDate: "2026-06-03",
            durationDays: 1,
            progressPercent: 25
          }
        ]
      })
    ).toThrow("baseline.taskBaselineValue.plannedFinishDate must be on or after plannedStartDate");

    expect(() =>
      createScheduleBaselineSnapshot({
        id: "baseline-alpha",
        tenantId,
        projectId,
        schedulePlanId: "schedule-plan-alpha",
        createdBy: "project-manager-a",
        createdAt: "2026-05-15T10:00:00.000Z",
        taskBaselineValues: [
          {
            taskId: "task-kickoff",
            durationDays: -1
          }
        ]
      })
    ).toThrow("baseline.taskBaselineValue.durationDays must be a positive integer");

    expect(() =>
      createScheduleBaselineSnapshot({
        id: "baseline-alpha",
        tenantId,
        projectId,
        schedulePlanId: "schedule-plan-alpha",
        createdBy: "project-manager-a",
        createdAt: "2026-05-15T10:00:00.000Z",
        taskBaselineValues: [
          {
            taskId: "task-kickoff",
            plannedStartDate: "2026-06-01",
            plannedFinishDate: "2026-06-03",
            durationDays: 99
          }
        ]
      })
    ).toThrow("baseline.taskBaselineValue.durationDays must match planned date range");

    expect(() =>
      createScheduleBaselineSnapshot({
        id: "baseline-alpha",
        tenantId,
        projectId,
        schedulePlanId: "schedule-plan-alpha",
        createdBy: "project-manager-a",
        createdAt: "2026-05-15T10:00:00.000Z",
        taskBaselineValues: [
          {
            taskId: "task-kickoff"
          },
          {
            taskId: "task-kickoff"
          }
        ]
      })
    ).toThrow("baseline.taskBaselineValues task ids must be unique");
  });

  it("returns defensive copies for captured baseline values", () => {
    const plan = makeValidPlan();
    const snapshot = captureScheduleBaselineSnapshot({
      id: "baseline-alpha",
      tenantId,
      projectId,
      schedulePlanId: plan.id,
      schedulePlan: plan,
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T10:00:00.000Z"
    });
    const values = snapshot.taskBaselineValues;
    values[0]!.plannedStartDate = "2026-07-01";

    expect(snapshot.taskBaselineValues[0]).toEqual({
      taskId: "task-kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      durationDays: 3,
      progressPercent: 25
    });
  });

  it("creates an explicit updated draft snapshot without mutating the previous baseline", () => {
    const plan = makeValidPlan();
    const original = captureScheduleBaselineSnapshot({
      id: "baseline-alpha",
      tenantId,
      projectId,
      schedulePlanId: plan.id,
      schedulePlan: plan,
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T10:00:00.000Z"
    });
    const changedPlan = createSchedulePlan({
      ...plan,
      baselineId: original.id,
      wbsNodes: [
        plan.wbsNodes[0]!,
        {
          ...plan.wbsNodes[1]!,
          schedule: {
            plannedStartDate: "2026-07-01",
            plannedFinishDate: "2026-07-04"
          },
          progressPercent: 60
        },
        plan.wbsNodes[2]!
      ]
    });

    const updated = updateScheduleBaselineSnapshot({
      id: "baseline-alpha-updated",
      tenantId,
      projectId,
      schedulePlanId: changedPlan.id,
      schedulePlan: changedPlan,
      createdBy: "project-manager-a",
      createdAt: "2026-05-16T10:00:00.000Z"
    });

    expect(original.taskBaselineValues[0]).toEqual({
      taskId: "task-kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      durationDays: 3,
      progressPercent: 25
    });
    expect(updated.taskBaselineValues[0]).toEqual({
      taskId: "task-kickoff",
      plannedStartDate: "2026-07-01",
      plannedFinishDate: "2026-07-04",
      durationDays: 4,
      progressPercent: 60
    });
  });
});
