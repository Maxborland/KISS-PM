import { randomUUID } from "node:crypto";

import type { AccessProfile } from "@kiss-pm/access-control";
import {
  parseCollaborationEntityType,
  type BackgroundJobKind,
  type TenantUser
} from "@kiss-pm/domain";
import type { PendingNotificationDelivery } from "@kiss-pm/persistence";

import { parseMonthIso } from "../capacity/capacityService";
import { warmCapacityCacheForTenantMonth } from "../capacity/registerCapacityRoutes";
import { resolveCollaborationEntityAccess } from "../collaboration/entityAccess";
import type { BackgroundJobHandler, BackgroundJobRegistry } from "./backgroundJobWorker";

const storageAssetCleanup: BackgroundJobHandler = async (job, context) => {
  if (
    !context.storageProvider ||
    !context.dataSource.listArchivedFileAssetsForCleanup ||
    !context.dataSource.markFileAssetPurged
  ) {
    throw new Error("storage_cleanup_not_configured");
  }
  const retentionDays = readPositiveInteger(job.payload.retentionDays, 30);
  const limit = readPositiveInteger(job.payload.limit, 25);
  const archivedBefore = new Date(context.now.getTime() - retentionDays * 86_400_000);
  const assets = await context.dataSource.listArchivedFileAssetsForCleanup({
    tenantId: job.tenantId,
    archivedBefore,
    limit
  });
  let purged = 0;
  for (const asset of assets) {
    await context.storageProvider.deleteObject(asset.storageKey);
    await context.dataSource.markFileAssetPurged({
      tenantId: job.tenantId,
      assetId: asset.id,
      purgedAt: context.now
    });
    purged += 1;
  }
  return {
    message: "Archived assets cleanup completed",
    metadata: { purged, retentionDays }
  };
};

const capacityCacheWarmup: BackgroundJobHandler = async (job, context) => {
  const monthIso = parseMonthIso(String(job.payload.monthIso ?? ""));
  if (!monthIso) throw new Error("capacity_warmup_month_invalid");
  const aggregation = await warmCapacityCacheForTenantMonth(
    context.dataSource,
    {
      tenantId: job.tenantId,
      monthIso,
      projectFilterId: typeof job.payload.projectId === "string" ? job.payload.projectId : null
    }
  );
  if (!aggregation) throw new Error("capacity_warmup_failed");
  return {
    message: "Capacity cache warmup completed",
    metadata: {
      monthIso,
      contributionCount: aggregation.contributions.length
    }
  };
};

// Reconciles per-track call recordings stuck in 'recording' (a lost egress_ended
// webhook / orphaned egress) by failing them after a stale window.
const callRecordingJanitor: BackgroundJobHandler = async (job, context) => {
  const { dataSource } = context;
  if (!dataSource.failStaleInProgressRecordings || !dataSource.createCallEvent) {
    throw new Error("call_recording_janitor_not_configured");
  }
  const staleAfterMinutes = readPositiveInteger(job.payload.staleAfterMinutes, 360);
  const olderThan = new Date(context.now.getTime() - staleAfterMinutes * 60_000);
  const failed = await dataSource.failStaleInProgressRecordings({
    tenantId: job.tenantId,
    olderThan
  });
  // Close the timeline of each reaped track AND stop its egress if it is still running
  // (the row was failed because the egress_ended webhook was lost, so the egress can keep
  // recording/billing). ponytail: best-effort — the rows are already 'failed', so a crash
  // mid-loop drops advisory events/stops for the rest (the next run won't re-fail them).
  let stoppedEgress = 0;
  for (const recording of failed) {
    if (recording.egressId && context.egressProvider) {
      try {
        await context.egressProvider.stopEgress(recording.egressId);
        stoppedEgress += 1;
      } catch {
        // best-effort; the egress may already be gone
      }
    }
    await dataSource.createCallEvent({
      id: `call-event-${randomUUID()}`,
      tenantId: recording.tenantId,
      roomId: recording.roomId,
      sessionId: recording.sessionId,
      actorUserId: recording.createdByUserId,
      eventType: "recording_failed",
      payload: {
        recordingGroupId: recording.recordingGroupId,
        recordingId: recording.id,
        trackId: recording.trackId,
        reason: "stale_egress"
      }
    });
  }
  return {
    message: "Stale call recordings reconciled",
    metadata: { failed: failed.length, stoppedEgress, staleAfterMinutes }
  };
};

// Purge неприменённых истёкших planning runs (scenario + solver). Grace-период
// (retentionHours) держит недавно истёкшие для честной диагностики «сценарий истёк»;
// applied-runs не удаляются никогда — они историческая ссылка apply-квитанций.
const planningExpiredRunsPurge: BackgroundJobHandler = async (job, context) => {
  if (!context.dataSource.purgeExpiredPlanningRuns) {
    throw new Error("planning_runs_purge_not_configured");
  }
  const retentionHours = readPositiveInteger(job.payload.retentionHours, 24);
  const expiredBefore = new Date(context.now.getTime() - retentionHours * 3_600_000);
  const purged = await context.dataSource.purgeExpiredPlanningRuns({
    tenantId: job.tenantId,
    expiredBefore
  });
  return {
    message: "Expired planning runs purged",
    metadata: { ...purged, retentionHours }
  };
};

// Максимум уведомлений на одного получателя за прогон (защита от гигантских писем).
// Остаток остаётся без маркера и уедет следующим тиком.
const NOTIFICATION_DISPATCH_USER_LIMIT = 50;
// Потолок строк, разбираемых за один прогон по всему тенанту. Ограничивает
// объём работы тика и размер backlog-догона после простоя воркера.
const NOTIFICATION_DISPATCH_BATCH_LIMIT = 500;

// Предел попыток offline-доставки одной строки. Транзиентный отказ (SMTP 5xx на
// конкретном адресе, сбой резолвинга прав) маркер не ставит, поэтому строка
// возвращается в очередь — но не бесконечно: выборка идёт по created_at ASC с
// лимитом батча, и навсегда «залипшие» строки (постоянный SMTP 550 у одного
// активного пользователя) иначе полностью вытесняют из окна всех остальных
// получателей тенанта. По исчерпании лимита строка уходит в dead-letter:
// маркер ставится, письма не будет, деградация видна в metadata прогона.
const NOTIFICATION_DISPATCH_MAX_ATTEMPTS = 5;

// Оффлайн-доставка: разбирает очередь непрочитанных уведомлений тенанта и шлёт
// письмо-дайджест тем, кто включил канал email или digest (freq != none) для
// соответствующего типа уведомления.
//
// Окна (lookbackMinutes) больше нет: оно опиралось на context.now — время claim'а
// джобы, — а nextRunAt расписания считается от времени постановки в очередь. Две
// эти шкалы не связаны, поэтому задержка воркера открывала постоянную щель, а
// простой в 40 минут безвозвратно терял ~25 минут уведомлений. Теперь очередь
// определяется маркером delivered_at: доставка идемпотентна (retry не рассылает
// письма повторно) и backlog после простоя догоняется, а не теряется.
//
// In-app остаётся источником истины: маркер delivered_at на in-app-чтение не влияет.
const notificationDispatch: BackgroundJobHandler = async (job, context) => {
  const { dataSource, emailProvider } = context;
  if (
    !emailProvider ||
    !dataSource.listWorkspaceUsers ||
    !dataSource.listPendingNotificationDeliveries ||
    !dataSource.markUserNotificationsDelivered ||
    !dataSource.recordFailedNotificationDeliveries ||
    !dataSource.listNotificationPreferencesForUsers ||
    !dataSource.findAccessProfileById
  ) {
    throw new Error("notification_dispatch_not_configured");
  }

  const batchLimit = readPositiveInteger(job.payload.batchLimit, NOTIFICATION_DISPATCH_BATCH_LIMIT);
  const maxAttempts = readPositiveInteger(
    job.payload.maxAttempts,
    NOTIFICATION_DISPATCH_MAX_ATTEMPTS
  );
  const pending = await dataSource.listPendingNotificationDeliveries({
    tenantId: job.tenantId,
    limit: batchLimit
  });
  const stats = {
    scanned: pending.length,
    emailedUsers: 0,
    deliveredNotifications: 0,
    // Терминальные отказы — маркер ставится, письма не будет никогда.
    skippedNoChannel: 0,
    skippedNoRecipient: 0,
    skippedAccessDenied: 0,
    // Транзиентные — маркер НЕ ставится, повторим следующим тиком.
    failedRecipients: 0,
    failedNotifications: 0,
    deferredAccessErrors: 0,
    deferredOverUserLimit: 0,
    // Исчерпавшие лимит попыток: маркер ставится, письма не будет. Деградация
    // считается явно, а не прячется за «прогон успешен».
    deadLetteredNotifications: 0
  };
  if (pending.length === 0) {
    return {
      message: "Notification digest dispatched",
      metadata: { ...stats, batchLimit, maxAttempts }
    };
  }

  // Один запрос на тенант вместо перебора пользователей (был N+1).
  const users = await dataSource.listWorkspaceUsers(job.tenantId);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const recipientIds = [...new Set(pending.map((notification) => notification.userId))].filter(
    (userId) => {
      const user = usersById.get(userId);
      return Boolean(user && user.status === "active" && user.email);
    }
  );
  // Настройки только тех пользователей, кто реально встретился в очереди.
  const preferences = await dataSource.listNotificationPreferencesForUsers(
    job.tenantId,
    recipientIds
  );
  const emailTypesByUser = new Map<string, Set<string>>();
  for (const preference of preferences) {
    if (!preference.enabled) continue;
    const enabledByChannel =
      preference.channel === "email" ||
      (preference.channel === "digest" && preference.digestFrequency !== "none");
    if (!enabledByChannel) continue;
    const types = emailTypesByUser.get(preference.userId) ?? new Set<string>();
    types.add(preference.notificationType);
    emailTypesByUser.set(preference.userId, types);
  }

  // Кэши на прогон: профиль доступа — по accessProfileId, решение чтения — по
  // паре (пользователь, сущность). Проверка прав из-за этого стоит не «запрос на
  // уведомление», а «запрос на уникальную пару» — одна сущность с 40 адресатами
  // резолвится 40 раз максимум, а 50 уведомлений по одной задаче — один раз.
  const profileCache = new Map<string, AccessProfile | undefined>();
  const readableCache = new Map<string, boolean>();

  async function canRead(user: TenantUser, notification: PendingNotificationDelivery) {
    const entityType = parseCollaborationEntityType(notification.sourceEntityType);
    if (!entityType.ok) return false;
    const cacheKey = `${user.id} ${entityType.value} ${notification.sourceEntityId}`;
    const cached = readableCache.get(cacheKey);
    if (cached !== undefined) return cached;

    let profile = profileCache.get(user.accessProfileId);
    if (profile === undefined && !profileCache.has(user.accessProfileId)) {
      profile = await dataSource.findAccessProfileById!(job.tenantId, user.accessProfileId);
      profileCache.set(user.accessProfileId, profile);
    }
    if (!profile) {
      readableCache.set(cacheKey, false);
      return false;
    }
    const access = await resolveCollaborationEntityAccess({
      actor: user,
      dataSource,
      entityId: notification.sourceEntityId,
      entityType: entityType.value,
      profile
    });
    const allowed = access.ok && access.value.readDecision.allowed;
    readableCache.set(cacheKey, allowed);
    return allowed;
  }

  // Группировка по получателю + терминальная фильтрация.
  type Recipient = {
    user: (typeof users)[number];
    items: Array<{ title: string; body: string; route: string }>;
    notificationIds: string[];
  };
  const recipients = new Map<string, Recipient>();
  const terminallySkipped: string[] = [];
  // Транзиентные отказы этого прогона: маркер не ставим, но попытку засчитываем.
  const transientlyFailed: string[] = [];

  for (const notification of pending) {
    const user = usersById.get(notification.userId);
    if (!user || user.status !== "active" || !user.email) {
      // Получателя нет / отключён / без email — письма не будет никогда.
      stats.skippedNoRecipient += 1;
      terminallySkipped.push(notification.id);
      continue;
    }
    if (!emailTypesByUser.get(user.id)?.has(notification.notificationType)) {
      // Канал выключен для этого типа — терминальный отказ, а не отложенный.
      stats.skippedNoChannel += 1;
      terminallySkipped.push(notification.id);
      continue;
    }
    // Тот же per-entity гейт, что и in-app роут /api/workspace/notifications:
    // иначе email покажет то, что UI прячет (уведомления по сущностям, на
    // которые у получателя нет прав чтения — participant/owner/planning-события
    // проверяются только на членство в тенанте).
    let readable: boolean;
    try {
      readable = await canRead(user, notification);
    } catch {
      // Транзиентный сбой резолвинга прав: fail-closed, но без маркера —
      // уведомление вернётся в очередь следующим тиком. Попытка засчитывается:
      // «транзиентный» не должен означать «вечный».
      stats.deferredAccessErrors += 1;
      transientlyFailed.push(notification.id);
      continue;
    }
    if (!readable) {
      stats.skippedAccessDenied += 1;
      terminallySkipped.push(notification.id);
      continue;
    }

    const recipient = recipients.get(user.id) ?? { user, items: [], notificationIds: [] };
    if (recipient.items.length >= NOTIFICATION_DISPATCH_USER_LIMIT) {
      // Сверх лимита письма: без маркера, уедет следующим тиком.
      stats.deferredOverUserLimit += 1;
      continue;
    }
    recipient.items.push({
      title: notification.title,
      body: notification.body,
      route: notification.route
    });
    recipient.notificationIds.push(notification.id);
    recipients.set(user.id, recipient);
  }

  // Отправка изолирована по получателю: SMTP 550 на одном адресе больше не рвёт
  // весь батч тенанта (раньше исключение выбрасывало из цикла, джоба падала и
  // ретраилась — уже отправленные получали дубль, а хвост списка не получал ничего).
  // Терминальные отказы метим сразу: письма по ним не будет никогда, и держать
  // их до конца цикла отправки незачем.
  if (terminallySkipped.length > 0) {
    await dataSource.markUserNotificationsDelivered({
      tenantId: job.tenantId,
      notificationIds: terminallySkipped,
      deliveredAt: context.now
    });
  }

  for (const recipient of recipients.values()) {
    try {
      await emailProvider.sendNotificationDigest({
        email: recipient.user.email,
        recipientName: recipient.user.name,
        items: recipient.items
      });
      stats.emailedUsers += 1;
      stats.deliveredNotifications += recipient.items.length;
    } catch {
      // Не глотаем: счётчики уезжают в metadata прогона, маркер не ставится —
      // следующий тик повторит попытку по этому получателю.
      stats.failedRecipients += 1;
      stats.failedNotifications += recipient.notificationIds.length;
      transientlyFailed.push(...recipient.notificationIds);
      continue;
    }
    // Маркер ставится сразу после отправки, а не одной пачкой в конце цикла:
    // падение процесса в середине батча иначе теряло бы прогресс всего цикла и
    // при перезапуске рассылало дубли всем уже отправленным. Окно at-least-once
    // сужается до одного получателя. Отдельный UPDATE вне try: сбой записи
    // маркера — не «отказ доставки», его нельзя засчитывать попыткой и глушить,
    // он честно роняет джобу (воркер отретраит).
    await dataSource.markUserNotificationsDelivered({
      tenantId: job.tenantId,
      notificationIds: recipient.notificationIds,
      deliveredAt: context.now
    });
  }

  // Учёт попыток по транзиентным отказам: исчерпавшие лимит уходят в dead-letter,
  // иначе постоянно отбиваемый адрес навсегда занимает голову очереди тенанта.
  if (transientlyFailed.length > 0) {
    const outcome = await dataSource.recordFailedNotificationDeliveries({
      tenantId: job.tenantId,
      notificationIds: transientlyFailed,
      maxAttempts,
      deadLetteredAt: context.now
    });
    stats.deadLetteredNotifications = outcome.deadLettered;
  }

  return {
    message: "Notification digest dispatched",
    metadata: { ...stats, batchLimit, maxAttempts }
  };
};

// Реестр содержит ТОЛЬКО реально реализованные kinds. Boundary-kinds без
// реализации (connector.sync, search.projection_rebuild, calls.recording_compose)
// намеренно отсутствуют: раньше их хендлеры возвращали фиктивный успех — теперь
// воркер такие джобы не claim'ит, а постановка в очередь честно отклоняется 501
// (см. backgroundJobRoutes.ts, NOT_IMPLEMENTED_BACKGROUND_JOB_KINDS).
// notification.dispatch реализован (шлёт email-дайджест) и засевается в
// ensureDefaultBackgroundJobSchedules.
export function createDefaultBackgroundJobRegistry(): BackgroundJobRegistry {
  return {
    "storage.asset_cleanup": storageAssetCleanup,
    "capacity.cache_warmup": capacityCacheWarmup,
    "calls.recording_janitor": callRecordingJanitor,
    "planning.expired_runs_purge": planningExpiredRunsPurge,
    "notification.dispatch": notificationDispatch
  };
}

export const defaultBackgroundJobKinds: BackgroundJobKind[] = [
  "storage.asset_cleanup",
  "capacity.cache_warmup",
  "calls.recording_janitor",
  "planning.expired_runs_purge",
  "notification.dispatch"
];

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, 500)
    : fallback;
}
