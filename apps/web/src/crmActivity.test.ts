import { describe, expect, it } from "vitest";

import type { CrmActivity, CrmSystemEvent } from "./api";
import {
  composeCrmFeedItems,
  formatActivityCountLabel,
  getCrmActivityTabs,
  getCrmActivitySummary,
  groupCrmFeedItemsByDay,
  sortCrmTasks
} from "./crmActivity";

const baseActivity = {
  tenantId: "tenant-1",
  entityType: "opportunity",
  entityId: "opportunity-1",
  body: null,
  dueDate: null,
  assigneeUserId: null,
  authorUserId: "user-1",
  fileUrl: null,
  fileSizeBytes: null,
  mimeType: null,
  updatedAt: "2026-05-20T10:00:00.000Z"
} satisfies Omit<CrmActivity, "id" | "type" | "title" | "status" | "createdAt">;

describe("CRM activity helpers", () => {
  it("keeps the CRM activity rail honest: only backed tabs are enabled", () => {
    expect(getCrmActivityTabs({ feedCount: 3, fileCount: 2, taskCount: 1 })).toEqual([
      {
        count: 3,
        disabledReason: null,
        id: "feed",
        isEnabled: true,
        label: "Лента"
      },
      {
        count: 1,
        disabledReason: null,
        id: "tasks",
        isEnabled: true,
        label: "Задачи"
      },
      {
        count: 2,
        disabledReason: null,
        id: "files",
        isEnabled: true,
        label: "Файлы"
      }
    ]);
  });

  it("combines persisted activity and system events from newest to oldest", () => {
    const activities = [
      {
        id: "activity-old",
        entityType: "opportunity",
        entityId: "opportunity-1",
        tenantId: "tenant-1",
        type: "comment",
        title: null,
        body: "Старый комментарий",
        status: null,
        dueDate: null,
        assigneeUserId: null,
        authorUserId: "user-1",
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null,
        createdAt: "2026-05-20T08:00:00.000Z",
        updatedAt: "2026-05-20T08:00:00.000Z"
      },
      {
        id: "activity-new",
        entityType: "opportunity",
        entityId: "opportunity-1",
        tenantId: "tenant-1",
        type: "task",
        title: "Новая задача",
        body: null,
        status: "todo",
        dueDate: null,
        assigneeUserId: null,
        authorUserId: "user-1",
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null,
        createdAt: "2026-05-20T10:00:00.000Z",
        updatedAt: "2026-05-20T10:00:00.000Z"
      }
    ] satisfies CrmActivity[];
    const systemEvents = [
      {
        id: "audit-mid",
        actionType: "opportunity.stage.updated",
        actorUserId: "user-1",
        executionStatus: "success",
        sourceWorkflow: "opportunity",
        createdAt: "2026-05-20T09:00:00.000Z"
      }
    ] satisfies CrmSystemEvent[];

    expect(composeCrmFeedItems(activities, systemEvents).map((item) => item.createdAt)).toEqual([
      "2026-05-20T10:00:00.000Z",
      "2026-05-20T09:00:00.000Z",
      "2026-05-20T08:00:00.000Z"
    ]);
  });

  it("formats Russian activity counter labels", () => {
    expect(formatActivityCountLabel(0)).toBe("0 элементов");
    expect(formatActivityCountLabel(1)).toBe("1 элемент");
    expect(formatActivityCountLabel(2)).toBe("2 элемента");
    expect(formatActivityCountLabel(5)).toBe("5 элементов");
    expect(formatActivityCountLabel(11)).toBe("11 элементов");
    expect(formatActivityCountLabel(21)).toBe("21 элемент");
  });

  it("builds a compact CRM activity summary", () => {
    const activities = [
      {
        ...baseActivity,
        id: "comment-1",
        type: "comment",
        title: null,
        body: "Комментарий",
        status: null,
        createdAt: "2026-05-20T09:00:00.000Z"
      },
      {
        ...baseActivity,
        id: "task-open",
        type: "task",
        title: "Позвонить клиенту",
        status: "todo",
        createdAt: "2026-05-20T10:00:00.000Z"
      },
      {
        ...baseActivity,
        id: "task-done",
        type: "task",
        title: "Согласовать КП",
        status: "done",
        createdAt: "2026-05-20T08:00:00.000Z"
      }
    ] satisfies CrmActivity[];
    const feedItems = composeCrmFeedItems(activities, []);

    expect(getCrmActivitySummary({ activities, feedItems })).toEqual({
      commentCount: 1,
      openTaskCount: 1,
      latestActivityAt: "2026-05-20T10:00:00.000Z"
    });
  });

  it("groups feed items by relative CRM timeline date", () => {
    const activities = [
      {
        ...baseActivity,
        id: "comment-today",
        type: "comment",
        title: null,
        body: "Сегодня",
        status: null,
        createdAt: "2026-05-20T08:00:00.000Z"
      },
      {
        ...baseActivity,
        id: "comment-yesterday",
        type: "comment",
        title: null,
        body: "Вчера",
        status: null,
        createdAt: "2026-05-19T08:00:00.000Z"
      }
    ] satisfies CrmActivity[];
    const groups = groupCrmFeedItemsByDay(
      composeCrmFeedItems(activities, []),
      new Date("2026-05-20T12:00:00.000Z")
    );

    expect(groups.map((group) => group.label)).toEqual(["Сегодня", "Вчера"]);
    expect(groups.map((group) => group.items.map((item) => item.createdAt))).toEqual([
      ["2026-05-20T08:00:00.000Z"],
      ["2026-05-19T08:00:00.000Z"]
    ]);
  });

  it("sorts CRM follow-up tasks by actionable state first", () => {
    const tasks = [
      {
        ...baseActivity,
        id: "done-new",
        type: "task",
        title: "Выполненная новая",
        status: "done",
        createdAt: "2026-05-20T12:00:00.000Z"
      },
      {
        ...baseActivity,
        id: "todo-old",
        type: "task",
        title: "Открытая старая",
        status: "todo",
        createdAt: "2026-05-20T08:00:00.000Z"
      },
      {
        ...baseActivity,
        id: "todo-new",
        type: "task",
        title: "Открытая новая",
        status: "todo",
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ] satisfies CrmActivity[];

    expect(sortCrmTasks(tasks).map((task) => task.id)).toEqual([
      "todo-new",
      "todo-old",
      "done-new"
    ]);
  });
});
