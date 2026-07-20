import { randomUUID } from "node:crypto";

import type { BackgroundJobKind } from "@kiss-pm/domain";

import { parseMonthIso } from "../capacity/capacityService";
import { warmCapacityCacheForTenantMonth } from "../capacity/registerCapacityRoutes";
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

// Окно дайджеста по умолчанию: письмо собирает непрочитанные уведомления,
// созданные за последние N минут. Оно должно совпадать с интервалом расписания
// dispatch (ensureDefaultBackgroundJobSchedules) — иначе окна пересекаются
// (дубликаты письма) или зияют (пропуск). Оператор может переопределить в payload
// (lookbackMinutes). Точное однократное вручение без окна потребует колонки
// delivered_at в user_notifications — вынесено как follow-up (за рамками блока).
const NOTIFICATION_DISPATCH_LOOKBACK_MINUTES = 15;
// Максимум уведомлений на одного получателя за прогон (защита от гигантских писем).
const NOTIFICATION_DISPATCH_USER_LIMIT = 50;

// Оффлайн-доставка: собирает непрочитанные уведомления пользователей тенанта за
// окно lookbackMinutes и шлёт письмо-дайджест через emailProvider тем, кто включил
// канал email или digest (freq != none) для соответствующего типа уведомления.
// In-app остаётся источником истины; email — дополнительный канал вручения.
const notificationDispatch: BackgroundJobHandler = async (job, context) => {
  const { dataSource, emailProvider } = context;
  if (
    !emailProvider ||
    !dataSource.listWorkspaceUsers ||
    !dataSource.listUserNotifications ||
    !dataSource.listNotificationPreferences
  ) {
    throw new Error("notification_dispatch_not_configured");
  }
  const lookbackMinutes = readPositiveInteger(
    job.payload.lookbackMinutes,
    NOTIFICATION_DISPATCH_LOOKBACK_MINUTES
  );
  const createdAfter = new Date(context.now.getTime() - lookbackMinutes * 60_000);
  const users = await dataSource.listWorkspaceUsers(job.tenantId);
  let emailedUsers = 0;
  let deliveredNotifications = 0;
  for (const user of users) {
    if (user.status !== "active" || !user.email) continue;
    const preferences = await dataSource.listNotificationPreferences(job.tenantId, user.id);
    // Типы, для которых пользователь включил доставку по email или дайджесту.
    const emailTypes = new Set<string>();
    for (const preference of preferences) {
      if (!preference.enabled) continue;
      if (preference.channel === "email") emailTypes.add(preference.notificationType);
      else if (preference.channel === "digest" && preference.digestFrequency !== "none") {
        emailTypes.add(preference.notificationType);
      }
    }
    if (emailTypes.size === 0) continue;
    const unread = await dataSource.listUserNotifications({
      tenantId: job.tenantId,
      userId: user.id,
      status: "unread",
      limit: NOTIFICATION_DISPATCH_USER_LIMIT
    });
    const items = unread
      .filter(
        (notification) =>
          notification.createdAt >= createdAfter && emailTypes.has(notification.notificationType)
      )
      .map((notification) => ({
        title: notification.title,
        body: notification.body,
        route: notification.route
      }));
    if (items.length === 0) continue;
    await emailProvider.sendNotificationDigest({
      email: user.email,
      recipientName: user.name,
      items
    });
    emailedUsers += 1;
    deliveredNotifications += items.length;
  }
  return {
    message: "Notification digest dispatched",
    metadata: { emailedUsers, deliveredNotifications, lookbackMinutes }
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
