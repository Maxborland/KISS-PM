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

const notificationDispatch: BackgroundJobHandler = async () => ({
  message: "Notification dispatch boundary completed",
  metadata: { dispatched: 0, adapter: "in_app_persisted" }
});

const connectorSync: BackgroundJobHandler = async (job) => ({
  message: "Connector sync boundary completed",
  metadata: {
    connectorType: typeof job.payload.connectorType === "string"
      ? job.payload.connectorType
      : "unspecified",
    synced: 0
  }
});

const searchProjectionRebuild: BackgroundJobHandler = async () => ({
  message: "Search projection rebuild boundary completed",
  metadata: { rebuilt: 0, projection: "metadata_runtime_v1" }
});

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
  if (!context.dataSource.failStaleInProgressRecordings) {
    throw new Error("call_recording_janitor_not_configured");
  }
  const staleAfterMinutes = readPositiveInteger(job.payload.staleAfterMinutes, 360);
  const olderThan = new Date(context.now.getTime() - staleAfterMinutes * 60_000);
  const failed = await context.dataSource.failStaleInProgressRecordings({
    tenantId: job.tenantId,
    olderThan
  });
  return {
    message: "Stale call recordings reconciled",
    metadata: { failed, staleAfterMinutes }
  };
};

// Deferred: mux the per-track recording files into a single MP4 (ffmpeg). v1 keeps
// the per-track files; this is the registered boundary for the future compose step.
const callRecordingCompose: BackgroundJobHandler = async () => ({
  message: "Call recording compose boundary completed",
  metadata: { composed: 0, note: "per-track files preserved; ffmpeg mux deferred" }
});

export function createDefaultBackgroundJobRegistry(): BackgroundJobRegistry {
  return {
    "storage.asset_cleanup": storageAssetCleanup,
    "notification.dispatch": notificationDispatch,
    "connector.sync": connectorSync,
    "search.projection_rebuild": searchProjectionRebuild,
    "capacity.cache_warmup": capacityCacheWarmup,
    "calls.recording_janitor": callRecordingJanitor,
    "calls.recording_compose": callRecordingCompose
  };
}

export const defaultBackgroundJobKinds: BackgroundJobKind[] = [
  "storage.asset_cleanup",
  "notification.dispatch",
  "connector.sync",
  "search.projection_rebuild",
  "capacity.cache_warmup",
  "calls.recording_janitor",
  "calls.recording_compose"
];

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, 500)
    : fallback;
}
