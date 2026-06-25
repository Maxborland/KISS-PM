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
  | "listCallRecordings"
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
      if (!dataSource.createCallRecording || !dataSource.createCallEvent || !dataSource.listCallRecordings) {
        return { ok: false, status: 501, error: "communications_not_configured" };
      }
      if (input.session.status !== "active") {
        return { ok: false, status: 409, error: "call_session_not_active" };
      }
      // Egress only targets LiveKit rooms. Provider-room ids are caller-supplied and unique
      // per provider, so a manual/jitsi room could reuse an active LiveKit room name; reject
      // non-LiveKit rooms so their manager cannot drive egress for the matching LiveKit room.
      if (input.room.provider !== "livekit") {
        return { ok: false, status: 409, error: "call_recording_provider_unsupported" };
      }
      // Reject a second concurrent start for the same session — otherwise each click spins up
      // duplicate Track Egress jobs writing duplicate files and billing until each is stopped.
      const active = await dataSource.listCallRecordings({
        tenantId: input.actor.tenantId,
        roomId: input.room.id
      });
      if (active.some((rec) => rec.sessionId === input.session.id && rec.status === "recording")) {
        return { ok: false, status: 409, error: "call_recording_already_active" };
      }

      const tracks = await egressProvider.listRoomTracks(input.room.providerRoomId);
      // A snapshot with no published media would silently succeed with zero recordings; reject
      // so the manager retries once participants are publishing instead of recording nothing.
      if (tracks.length === 0) {
        return { ok: false, status: 409, error: "call_recording_no_tracks" };
      }

      const recordingGroupId = `call-rec-group-${randomUUID()}`;
      const recordings: CallRecording[] = [];
      const startedEgressIds: string[] = [];

      try {
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
          startedEgressIds.push(egressId);
          const recording = await dataSource.createCallRecording({
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
      } catch (cause) {
        // Any failure after one or more egresses started (a later startTrackEgress, the DB
        // insert, or the event/audit) leaves the caller without a group id to stop. Stop every
        // egress started in this attempt so none keep recording/billing; the janitor reaps rows.
        for (const egressId of startedEgressIds) {
          try {
            await egressProvider.stopEgress(egressId);
          } catch {
            // best-effort
          }
        }
        throw cause;
      }

      return { ok: true, recordingGroupId, recordings };
    },

    /** Stop all active egresses in a recording group scoped to the resolved room. */
    async stopRecording(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      room: CallRoom;
      recordingGroupId: string;
    }): Promise<RecordingResult<{ stopped: number; failed: number }>> {
      if (!egressProvider || !dataSource.listCallRecordingsByGroup) {
        return { ok: false, status: 501, error: "recording_storage_unsupported" };
      }
      const recordings = await dataSource.listCallRecordingsByGroup({
        tenantId: input.actor.tenantId,
        recordingGroupId: input.recordingGroupId
      });
      // Scope to the resolved room: a group id read from room B's detail must not stop B's
      // egress through room A just because the actor can manage A (within-tenant IDOR).
      if (recordings.length === 0 || recordings.some((rec) => rec.roomId !== input.room.id)) {
        return { ok: false, status: 404, error: "call_recording_group_not_found" };
      }
      let stopped = 0;
      let failed = 0;
      for (const recording of recordings) {
        if (recording.status === "recording" && recording.egressId) {
          try {
            await egressProvider.stopEgress(recording.egressId);
            stopped += 1;
          } catch {
            // The LiveKit API may be down/timing out, not just idempotently already-stopping.
            // Count it so the caller learns some egresses may still be running and can retry.
            failed += 1;
          }
        }
      }
      await deps.appendManagementAuditEvent(
        recordingAudit({
          actionType: "communications.call_recording_stopped",
          actor: input.actor,
          access: input.access,
          afterState: { recordingGroupId: input.recordingGroupId, stopped, failed },
          commandInput: { roomId: input.room.id, recordingGroupId: input.recordingGroupId }
        })
      );
      return { ok: true, stopped, failed };
    },

    /**
     * Best-effort: stop any still-running egresses for a session that is being ended, so a
     * normal "end call" does not leave LiveKit Egress recording (privacy/cost) until tracks
     * disappear. The webhook/janitor reconciles the final row state.
     */
    async stopActiveEgressForSession(input: {
      tenantId: string;
      roomId: string;
      sessionId: string;
    }): Promise<{ stopped: number }> {
      if (!egressProvider || !dataSource.listCallRecordings) return { stopped: 0 };
      const recordings = await dataSource.listCallRecordings({
        tenantId: input.tenantId,
        roomId: input.roomId
      });
      let stopped = 0;
      for (const recording of recordings) {
        if (
          recording.sessionId === input.sessionId &&
          recording.status === "recording" &&
          recording.egressId
        ) {
          try {
            await egressProvider.stopEgress(recording.egressId);
            stopped += 1;
          } catch {
            // best-effort; the janitor reaps anything left running
          }
        }
      }
      return { stopped };
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
          const createEvent = requireFn(tx.createCallEvent);

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
          // Close the per-track recording timeline. The claim-once update above fires
          // exactly once per track, so this event is emitted exactly once — no group-level
          // completion event is needed (consumers derive it from track_completed count vs
          // the recording_started payload's trackCount).
          await createEvent({
            id: `call-event-${randomUUID()}`,
            tenantId: recording.tenantId,
            roomId: recording.roomId,
            sessionId: recording.sessionId,
            actorUserId: recording.createdByUserId,
            eventType: "recording_track_completed",
            payload: {
              recordingGroupId: recording.recordingGroupId,
              recordingId: recording.id,
              trackId: recording.trackId,
              durationSeconds: input.durationSeconds
            }
          });
          return { reconciled: true };
        });
      } catch (error) {
        if (error instanceof RecordingRaceLost) return { reconciled: true };
        throw error;
      }
    }
  };
}
