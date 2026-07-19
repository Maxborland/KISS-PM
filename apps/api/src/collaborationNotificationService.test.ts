import { describe, expect, it } from "vitest";

import type { ControlSignal, PlanSnapshot } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "./apiTypes";
import {
  persistControlSignalNotifications,
  persistPlanningNotifications
} from "./collaborationNotificationService";
import { subscribeWorkspaceEvents, userChannel } from "./workspaceEventBus";

/* ============================================================
   P8 realtime: persist*Notifications обязаны сопровождать каждое
   персистентное уведомление событием notification.created в user-канал
   получателя (паритет с mention-путём collaborationRoutes). Подписчик —
   fake через реальный in-memory bus (subscribeWorkspaceEvents).
   ============================================================ */

type CreatedNotification = { userId: string; notificationType: string };

// Fake-датасорс: записывает входы createUserNotification, эхо-возвращает вход.
function fakeDataSource(created: CreatedNotification[]) {
  return {
    createUserNotification: async (input: { userId: string; notificationType: string }) => {
      created.push({ userId: input.userId, notificationType: input.notificationType });
      return input;
    }
  } as unknown as Pick<ApiTenantDataSource, "createUserNotification">;
}

// Слушаем user-канал получателя, собираем notification.created.
function listenUserChannel(userId: string) {
  const received: CreatedNotification[] = [];
  const unsubscribe = subscribeWorkspaceEvents(userChannel(userId), (event) => {
    if (event.type === "notification.created") {
      received.push({ userId: event.userId, notificationType: event.notificationType });
    }
  });
  return { received, unsubscribe };
}

// Минимальный план-снимок (копия фикстуры packages/domain/src/collaboration.test.ts):
// task-a → assignment-a → resource-a → user-a.
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

describe("collaborationNotificationService realtime", () => {
  it("persistPlanningNotifications эмитит notification.created получателю", async () => {
    const snapshot = planSnapshot();
    const created: CreatedNotification[] = [];
    const listener = listenUserChannel("user-a");
    try {
      await persistPlanningNotifications({
        dataSource: fakeDataSource(created),
        tenantId: "tenant-a",
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
      });
    } finally {
      listener.unsubscribe();
    }
    // Персист и эмит согласованы 1:1: каждый createUserNotification → одно событие.
    expect(created).toEqual([{ userId: "user-a", notificationType: "assignment_changed" }]);
    expect(listener.received).toEqual([{ userId: "user-a", notificationType: "assignment_changed" }]);
  });

  it("persistControlSignalNotifications эмитит notification.created владельцу сигнала", async () => {
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
    const created: CreatedNotification[] = [];
    const listener = listenUserChannel("user-owner");
    try {
      await persistControlSignalNotifications({
        dataSource: fakeDataSource(created),
        tenantId: "tenant-a",
        actorUserId: "user-manager",
        snapshot: planSnapshot(),
        signals: [signal]
      });
    } finally {
      listener.unsubscribe();
    }
    expect(created).toEqual([{ userId: "user-owner", notificationType: "control_signal" }]);
    expect(listener.received).toEqual([{ userId: "user-owner", notificationType: "control_signal" }]);
  });

  it("без createUserNotification в датасорсе не эмитит ничего (ранний выход)", async () => {
    const listener = listenUserChannel("user-a");
    try {
      await persistPlanningNotifications({
        dataSource: {} as Pick<ApiTenantDataSource, "createUserNotification">,
        tenantId: "tenant-a",
        actorUserId: "user-manager",
        beforeSnapshot: planSnapshot(),
        afterSnapshot: planSnapshot(),
        commands: []
      });
    } finally {
      listener.unsubscribe();
    }
    expect(listener.received).toEqual([]);
  });
});
