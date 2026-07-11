import { describe, expect, it } from "vitest";

import {
  parsePlanningCommandEnvelope,
  parseScenarioApplyEnvelope,
  parseScenarioPreviewEnvelope
} from "./planningParsers";
import type { PlanningCommand } from "@kiss-pm/domain";

describe("planning parsers", () => {
  it("strictly parses every PlanningCommand variant", () => {
    const commands: PlanningCommand[] = [
      {
        type: "task.create",
        payload: {
          id: "task-new",
          projectId: "project-alpha",
          title: "New task",
          statusId: "task-status-new",
          plannedStart: "2026-06-01",
          plannedFinish: null,
          durationMinutes: 1920,
          workMinutes: 480,
          assignments: [
            {
              id: "assignment-new",
              resourceId: "user-alpha-executor",
              role: "executor",
              unitsPermille: 1000,
              workMinutes: 480
            }
          ]
        }
      },
      { type: "task.update_identity", payload: { taskId: "task-a", title: "Renamed" } },
      { type: "task.update_schedule", payload: { taskId: "task-a", plannedStart: "2026-06-02", plannedFinish: null } },
      { type: "task.update_work_model", payload: { taskId: "task-a", taskType: "fixed_work", effortDriven: true, durationMinutes: 480, workMinutes: 960 } },
      { type: "task.update_status", payload: { taskId: "task-a", statusId: "task-status-done" } },
      { type: "task.update_progress", payload: { taskId: "task-a", percentComplete: 50 } },
      { type: "task.move_wbs", payload: { taskId: "task-a", parentTaskId: null, sortOrder: 0 } },
      { type: "task.delete_or_archive", payload: { taskId: "task-a", mode: "archive" } },
      { type: "dependency.upsert", payload: { id: "dep-a-b", predecessorTaskId: "task-a", successorTaskId: "task-b", dependencyType: "FS", lagMinutes: 0 } },
      { type: "dependency.delete", payload: { dependencyId: "dep-a-b" } },
      { type: "assignment.upsert", payload: { id: "assignment-a", taskId: "task-a", resourceId: "user-alpha-executor", role: "executor", unitsPermille: 1000, workMinutes: null } },
      { type: "assignment.allocations.replace", payload: { assignmentId: "assignment-a", allocations: [{ date: "2026-06-10", workMinutes: 240 }] } },
      { type: "assignment.delete", payload: { assignmentId: "assignment-a" } },
      { type: "baseline.capture", payload: { baselineId: "baseline-a", label: "Baseline" } },
      { type: "calendar.exception.upsert", payload: { id: "exception-a", calendarId: "calendar-a", resourceId: null, date: "2026-06-12", workingMinutes: 0, reason: "holiday" } },
      { type: "constraint.update", payload: { taskId: "task-a", constraintId: "constraint-a", type: "finish_no_later_than", date: "2026-06-30" } },
      { type: "resource.reserve", payload: { id: "reservation-a", resourceId: "user-alpha-executor", start: "2026-06-10", finish: "2026-06-10", workMinutes: 120, reason: "support" } },
      { type: "risk.accept_overload", payload: { overloadId: "user-alpha-executor:2026-06-10", acceptedRiskReason: "approved" } },
      { type: "project.deadline.move", payload: { deadline: "2026-07-01", reason: "scope changed" } }
    ];

    for (const command of commands) {
      expect(parsePlanningCommandEnvelope({ command, clientPlanVersion: 1 })).toEqual({
        ok: true,
        value: { command, clientPlanVersion: 1 }
      });
    }
  });

  it("accepts zero-duration task.create only for a zero-work milestone", () => {
    const milestone = {
      type: "task.create" as const,
      payload: {
        id: "milestone-new",
        projectId: "project-alpha",
        title: "Release",
        statusId: "task-status-new",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationMinutes: 0,
        workMinutes: 0,
        assignments: []
      }
    };

    expect(
      parsePlanningCommandEnvelope({ command: milestone, clientPlanVersion: 1 })
    ).toMatchObject({ ok: true, value: { command: milestone } });
    expect(
      parsePlanningCommandEnvelope({
        command: {
          ...milestone,
          payload: { ...milestone.payload, workMinutes: 60 }
        },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });
  });

  it("rejects unknown command payloads instead of accepting arbitrary JSON", () => {
    expect(
      parsePlanningCommandEnvelope({
        command: { type: "dependency.upsert", payload: { id: "dep-only" } },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });
    expect(
      parsePlanningCommandEnvelope({
        command: { type: "unknown", payload: {} },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });
  });

  it("validates planning command idempotency keys before audit/persistence", () => {
    const command: PlanningCommand = {
      type: "task.update_identity",
      payload: { taskId: "task-a", title: "Renamed" }
    };

    expect(
      parsePlanningCommandEnvelope({
        command,
        clientPlanVersion: 1,
        idempotencyKey: "plan-command_2026-05-22:01"
      })
    ).toEqual({
      ok: true,
      value: {
        command,
        clientPlanVersion: 1,
        idempotencyKey: "plan-command_2026-05-22:01"
      }
    });
    expect(
      parsePlanningCommandEnvelope({
        command,
        clientPlanVersion: 1,
        idempotencyKey: "x".repeat(121)
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });
    expect(
      parsePlanningCommandEnvelope({
        command,
        clientPlanVersion: 1,
        idempotencyKey: "bad key with spaces"
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });
  });

  it("rejects unsafe planning command strings before reducer/audit use", () => {
    expect(
      parsePlanningCommandEnvelope({
        command: {
          type: "task.update_identity",
          payload: { taskId: "task-a", title: "Renamed\nInjected" }
        },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });

    expect(
      parsePlanningCommandEnvelope({
        command: {
          type: "project.deadline.move",
          payload: { deadline: "2026-07-01", reason: "x".repeat(501) }
        },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });

    expect(
      parseScenarioApplyEnvelope({
        clientPlanVersion: 7,
        acceptedRiskReason: "approved\u0000hidden"
      })
    ).toEqual({ ok: false, error: "planning_scenario_invalid" });
  });

  it("rejects unsafe task custom-field commands", () => {
    expect(
      parsePlanningCommandEnvelope({
        command: {
          type: "task.update_custom_field",
          payload: { taskId: "task-a", fieldKey: "constructor", value: "S1" }
        },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });

    expect(
      parsePlanningCommandEnvelope({
        command: {
          type: "task.update_custom_field",
          payload: { taskId: "task-a", fieldKey: "sprint", value: { nested: true } }
        },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });

    expect(
      parsePlanningCommandEnvelope({
        command: {
          type: "task.update_custom_field",
          payload: { taskId: "task-a", fieldKey: "sprint", value: "S1\nhidden" }
        },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });
  });

  it("rejects impossible calendar dates before they reach the scheduling engine", () => {
    expect(
      parsePlanningCommandEnvelope({
        command: {
          type: "task.update_schedule",
          payload: {
            taskId: "task-a",
            plannedStart: "2026-02-31",
            plannedFinish: "2026-03-01"
          }
        },
        clientPlanVersion: 1
      })
    ).toEqual({ ok: false, error: "planning_command_invalid" });

    expect(
      parseScenarioPreviewEnvelope({
        clientPlanVersion: 1,
        target: {
          type: "resource_overload",
          resourceId: "user-alpha-executor",
          date: "2026-99-99",
          overloadMinutes: 480,
          taskIds: ["task-a"]
        }
      })
    ).toEqual({ ok: false, error: "planning_scenario_invalid" });

    expect(
      parseScenarioPreviewEnvelope({
        clientPlanVersion: 1,
        target: {
          type: "resource_overload",
          resourceId: "user-alpha-executor",
          date: "2026-06-08",
          overloadMinutes: 480,
          taskIds: ["task-a\nhidden"]
        }
      })
    ).toEqual({ ok: false, error: "planning_scenario_invalid" });
  });

  it("parses scenario preview/apply envelopes with explicit plan versions", () => {
    expect(
      parseScenarioPreviewEnvelope({
        clientPlanVersion: 7,
        target: {
          type: "resource_overload",
          resourceId: "user-alpha-executor",
          date: "2026-06-08",
          overloadMinutes: 480,
          taskIds: ["task-plan-overload"]
        }
      })
    ).toEqual({
      ok: true,
      value: {
        clientPlanVersion: 7,
        target: {
          type: "resource_overload",
          resourceId: "user-alpha-executor",
          date: "2026-06-08",
          overloadMinutes: 480,
          taskIds: ["task-plan-overload"]
        }
      }
    });
    expect(parseScenarioApplyEnvelope({ clientPlanVersion: 7 })).toEqual({
      ok: true,
      value: { clientPlanVersion: 7, acceptedRiskReason: null }
    });
    expect(
      parseScenarioApplyEnvelope({
        clientPlanVersion: 7,
        acceptedRiskReason: "Перегруз согласован на steering committee"
      })
    ).toEqual({
      ok: true,
      value: {
        clientPlanVersion: 7,
        acceptedRiskReason: "Перегруз согласован на steering committee"
      }
    });
    expect(parseScenarioPreviewEnvelope({ clientPlanVersion: 0, target: {} })).toEqual({
      ok: false,
      error: "planning_scenario_invalid"
    });
  });
});
