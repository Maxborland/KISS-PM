import { describe, expect, it } from "vitest";

import { parseCreateTaskBody } from "./projectWorkParsers";

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
        plannedWork: 24,
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
        plannedWork: 24,
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
        plannedWork: 0,
        participants: [{ userId: "user-alpha-executor", role: "manager" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_title" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-05",
        plannedFinish: "2026-06-02",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_dates" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-02-31",
        plannedFinish: "2026-03-05",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_dates" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 0,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    ).toEqual({ ok: false, error: "invalid_task_planned_work" });

    expect(
      parseCreateTaskBody({
        title: "Подготовить план",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
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
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      }
    });
  });
});
