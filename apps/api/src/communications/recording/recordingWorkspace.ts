import { randomUUID } from "node:crypto";

import type { AttachmentEntityType } from "@kiss-pm/persistence";
import type { CallRecording, CallRoom, CallSession, TenantUser } from "@kiss-pm/domain";

import type {
  ApiTenantDataSource,
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../../apiTypes";
import type { CommunicationCallAccess } from "../callWorkspace";
import type { LiveKitEgressProvider } from "./livekitEgressProvider";

export type CommunicationRecordingDataSource = Pick<
  ApiTenantDataSource,
  | "createCallEvent"
  | "createCallRecording"
  | "createEntityAttachment"
  | "createPendingFileAsset"
  | "findCallRoom"
  | "findCallRecordingByEgressId"
  | "listCallRecordingsByGroup"
  | "markFileAssetReady"
  | "updateCallRecordingByEgress"
  | "withTransaction"
>;

export type CommunicationRecordingWorkspaceDeps = {
  dataSource: CommunicationRecordingDataSource;
  egressProvider: LiveKitEgressProvider | null;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type RecordingResult<T> =
  | ({ ok: true } & T)
  | { ok: false; status: 404 | 409 | 501; error: string };

function recordingFilepath(parts: {
  tenantId: string;
  roomId: string;
  sessionId: string | null;
  recordingGroupId: string;
  participantId: string;
  trackId: string;
  kind: "audio" | "video";
}): string {
  // Track Egress applies the codec-correct container extension (Opus→.ogg, VP8/VP9→.webm,
  // H264→.mp4); the requested suffix is only a hint. reconcile uses the authoritative
  // filename from the egress_ended webhook, not this rebuilt path.
  const ext = parts.kind === "audio" ? "ogg" : "webm";
  return `recordings/${parts.tenantId}/${parts.roomId}/${parts.sessionId ?? "no-session"}/${parts.recordingGroupId}/${parts.participantId}/${parts.trackId}.${ext}`;
}

class RecordingRaceLost extends Error {}

function requireFn<T>(fn: T | undefined): T {
  if (!fn) throw new Error("communications_not_configured");
  return fn;
}

function mimeForStorageKey(key: string): string {
  if (key.endsWith(".webm")) return "video/webm";
  if (key.endsWith(".ogg") || key.endsWith(".opus")) return "audio/ogg";
  if (key.endsWith(".mp4")) return "video/mp4";
  if (key.endsWith(".h264")) return "video/h264";
  if (key.endsWith(".ivf")) return "video/x-ivf";
  return "application/octet-stream";
}

function recordingAudit(input: {
  actionType: string;
  actor: TenantUser;
  access: CommunicationCallAccess;
  commandInput: Record<string, unknown>;
  afterState?: Record<string, unknown> | null;
}): ManagementAuditEventInput {
  return {
    actionType: input.actionType,
    actorUserId: input.actor.id,
    afterState: input.afterState ?? null,
    beforeState: null,
    commandInput: input.commandInput,
    permissionResult: input.access.manageDecision,
    sourceEntity: input.access.sourceEntity,
    sourceWorkflow: "communications",
    tenantId: input.actor.tenantId
  };
}

export function createCommunicationRecordingWorkspace(deps: CommunicationRecordingWorkspaceDeps) {
  const { dataSource, egressProvider } = deps;

  return {
    /** Start one Track Egress per published track and register per-track recording rows. */
    async startRecording(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      room: CallRoom;
      session: CallSession;
    }): Promise<RecordingResult<{ recordingGroupId: string; recordings: CallRecording[] }>> {
      if (!egressProvider) {
        return { ok: false, status: 501, error: "recording_storage_unsupported" };
      }
      if (!dataSource.createCallRecording || !dataSource.createCallEvent) {
        return { ok: false, status: 501, error: "communications_not_configured" };
      }
      if (input.session.status !== "active") {
        return { ok: false, status: 409, error: "call_session_not_active" };
      }

      const tracks = await egressProvider.listRoomTracks(input.room.providerRoomId);
      const recordingGroupId = `call-rec-group-${randomUUID()}`;
      const recordings: CallRecording[] = [];

      for (const track of tracks) {
        const recordingId = `call-recording-${randomUUID()}`;
        const filepath = recordingFilepath({
          tenantId: input.actor.tenantId,
          roomId: input.room.id,
          sessionId: input.session.id,
          recordingGroupId,
          participantId: track.participantIdentity,
          trackId: track.trackId,
          kind: track.kind
        });
        const egressId = await egressProvider.startTrackEgress({
          providerRoomId: input.room.providerRoomId,
          trackId: track.trackId,
          filepath
        });
        let recording: CallRecording;
        try {
          recording = await dataSource.createCallRecording({
            id: recordingId,
            tenantId: input.actor.tenantId,
            roomId: input.room.id,
            sessionId: input.session.id,
            recordingGroupId,
            attachmentId: null,
            egressId,
            participantId: track.participantIdentity,
            trackId: track.trackId,
            kind: track.kind,
            status: "recording",
            durationSeconds: null,
            endedAt: null,
            title: `Запись · ${track.participantIdentity}`,
            createdByUserId: input.actor.id
          });
        } catch (cause) {
          // Never leave the just-started egress orphaned without a DB row to reap it.
          try {
            await egressProvider.stopEgress(egressId);
          } catch {
            // best-effort
          }
          throw cause;
        }
        recordings.push(recording);
      }

      await dataSource.createCallEvent({
        id: `call-event-${randomUUID()}`,
        tenantId: input.actor.tenantId,
        roomId: input.room.id,
        sessionId: input.session.id,
        actorUserId: input.actor.id,
        eventType: "recording_started",
        payload: { recordingGroupId, trackCount: recordings.length }
      });
      await deps.appendManagementAuditEvent(
        recordingAudit({
          actionType: "communications.call_recording_started",
          actor: input.actor,
          access: input.access,
          afterState: { recordingGroupId, trackCount: recordings.length },
          commandInput: { roomId: input.room.id, sessionId: input.session.id }
        })
      );

      return { ok: true, recordingGroupId, recordings };
    },

    /** Stop all active egresses in a recording group. */
    async stopRecording(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      room: CallRoom;
      recordingGroupId: string;
    }): Promise<RecordingResult<{ stopped: number }>> {
      if (!egressProvider || !dataSource.listCallRecordingsByGroup) {
        return { ok: false, status: 501, error: "recording_storage_unsupported" };
      }
      const recordings = await dataSource.listCallRecordingsByGroup({
        tenantId: input.actor.tenantId,
        recordingGroupId: input.recordingGroupId
      });
      let stopped = 0;
      for (const recording of recordings) {
        if (recording.status === "recording" && recording.egressId) {
          try {
            await egressProvider.stopEgress(recording.egressId);
            stopped += 1;
          } catch {
            // egress may already be stopping; the webhook reconciles the final state.
          }
        }
      }
      await deps.appendManagementAuditEvent(
        recordingAudit({
          actionType: "communications.call_recording_stopped",
          actor: input.actor,
          access: input.access,
          afterState: { recordingGroupId: input.recordingGroupId, stopped },
          commandInput: { roomId: input.room.id, recordingGroupId: input.recordingGroupId }
        })
      );
      return { ok: true, stopped };
    },

    /**
     * Reconcile an egress_ended webhook: link the per-track file as an attachment and
     * mark the recording ready. The storageKey is the AUTHORITATIVE filename LiveKit
     * reported (codec-correct extension), not a rebuilt guess. Runs in a transaction
     * with a claim-once update so concurrent/retried webhook deliveries cannot create
     * duplicate file assets/attachments.
     */
    async reconcileEgressEnded(input: {
      tenantId: string;
      egressId: string;
      storageKey: string;
      sizeBytes: number;
      durationSeconds: number | null;
    }): Promise<{ reconciled: boolean }> {
      if (!dataSource.withTransaction) return { reconciled: false };
      try {
        return await dataSource.withTransaction(async (tx) => {
          const findRecording = requireFn(tx.findCallRecordingByEgressId);
          const findRoom = requireFn(tx.findCallRoom);
          const createAsset = requireFn(tx.createPendingFileAsset);
          const markReady = requireFn(tx.markFileAssetReady);
          const createAttachment = requireFn(tx.createEntityAttachment);
          const updateRecording = requireFn(tx.updateCallRecordingByEgress);

          // Tenant was parsed by the webhook route from OUR egress output key
          // (recordings/{tenantId}/...), not trusted from a free-form payload field.
          const recording = await findRecording({
            tenantId: input.tenantId,
            egressId: input.egressId
          });
          if (!recording) return { reconciled: false };
          if (recording.attachmentId) return { reconciled: true }; // already done

          const room = await findRoom(recording.tenantId, recording.roomId);
          if (!room) return { reconciled: false };

          const displayName = input.storageKey.split("/").pop() || recording.title;
          const asset = await createAsset({
            id: `file-asset-${randomUUID()}`,
            tenantId: recording.tenantId,
            provider: "s3",
            storageKey: input.storageKey,
            originalName: displayName,
            safeDisplayName: displayName,
            mimeType: mimeForStorageKey(input.storageKey),
            sizeBytes: input.sizeBytes,
            createdByUserId: recording.createdByUserId
          });
          await markReady({
            tenantId: recording.tenantId,
            assetId: asset.id,
            sizeBytes: input.sizeBytes,
            checksumSha256: ""
          });
          const attachment = await createAttachment({
            id: `entity-attachment-${randomUUID()}`,
            tenantId: recording.tenantId,
            entityType: room.entityType as AttachmentEntityType,
            entityId: room.entityId,
            assetId: asset.id,
            externalReferenceId: null,
            relationType: "call_recording",
            sourceActivityType: null,
            sourceActivityId: null,
            createdByUserId: recording.createdByUserId
          });
          const updated = await updateRecording({
            tenantId: recording.tenantId,
            egressId: input.egressId,
            status: "ready",
            attachmentId: attachment.id,
            durationSeconds: input.durationSeconds,
            endedAt: new Date()
          });
          // updateCallRecordingByEgress matches only when attachment_id IS NULL, so a
          // concurrent delivery that already attached yields no row — roll the txn back.
          if (!updated) throw new RecordingRaceLost();
          return { reconciled: true };
        });
      } catch (error) {
        if (error instanceof RecordingRaceLost) return { reconciled: true };
        throw error;
      }
    }
  };
}
