import { describe, expect, it } from "vitest";

import {
  parseCreateTaskBody,
  parseCreateTaskStatusBody,
  parseProjectIdParam,
  parseTaskIdParam,
  parseTaskStatusIdParam,
  parseTaskCommentBody,
  parseUpdateTaskBody,
  parseUpdateTaskStatusBody
} from "./projectWorkParsers";

describe("project work parsers", () => {
  it("rejects path-like route identifiers before workspace lookup", () => {
    expect(parseProjectIdParam("project-alpha")).toEqual({
      ok: true,
      value: "project-alpha"
    });
    expect(parseTaskIdParam(" task-alpha ")).toEqual({
      ok: true,
      value: "task-alpha"
    });
    expect(parseTaskStatusIdParam("task-status-new")).toEqual({
      ok: true,
      value: "task-status-new"
    });

    expect(parseProjectIdParam("bad..project")).toEqual({
      ok: false,
      error: "invalid_project_id"
    });
    expect(parseTaskIdParam("bad/task")).toEqual({
      ok: false,
      error: "invalid_task_id"
    });
    expect(parseTaskStatusIdParam("external-ref-123.")).toEqual({
      ok: false,
      error: "invalid_task_status_id"
    });
  });

  it("parses a valid manual task creation payload", () => {
    expect(
      parseCreateTaskBody({
        id: "task-alpha",
        title: "Подготовить план внедрения",
        description: "Собрать стартовый план",
        priority: "high",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 4,
        plannedWork: 24,
        requiresAcceptance: true,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({
      ok: true,
      value: {
        id: "task-alpha",
        title: "Подготовить план внедрения",
        description: "Собрать стартовый план",
        priority: "high",
        plannedStart: new Date("2026-06-02T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
        durationWorkingDays: 4,
        plannedWork: 24,
        requiresAcceptance: true,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      }
    });
  });

  it("rejects invalid task dates, work and participant roles", () => {
    expect(
      parseCreateTaskBody({
        title: "x",
        plannedStart: "2026-06-05",
        plannedFinish: "2026-06-02",
        durationWorkingDays: 1,
        plannedWork: 0,
        participants: [{ userId: "user-alpha-executor", role: "manager" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_title" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-05",
        plannedFinish: "2026-06-02",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_dates" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-02-31",
        plannedFinish: "2026-03-05",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_dates" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 0,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_duration" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 1,
        plannedWork: 0,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_planned_work" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "manager" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_participant_role" });
  });

  it("rejects unsafe task text and participant identifiers before persistence", () => {
    expect(
      parseCreateTaskBody({
        title: "Подготовить план\nX-Audit: spoof",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_title" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        description: "A".repeat(4001),
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_description" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        description: "Visible\u0000hidden",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_description" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor\nhidden", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_participant" });
  });

  it("requires at least one executor participant", () => {
    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-admin", role: "controller" }]
      })
    ).toEqual({ ok: false, error: "task_executor_required" });
  });

  it.each(["\ud800", "\ufffd", "bad/task", "ab"])(
    "rejects unsafe client task id %j before persistence",
    (id) => {
      expect(
        parseCreateTaskBody({
          id,
          title: "Подготовить план",
          plannedStart: "2026-06-02",
          plannedFinish: "2026-06-05",
          durationWorkingDays: 1,
          plannedWork: 8,
          participants: [{ userId: "user-alpha-executor", role: "executor" }]
        })
      ).toEqual({ ok: false, error: "invalid_task_id" });
    }
  );
  it.each([42, {}, null])(
    "rejects non-string client task id %j instead of generating one",
    (id) => {
      expect(
        parseCreateTaskBody({
          id,
          title: "Подготовить план",
          plannedStart: "2026-06-02",
          plannedFinish: "2026-06-05",
          durationWorkingDays: 1,
          plannedWork: 8,
          participants: [{ userId: "user-alpha-executor", role: "executor" }]
        })
      ).toEqual({ ok: false, error: "invalid_task_id" });
    }
  );


  it("treats blank task id as absent so callers can generate one", () => {
    expect(
      parseCreateTaskBody({
        id: "   ",
        title: "Подготовить план",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 1,
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({
      ok: true,
      value: {
        id: undefined,
        title: "Подготовить план",
        description: null,
        priority: "normal",
        plannedStart: new Date("2026-06-02T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
        durationWorkingDays: 1,
        plannedWork: 8,
        requiresAcceptance: false,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      }
    });
  });

  it("parses supported task status transitions and rejects unknown statuses", () => {
    expect(parseUpdateTaskStatusBody({ statusId: "task-status-in-progress" })).toEqual({
      ok: true,
      value: { statusId: "task-status-in-progress" }
    });
    expect(parseUpdateTaskStatusBody({ status: "cancelled" })).toEqual({
      ok: false,
      error: "invalid_task_status"
    });
  });

  it("parses task update, task status settings and task comments", () => {
    expect(
      parseUpdateTaskBody({
        title: "Уточнить ресурсную оценку",
        description: "Проверить роли",
        statusId: "task-status-waiting",
        priority: "normal",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 4,
        plannedWork: 16,
        requiresAcceptance: false,
        clientUpdatedAt: "2026-05-21T00:00:00.000Z",
        participants: [
          { userId: "user-alpha-admin", role: "requester" },
          { userId: "user-alpha-executor", role: "executor" }
        ]
      })
    ).toEqual({
      ok: true,
      value: expect.objectContaining({
        title: "Уточнить ресурсную оценку",
        statusId: "task-status-waiting",
        clientUpdatedAt: new Date("2026-05-21T00:00:00.000Z"),
        durationWorkingDays: 4,
        requiresAcceptance: false
      })
    });
    expect(
      parseCreateTaskStatusBody({
        id: "task-status-paused",
        name: "Пауза",
        category: "waiting",
        sortOrder: 25
      })
    ).toEqual({
      ok: true,
      value: {
        id: "task-status-paused",
        name: "Пауза",
        category: "waiting",
        sortOrder: 25,
        status: "active"
      }
    });
    expect(parseTaskCommentBody({ body: "Проверил ресурсный план." })).toEqual({
      ok: true,
      value: { body: "Проверил ресурсный план.", clientRequestId: null }
    });
  });

  it("rejects unsafe task status names and comments", () => {
    expect(
      parseCreateTaskStatusBody({
        id: "task-status-paused",
        name: "Пауза\nhidden",
        category: "waiting",
        sortOrder: 25
      })
    ).toEqual({ ok: false, error: "invalid_task_status_name" });

    expect(parseTaskCommentBody({ body: "Проверил\u0000скрыто" })).toEqual({
      ok: false,
      error: "invalid_task_comment"
    });
  });
});
