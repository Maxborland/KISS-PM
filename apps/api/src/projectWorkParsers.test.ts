import { describe, expect, it } from "vitest";

import {
  parseCreateTaskBody,
  parseCreateTaskStatusBody,
  parseTaskCommentBody,
  parseUpdateTaskBody,
  parseUpdateTaskStatusBody
} from "./projectWorkParsers";

describe("project work parsers", () => {
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
      value: { body: "Проверил ресурсный план." }
    });
  });
});
