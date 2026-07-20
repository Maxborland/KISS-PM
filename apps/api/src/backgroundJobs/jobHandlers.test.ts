import { describe, expect, it, vi } from "vitest";

import type { BackgroundJobRun, NotificationPreference } from "@kiss-pm/domain";
import type { PendingNotificationDelivery } from "@kiss-pm/persistence";

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

function notification(
  overrides: Partial<PendingNotificationDelivery>
): PendingNotificationDelivery {
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

type FakeUser = {
  id: string;
  name: string;
  email: string;
  status: string;
  accessProfileId: string;
  tenantId: string;
};

function fakeUser(id: string, name: string, overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id,
    name,
    email: `${id}@example.com`,
    status: "active",
    accessProfileId: "profile-1",
    tenantId: "tenant-1",
    ...overrides
  };
}

describe("notification.dispatch handler", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");

  type FakeTask = { id: string; title: string; ownerUserId: string; participants: string[] };

  function createFakeDataSource(input: {
    users: FakeUser[];
    preferences: NotificationPreference[];
    pending: PendingNotificationDelivery[];
    // Профиль без tenant.projects.read: читаемость задачи определяется
    // владением/участием — так тест управляет per-entity правами явно.
    tasks?: FakeTask[];
  }) {
    const marked: Array<{ notificationIds: readonly string[]; deliveredAt: Date }> = [];
    const failed: Array<{ notificationIds: readonly string[]; maxAttempts: number }> = [];
    // Счётчик попыток доставки, как delivery_attempts в user_notifications.
    const attempts = new Map<string, number>();
    const pendingCalls: Array<{ tenantId: string; limit: number }> = [];
    const listWorkspaceUsers = vi.fn(async () => input.users as never);
    const listNotificationPreferencesForUsers = vi.fn(
      async (_tenantId: string, userIds: readonly string[]) =>
        input.preferences.filter((item) => userIds.includes(item.userId))
    );
    // Не должен вызываться вообще: старый per-user путь (N+1).
    const listUserNotifications = vi.fn(async () => []);
    const listNotificationPreferences = vi.fn(async () => []);
    const tasksById = new Map((input.tasks ?? []).map((task) => [task.id, task]));

    const dataSource = {
      listWorkspaceUsers,
      listNotificationPreferencesForUsers,
      listUserNotifications,
      listNotificationPreferences,
      async findAccessProfileById() {
        return { id: "profile-1", permissions: [] };
      },
      async findTaskById(_tenantId: string, taskId: string) {
        const task = tasksById.get(taskId);
        if (!task) return undefined;
        return {
          id: task.id,
          title: task.title,
          ownerUserId: task.ownerUserId,
          requesterUserId: null,
          participants: task.participants.map((userId) => ({ userId }))
        };
      },
      async listProjects() {
        return [];
      },
      async listPendingNotificationDeliveries(query: { tenantId: string; limit: number }) {
        pendingCalls.push(query);
        // Как в SQL: старые первыми и жёсткий лимит окна — иначе тест не увидит
        // head-of-line blocking, ради которого лимит и существует.
        return [...input.pending]
          .sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime() ||
              left.id.localeCompare(right.id)
          )
          .slice(0, query.limit);
      },
      async markUserNotificationsDelivered(markInput: {
        notificationIds: readonly string[];
        deliveredAt: Date;
      }) {
        marked.push(markInput);
        // Симулируем маркер: размеченные строки уходят из очереди.
        input.pending = input.pending.filter(
          (item) => !markInput.notificationIds.includes(item.id)
        );
        return markInput.notificationIds.length;
      },
      async recordFailedNotificationDeliveries(failInput: {
        notificationIds: readonly string[];
        maxAttempts: number;
        deadLetteredAt: Date;
      }) {
        failed.push(failInput);
        let retried = 0;
        const deadLetteredIds: string[] = [];
        for (const notificationId of failInput.notificationIds) {
          const nextAttempt = (attempts.get(notificationId) ?? 0) + 1;
          attempts.set(notificationId, nextAttempt);
          if (nextAttempt >= failInput.maxAttempts) deadLetteredIds.push(notificationId);
          else retried += 1;
        }
        // Dead-letter = тот же маркер: строка уходит из очереди навсегда.
        input.pending = input.pending.filter((item) => !deadLetteredIds.includes(item.id));
        return { retried, deadLettered: deadLetteredIds.length };
      }
    } as unknown as ApiTenantDataSource;

    return {
      dataSource,
      marked,
      failed,
      attempts,
      markedIds: () => marked.flatMap((entry) => [...entry.notificationIds]),
      pendingCalls,
      listWorkspaceUsers,
      listNotificationPreferencesForUsers,
      listUserNotifications,
      listNotificationPreferences
    };
  }

  const handler = () => createDefaultBackgroundJobRegistry()["notification.dispatch"]!;

  it("шлёт дайджест только по включённым email/digest каналам и метит доставленное", async () => {
    const fake = createFakeDataSource({
      users: [
        fakeUser("user-active", "Алиса"),
        fakeUser("user-inactive", "Борис", { status: "inactive" }),
        fakeUser("user-noemail", "Вера", { email: "" }),
        fakeUser("user-nopref", "Глеб")
      ],
      preferences: [
        preference({ userId: "user-active", channel: "email", notificationType: "mention" }),
        preference({ userId: "user-inactive", channel: "email" }),
        preference({ userId: "user-nopref", channel: "in_app" })
      ],
      pending: [
        notification({ id: "n-mention", userId: "user-active" }),
        // Тип без включённого email-канала — терминальный отказ.
        notification({ id: "n-assign", userId: "user-active", notificationType: "assignment_changed" }),
        notification({ id: "n-inactive", userId: "user-inactive" }),
        notification({ id: "n-noemail", userId: "user-noemail" }),
        notification({ id: "n-nopref", userId: "user-nopref" })
      ],
      tasks: [{ id: "task-1", title: "Смета", ownerUserId: "user-active", participants: [] }]
    });
    const emailProvider = createInMemoryEmailProvider();

    const result = await handler()(dispatchJob(), {
      dataSource: fake.dataSource,
      emailProvider,
      now
    });

    expect(emailProvider.notificationDigests).toHaveLength(1);
    const digest = emailProvider.notificationDigests[0]!;
    expect(digest.email).toBe("user-active@example.com");
    expect(digest.recipientName).toBe("Алиса");
    expect(digest.items.map((item) => item.title)).toEqual(["Вас упомянули"]);
    expect(result).toMatchObject({
      message: "Notification digest dispatched",
      metadata: { scanned: 5, emailedUsers: 1, deliveredNotifications: 1, failedRecipients: 0 }
    });
    // Терминальные отказы тоже получают маркер — иначе очередь не разгребается.
    expect(new Set(fake.markedIds())).toEqual(
      new Set(["n-mention", "n-assign", "n-inactive", "n-noemail", "n-nopref"])
    );
  });

  // F1: раньше исключение на одном получателе выбрасывало из цикла — джоба падала,
  // ретрай пересобирал окно и рассылал дубли уже отправленным, а хвост не получал ничего.
  it("F1: SMTP-отказ на одном получателе не рвёт батч и не метит его доставленным", async () => {
    const fake = createFakeDataSource({
      users: [fakeUser("u1", "Раз"), fakeUser("u2", "Два"), fakeUser("u3", "Три")],
      preferences: [
        preference({ userId: "u1", channel: "email" }),
        preference({ userId: "u2", channel: "email" }),
        preference({ userId: "u3", channel: "email" })
      ],
      pending: [
        notification({ id: "n1", userId: "u1" }),
        notification({ id: "n2", userId: "u2" }),
        notification({ id: "n3", userId: "u3" })
      ],
      tasks: [
        { id: "task-1", title: "Смета", ownerUserId: "x", participants: ["u1", "u2", "u3"] }
      ]
    });
    const sent: string[] = [];
    const emailProvider = {
      async sendNotificationDigest(message: { email: string }) {
        if (message.email === "u2@example.com") throw new Error("smtp 550 mailbox unavailable");
        sent.push(message.email);
      }
    } as never;

    const result = await handler()(dispatchJob(), {
      dataSource: fake.dataSource,
      emailProvider,
      now
    });

    // Отказ изолирован: соседи по батчу отправлены.
    expect(sent).toEqual(["u1@example.com", "u3@example.com"]);
    // Деградация наблюдаема, а не проглочена.
    expect(result).toMatchObject({
      metadata: { emailedUsers: 2, deliveredNotifications: 2, failedRecipients: 1, failedNotifications: 1 }
    });
    // n2 без маркера — вернётся следующим тиком; n1/n3 повторно не уйдут.
    expect(fake.markedIds()).toEqual(["n1", "n3"]);
    // Маркер ставится ПО КАЖДОМУ получателю внутри цикла, а не одной пачкой в
    // конце: падение процесса в середине батча не должно терять прогресс и
    // рассылать дубли уже отправленным.
    expect(fake.marked.map((entry) => [...entry.notificationIds])).toEqual([["n1"], ["n3"]]);
    // Транзиентный отказ засчитан попыткой — «повторим» не значит «вечно».
    expect(fake.attempts.get("n2")).toBe(1);
  });

  // F1/F3: маркер delivered_at делает повторный прогон идемпотентным.
  it("F1/F3: повторный прогон не рассылает письма повторно", async () => {
    const fake = createFakeDataSource({
      users: [fakeUser("u1", "Раз")],
      preferences: [preference({ userId: "u1", channel: "email" })],
      pending: [notification({ id: "n1", userId: "u1" })],
      tasks: [{ id: "task-1", title: "Смета", ownerUserId: "u1", participants: [] }]
    });
    const emailProvider = createInMemoryEmailProvider();

    await handler()(dispatchJob(), { dataSource: fake.dataSource, emailProvider, now });
    const second = await handler()(dispatchJob(), {
      dataSource: fake.dataSource,
      emailProvider,
      now: new Date(now.getTime() + 900_000)
    });

    expect(emailProvider.notificationDigests).toHaveLength(1);
    expect(second).toMatchObject({ metadata: { scanned: 0, emailedUsers: 0 } });
  });

  // F3: окна по wall-clock больше нет — простой воркера не теряет уведомления.
  it("F3: уведомление старше любого прежнего окна всё равно доставляется", async () => {
    const fake = createFakeDataSource({
      users: [fakeUser("u1", "Раз")],
      preferences: [preference({ userId: "u1", channel: "email" })],
      pending: [
        // Создано за 40 минут до прогона: прежнее окно lookback=15 мин его теряло.
        notification({
          id: "n-old",
          userId: "u1",
          createdAt: new Date("2026-07-18T11:20:00.000Z")
        })
      ],
      tasks: [{ id: "task-1", title: "Смета", ownerUserId: "u1", participants: [] }]
    });
    const emailProvider = createInMemoryEmailProvider();

    const result = await handler()(dispatchJob(), {
      dataSource: fake.dataSource,
      emailProvider,
      now
    });

    expect(emailProvider.notificationDigests).toHaveLength(1);
    expect(result).toMatchObject({ metadata: { deliveredNotifications: 1 } });
  });

  // F2: email не должен показывать то, что прячет in-app роут.
  it("F2: уведомление по сущности без прав чтения не уходит письмом", async () => {
    const fake = createFakeDataSource({
      users: [fakeUser("u1", "Раз")],
      preferences: [preference({ userId: "u1", channel: "email" })],
      pending: [
        notification({ id: "n-readable", userId: "u1", sourceEntityId: "task-own" }),
        notification({ id: "n-forbidden", userId: "u1", sourceEntityId: "task-other" }),
        // Сущность удалена — резолвер отдаёт 404, письма не будет никогда.
        notification({ id: "n-missing", userId: "u1", sourceEntityId: "task-gone" }),
        // Неизвестный тип сущности — как и in-app роут, пропускаем.
        notification({ id: "n-badtype", userId: "u1", sourceEntityType: "not_an_entity" })
      ],
      tasks: [
        { id: "task-own", title: "Своя", ownerUserId: "u1", participants: [] },
        { id: "task-other", title: "Чужая", ownerUserId: "u2", participants: [] }
      ]
    });
    const emailProvider = createInMemoryEmailProvider();

    const result = await handler()(dispatchJob(), {
      dataSource: fake.dataSource,
      emailProvider,
      now
    });

    expect(emailProvider.notificationDigests).toHaveLength(1);
    expect(emailProvider.notificationDigests[0]!.items.map((item) => item.title)).toEqual([
      "Вас упомянули"
    ]);
    expect(result).toMatchObject({
      metadata: { deliveredNotifications: 1, skippedAccessDenied: 3 }
    });
  });

  // F4(a): один запрос на тенант вместо пары запросов на каждого активного пользователя.
  it("F4: не делает per-user запросов — один listWorkspaceUsers и один батч настроек", async () => {
    const users = Array.from({ length: 20 }, (_, index) => fakeUser(`u${index}`, `Ю${index}`));
    const fake = createFakeDataSource({
      users,
      preferences: [preference({ userId: "u0", channel: "email" })],
      pending: [notification({ id: "n0", userId: "u0" })],
      tasks: [{ id: "task-1", title: "Смета", ownerUserId: "u0", participants: [] }]
    });
    const emailProvider = createInMemoryEmailProvider();

    await handler()(dispatchJob(), { dataSource: fake.dataSource, emailProvider, now });

    expect(fake.listWorkspaceUsers).toHaveBeenCalledTimes(1);
    expect(fake.listNotificationPreferencesForUsers).toHaveBeenCalledTimes(1);
    // Настройки запрашиваются только для тех, кто реально есть в очереди.
    expect(fake.listNotificationPreferencesForUsers.mock.calls[0]![1]).toEqual(["u0"]);
    expect(fake.listUserNotifications).not.toHaveBeenCalled();
    expect(fake.listNotificationPreferences).not.toHaveBeenCalled();
  });

  it("digest-канал с freq=none не доставляет, daily — доставляет", async () => {
    const fake = createFakeDataSource({
      users: [fakeUser("user-none", "Дина"), fakeUser("user-daily", "Егор")],
      preferences: [
        preference({ userId: "user-none", channel: "digest", digestFrequency: "none" }),
        preference({ userId: "user-daily", channel: "digest", digestFrequency: "daily" })
      ],
      pending: [
        notification({ id: "n-none", userId: "user-none" }),
        notification({ id: "n-daily", userId: "user-daily" })
      ],
      tasks: [
        { id: "task-1", title: "Смета", ownerUserId: "x", participants: ["user-none", "user-daily"] }
      ]
    });
    const emailProvider = createInMemoryEmailProvider();

    const result = await handler()(dispatchJob(), {
      dataSource: fake.dataSource,
      emailProvider,
      now
    });

    expect(emailProvider.notificationDigests.map((digest) => digest.email)).toEqual([
      "user-daily@example.com"
    ]);
    expect(result).toMatchObject({ metadata: { emailedUsers: 1, skippedNoChannel: 1 } });
  });

  // Регрессия: постоянно отбиваемый адрес (SMTP 550) навсегда занимал голову
  // очереди. Строки без маркера пересортировывались в начало каждого батча, и
  // при batchLimit «мёртвых» строк письма переставали уходить ВСЕМУ тенанту,
  // а джоба продолжала рапортовать успех.
  it("мёртвый ящик не морит очередь голодом: попытки ограничены, соседи доставляются", async () => {
    const fake = createFakeDataSource({
      users: [fakeUser("u-dead", "Мёртвый"), fakeUser("u-live", "Живой")],
      preferences: [
        preference({ userId: "u-dead", channel: "email" }),
        preference({ userId: "u-live", channel: "email" })
      ],
      pending: [
        // Две «отравленные» строки старше всех — они полностью занимают окно.
        notification({
          id: "n-dead-1",
          userId: "u-dead",
          createdAt: new Date("2026-07-18T10:00:00.000Z")
        }),
        notification({
          id: "n-dead-2",
          userId: "u-dead",
          createdAt: new Date("2026-07-18T10:01:00.000Z")
        }),
        notification({
          id: "n-live",
          userId: "u-live",
          createdAt: new Date("2026-07-18T11:00:00.000Z")
        })
      ],
      tasks: [
        { id: "task-1", title: "Смета", ownerUserId: "x", participants: ["u-dead", "u-live"] }
      ]
    });
    const sent: string[] = [];
    const emailProvider = {
      async sendNotificationDigest(message: { email: string }) {
        if (message.email === "u-dead@example.com") throw new Error("smtp 550 mailbox unavailable");
        sent.push(message.email);
      }
    } as never;
    // Окно ровно на две строки: «мёртвые» уведомления вытесняют живое.
    const job = dispatchJob({ batchLimit: 2, maxAttempts: 3 });

    const runs = [];
    for (let tick = 0; tick < 3; tick += 1) {
      runs.push(
        await handler()(job, {
          dataSource: fake.dataSource,
          emailProvider,
          now: new Date(now.getTime() + tick * 900_000)
        })
      );
    }

    // Первые два тика окно занято отравленными строками — живой не получает ничего.
    expect(runs[0]).toMatchObject({
      metadata: { failedRecipients: 1, failedNotifications: 2, deadLetteredNotifications: 0 }
    });
    expect(sent).toEqual([]);
    // Третья попытка исчерпывает лимит: строки уходят в dead-letter, и это
    // видно в metadata прогона, а не прячется за «прогон успешен».
    expect(runs[2]).toMatchObject({ metadata: { deadLetteredNotifications: 2 } });
    expect(fake.attempts.get("n-dead-1")).toBe(3);

    // Следующий тик: окно освободилось, живой получатель наконец получает письмо.
    const afterDeadLetter = await handler()(job, {
      dataSource: fake.dataSource,
      emailProvider,
      now: new Date(now.getTime() + 3 * 900_000)
    });

    expect(sent).toEqual(["u-live@example.com"]);
    expect(afterDeadLetter).toMatchObject({ metadata: { deliveredNotifications: 1 } });
    expect(fake.markedIds()).toEqual(["n-live"]);
  });

  // Транзиентный сбой резолвинга прав тоже должен быть ограничен по числу попыток.
  it("сбой резолвинга прав засчитывается попыткой и в пределе уходит в dead-letter", async () => {
    const fake = createFakeDataSource({
      users: [fakeUser("u1", "Раз")],
      preferences: [preference({ userId: "u1", channel: "email" })],
      pending: [notification({ id: "n1", userId: "u1" })],
      tasks: [{ id: "task-1", title: "Смета", ownerUserId: "u1", participants: [] }]
    });
    // Резолвинг прав падает всегда: fail-closed, письма нет, маркера нет.
    (fake.dataSource as unknown as { findTaskById: () => Promise<never> }).findTaskById =
      async () => {
        throw new Error("db connection reset");
      };
    const emailProvider = createInMemoryEmailProvider();
    const job = dispatchJob({ maxAttempts: 2 });

    const first = await handler()(job, { dataSource: fake.dataSource, emailProvider, now });
    const second = await handler()(job, { dataSource: fake.dataSource, emailProvider, now });
    const third = await handler()(job, { dataSource: fake.dataSource, emailProvider, now });

    expect(first).toMatchObject({
      metadata: { deferredAccessErrors: 1, deadLetteredNotifications: 0 }
    });
    expect(second).toMatchObject({
      metadata: { deferredAccessErrors: 1, deadLetteredNotifications: 1 }
    });
    // После dead-letter строка не пересканируется вечно.
    expect(third).toMatchObject({ metadata: { scanned: 0 } });
    expect(emailProvider.notificationDigests).toHaveLength(0);
  });

  it("fail-closed без emailProvider: бросает notification_dispatch_not_configured", async () => {
    const fake = createFakeDataSource({ users: [], preferences: [], pending: [] });
    await expect(
      handler()(dispatchJob(), { dataSource: fake.dataSource, now })
    ).rejects.toThrow("notification_dispatch_not_configured");
  });
});
