import { describe, expect, it } from "vitest";

import {
  deriveControlSignalNotifications,
  derivePlanningNotifications,
  extractMentionedUserIds,
  parseCallMediaKind,
  parseCallParticipantState,
  parseCallRoomProvider,
  parseCallRoomStatus,
  parseCallTitle,
  parseProviderRoomId,
  parseCollaborationEntityType,
  parseMessageBody,
  parseMeetingAgenda
} from "./collaboration";
import type { ControlSignal, PlanSnapshot } from "./index";

describe("collaboration domain contract", () => {
  it("accepts only scoped collaboration entity types", () => {
    expect(parseCollaborationEntityType("project")).toEqual({ ok: true, value: "project" });
    expect(parseCollaborationEntityType("task")).toEqual({ ok: true, value: "task" });
    expect(parseCollaborationEntityType("client")).toEqual({
      ok: false,
      error: "collaboration_entity_type_invalid"
    });
  });

  it("extracts unique mention user ids from plain text", () => {
    expect(extractMentionedUserIds("Привет @user-a и @user-b, снова @user-a")).toEqual([
      "user-a",
      "user-b"
    ]);
  });

  it("rejects empty and control-character message bodies", () => {
    expect(parseMessageBody("   ")).toEqual({ ok: false, error: "message_body_required" });
    expect(parseMessageBody("hello\u0001")).toEqual({
      ok: false,
      error: "message_body_invalid"
    });
  });

  it("keeps agenda optional but bounded plain text", () => {
    expect(parseMeetingAgenda(undefined)).toEqual({ ok: true, value: "" });
    expect(parseMeetingAgenda("  План встречи  ")).toEqual({ ok: true, value: "План встречи" });
  });

  it("validates call room provider, media kind and lifecycle statuses", () => {
    expect(parseCallRoomProvider("livekit")).toEqual({ ok: true, value: "livekit" });
    expect(parseCallRoomProvider("zoom")).toEqual({
      ok: false,
      error: "call_room_provider_invalid"
    });
    expect(parseCallMediaKind("video")).toEqual({ ok: true, value: "video" });
    expect(parseCallRoomStatus("active")).toEqual({ ok: true, value: "active" });
    expect(parseCallParticipantState("joined")).toEqual({ ok: true, value: "joined" });
  });

  it("validates call room display title and opaque provider room id", () => {
    expect(parseCallTitle("  Проектный звонок  ")).toEqual({
      ok: true,
      value: "Проектный звонок"
    });
    expect(parseCallTitle("")).toEqual({ ok: false, error: "call_title_required" });
    expect(parseProviderRoomId("project-alpha-room")).toEqual({
      ok: true,
      value: "project-alpha-room"
    });
    expect(parseProviderRoomId("../secret")).toEqual({
      ok: false,
      error: "provider_room_id_invalid"
    });
  });

  it("derives assignment and deadline notifications from planning commands", () => {
    const snapshot = planSnapshot();
    expect(derivePlanningNotifications({
      actorUserId: "user-manager",
      beforeSnapshot: snapshot,
      afterSnapshot: snapshot,
      commands: [
        {
          type: "assignment.upsert",
          payload: {
            id: "assignment-a",
            taskId: "task-a",
            resourceId: "resource-a",
            role: "executor",
            unitsPermille: 1000,
            workMinutes: null
          }
        },
        {
          type: "project.deadline.move",
          payload: { deadline: "2026-06-10", reason: "customer deadline" }
        }
      ]
    })).toEqual([
      expect.objectContaining({
        userId: "user-a",
        notificationType: "assignment_changed",
        sourceEntityType: "project",
        sourceEntityId: "project-a",
        body: "Task A"
      }),
      expect.objectContaining({
        userId: "user-a",
        notificationType: "deadline_risk",
        sourceEntityType: "project",
        sourceEntityId: "project-a"
      })
    ]);
  });

  it("keeps assignment deletion notifications based on the previous snapshot", () => {
    const beforeSnapshot = planSnapshot();
    const afterSnapshot = { ...beforeSnapshot, assignments: [] };
    expect(derivePlanningNotifications({
      actorUserId: "user-manager",
      beforeSnapshot,
      afterSnapshot,
      commands: [{ type: "assignment.delete", payload: { assignmentId: "assignment-a" } }]
    })).toEqual([
      expect.objectContaining({
        userId: "user-a",
        notificationType: "assignment_changed",
        body: "Task A"
      })
    ]);
  });

  it("does not notify non-person planning resources", () => {
    const base = planSnapshot();
    const snapshot = {
      ...base,
      resources: [{ ...base.resources[0]!, userId: null }]
    };

    expect(derivePlanningNotifications({
      actorUserId: "user-manager",
      beforeSnapshot: snapshot,
      afterSnapshot: snapshot,
      commands: [
        {
          type: "assignment.upsert",
          payload: {
            id: "assignment-a",
            taskId: "task-a",
            resourceId: "resource-a",
            role: "executor",
            unitsPermille: 1000,
            workMinutes: null
          }
        }
      ]
    })).toEqual([]);
  });

  it("derives control signal notifications for signal owner or project participants", () => {
    const snapshot = planSnapshot();
    const signal: ControlSignal = {
      id: "signal-a",
      tenantId: "tenant-a",
      projectId: "project-a",
      sourceEntity: { type: "Project", id: "project-a" },
      sourceMetric: "deadline_slip_days",
      evaluationId: "evaluation-a",
      severity: "critical",
      explanation: "Deadline risk",
      ownerUserId: "user-owner",
      allowedActions: [],
      scenarioProposals: [],
      status: "open",
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-26T00:00:00.000Z"
    };
    expect(deriveControlSignalNotifications({
      actorUserId: "user-manager",
      snapshot,
      signals: [signal]
    })).toEqual([
      expect.objectContaining({
        userId: "user-owner",
        notificationType: "control_signal",
        sourceEntityType: "project",
        sourceEntityId: "project-a"
      })
    ]);
  });

  it("notifies only newly opened control signals", () => {
    const snapshot = planSnapshot();
    const signal: ControlSignal = {
      id: "signal-a",
      tenantId: "tenant-a",
      projectId: "project-a",
      sourceEntity: { type: "Project", id: "project-a" },
      sourceMetric: "deadline_slip_days",
      evaluationId: "evaluation-a",
      severity: "critical",
      explanation: "Deadline risk",
      ownerUserId: null,
      allowedActions: [],
      scenarioProposals: [],
      status: "open",
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-26T01:00:00.000Z"
    };

    expect(deriveControlSignalNotifications({
      actorUserId: "user-manager",
      snapshot,
      signals: [signal],
      previousSignals: [{ ...signal, updatedAt: "2026-05-26T00:30:00.000Z" }]
    })).toEqual([]);

    expect(deriveControlSignalNotifications({
      actorUserId: "user-manager",
      snapshot,
      signals: [signal],
      previousSignals: [{ ...signal, status: "acknowledged" }]
    })).toEqual([
      expect.objectContaining({
        userId: "user-a",
        notificationType: "control_signal"
      })
    ]);
  });
});

function planSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-a",
    projectId: "project-a",
    planVersion: 1,
    project: {
      id: "project-a",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-15",
      deadline: "2026-06-12",
      calendarId: null
    },
    tasks: [
      {
        id: "task-a",
        parentTaskId: null,
        wbsCode: "1",
        title: "Task A",
        statusId: "status-active",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-03",
        durationMinutes: 960,
        workMinutes: 960,
        percentComplete: 0,
        calendarId: null,
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-a",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: null,
        calendarId: null
      }
    ],
    dependencies: [],
    baselines: [],
    calendars: [],
    calendarExceptions: [],
    resources: [
      {
        id: "resource-a",
        userId: "user-a",
        positionId: null,
        teamId: null,
        name: "User A",
        calendarId: null
      }
    ],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-26T00:00:00.000Z"
  };
}
