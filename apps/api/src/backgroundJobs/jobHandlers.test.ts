import { describe, expect, it } from "vitest";

import type { BackgroundJobRun, NotificationPreference, UserNotification } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "../apiTypes";
import { createInMemoryEmailProvider } from "../emailProvider";
import { createDefaultBackgroundJobRegistry } from "./jobHandlers";

function purgeJob(payload: Record<string, unknown> = {}): BackgroundJobRun {
  return {
    id: "job-1",
    tenantId: "tenant-1",
    kind: "planning.expired_runs_purge",
    status: "running",
    priority: 0,
    payload,
    idempotencyKey: null,
    attempt: 1,
    maxAttempts: 5,
    runAfter: new Date("2026-07-18T00:00:00.000Z"),
    lockedBy: "worker",
    lockedAt: new Date("2026-07-18T00:00:00.000Z"),
    startedAt: new Date("2026-07-18T00:00:00.000Z"),
    finishedAt: null,
    lastError: null,
    createdAt: new Date("2026-07-18T00:00:00.000Z"),
    updatedAt: new Date("2026-07-18T00:00:00.000Z")
  };
}

describe("planning.expired_runs_purge handler", () => {
  it("зовёт purge с grace-периодом retentionHours и возвращает счётчики", async () => {
    const calls: Array<{ tenantId: string; expiredBefore: Date }> = [];
    const dataSource = {
      async purgeExpiredPlanningRuns(input: { tenantId: string; expiredBefore: Date }) {
        calls.push(input);
        return { scenarioRuns: 3, solverRuns: 1 };
      }
    } as unknown as ApiTenantDataSource;
    const handler = createDefaultBackgroundJobRegistry()["planning.expired_runs_purge"]!;
    const now = new Date("2026-07-18T12:00:00.000Z");

    const result = await handler(purgeJob({ retentionHours: 48 }), { dataSource, now });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.tenantId).toBe("tenant-1");
    // Grace: удаляем только истёкшее раньше, чем now - retentionHours.
    expect(calls[0]!.expiredBefore.toISOString()).toBe("2026-07-16T12:00:00.000Z");
    expect(result).toEqual({
      message: "Expired planning runs purged",
      metadata: { scenarioRuns: 3, solverRuns: 1, retentionHours: 48 }
    });
  });

  it("fail-closed без persistence-метода: бросает planning_runs_purge_not_configured", async () => {
    const handler = createDefaultBackgroundJobRegistry()["planning.expired_runs_purge"]!;
    await expect(
      handler(purgeJob(), { dataSource: {} as ApiTenantDataSource, now: new Date() })
    ).rejects.toThrow("planning_runs_purge_not_configured");
  });
});

function dispatchJob(payload: Record<string, unknown> = {}): BackgroundJobRun {
  return { ...purgeJob(payload), kind: "notification.dispatch" };
}

function notification(overrides: Partial<UserNotification>): UserNotification {
  return {
    id: "notif-1",
    tenantId: "tenant-1",
    userId: "user-active",
    notificationType: "mention",
    sourceEntityType: "task",
    sourceEntityId: "task-1",
    title: "Вас упомянули",
    body: "В задаче «Смета»",
    route: "/projects/p1/tasks/task-1",
    createdAt: new Date("2026-07-18T11:55:00.000Z"),
    readAt: null,
    archivedAt: null,
    ...overrides
  };
}

function preference(overrides: Partial<NotificationPreference>): NotificationPreference {
  return {
    tenantId: "tenant-1",
    userId: "user-active",
    channel: "email",
    notificationType: "mention",
    enabled: true,
    digestFrequency: "none",
    ...overrides
  };
}

describe("notification.dispatch handler", () => {
  const now = new Date("2026-07-18T12:00:00.000Z"); // окно 15 мин → createdAfter = 11:45

  function createFakeDataSource(input: {
    users: Array<{ id: string; name: string; email: string; status: string }>;
    preferences: Record<string, NotificationPreference[]>;
    notifications: Record<string, UserNotification[]>;
  }): ApiTenantDataSource {
    return {
      async listWorkspaceUsers() {
        return input.users as never;
      },
      async listNotificationPreferences(_tenantId: string, userId: string) {
        return input.preferences[userId] ?? [];
      },
      async listUserNotifications(query: { userId: string }) {
        return input.notifications[query.userId] ?? [];
      }
    } as unknown as ApiTenantDataSource;
  }

  it("шлёт email-дайджест непрочитанных за окно только по включённым email/digest каналам", async () => {
    const dataSource = createFakeDataSource({
      users: [
        { id: "user-active", name: "Алиса", email: "alice@example.com", status: "active" },
        { id: "user-inactive", name: "Борис", email: "boris@example.com", status: "inactive" },
        { id: "user-noemail", name: "Вера", email: "", status: "active" },
        { id: "user-nopref", name: "Глеб", email: "gleb@example.com", status: "active" }
      ],
      preferences: {
        "user-active": [preference({ channel: "email", notificationType: "mention", enabled: true })],
        "user-inactive": [preference({ userId: "user-inactive", channel: "email", enabled: true })],
        "user-nopref": [preference({ userId: "user-nopref", channel: "in_app", enabled: true })]
      },
      notifications: {
        "user-active": [
          notification({ id: "n-mention-in", notificationType: "mention" }),
          // Тип без включённого email-канала — исключается.
          notification({ id: "n-assign", notificationType: "assignment_changed" }),
          // За пределами окна (создано до 11:45) — исключается.
          notification({ id: "n-old", createdAt: new Date("2026-07-18T11:30:00.000Z") })
        ]
      }
    });
    const emailProvider = createInMemoryEmailProvider();
    const handler = createDefaultBackgroundJobRegistry()["notification.dispatch"]!;

    const result = await handler(dispatchJob(), { dataSource, emailProvider, now });

    expect(emailProvider.notificationDigests).toHaveLength(1);
    const digest = emailProvider.notificationDigests[0]!;
    expect(digest.email).toBe("alice@example.com");
    expect(digest.recipientName).toBe("Алиса");
    expect(digest.items.map((item) => item.title)).toEqual(["Вас упомянули"]);
    expect(result).toEqual({
      message: "Notification digest dispatched",
      metadata: { emailedUsers: 1, deliveredNotifications: 1, lookbackMinutes: 15 }
    });
  });

  it("digest-канал с freq=none не доставляет, daily — доставляет", async () => {
    const dataSource = createFakeDataSource({
      users: [
        { id: "user-none", name: "Дина", email: "dina@example.com", status: "active" },
        { id: "user-daily", name: "Егор", email: "egor@example.com", status: "active" }
      ],
      preferences: {
        "user-none": [preference({ userId: "user-none", channel: "digest", digestFrequency: "none" })],
        "user-daily": [preference({ userId: "user-daily", channel: "digest", digestFrequency: "daily" })]
      },
      notifications: {
        "user-none": [notification({ userId: "user-none" })],
        "user-daily": [notification({ userId: "user-daily" })]
      }
    });
    const emailProvider = createInMemoryEmailProvider();
    const handler = createDefaultBackgroundJobRegistry()["notification.dispatch"]!;

    const result = await handler(dispatchJob(), { dataSource, emailProvider, now });

    expect(emailProvider.notificationDigests.map((digest) => digest.email)).toEqual([
      "egor@example.com"
    ]);
    expect(result).toMatchObject({ metadata: { emailedUsers: 1 } });
  });

  it("fail-closed без emailProvider: бросает notification_dispatch_not_configured", async () => {
    const dataSource = createFakeDataSource({ users: [], preferences: {}, notifications: {} });
    const handler = createDefaultBackgroundJobRegistry()["notification.dispatch"]!;
    await expect(handler(dispatchJob(), { dataSource, now })).rejects.toThrow(
      "notification_dispatch_not_configured"
    );
  });
});
