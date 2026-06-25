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
  const ext = parts.kind === "audio" ? "ogg" : "mp4";
  return `recordings/${parts.tenantId}/${parts.roomId}/${parts.sessionId ?? "no-session"}/${parts.recordingGroupId}/${parts.participantId}/${parts.trackId}.${ext}`;
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

    /** Reconcile an egress_ended webhook: link the per-track file as an attachment and mark ready. */
    async reconcileEgressEnded(input: {
      tenantId: string;
      egressId: string;
      sizeBytes: number;
      durationSeconds: number | null;
    }): Promise<{ reconciled: boolean }> {
      if (
        !dataSource.findCallRecordingByEgressId ||
        !dataSource.findCallRoom ||
        !dataSource.createPendingFileAsset ||
        !dataSource.markFileAssetReady ||
        !dataSource.createEntityAttachment ||
        !dataSource.updateCallRecordingByEgress
      ) {
        return { reconciled: false };
      }
      // Tenant is parsed by the webhook route from the egress output path
      // (recordings/{tenantId}/...), not trusted from any free-form payload field.
      const recording = await dataSource.findCallRecordingByEgressId({
        tenantId: input.tenantId,
        egressId: input.egressId
      });
      if (!recording) return { reconciled: false };
      if (recording.attachmentId) return { reconciled: true }; // idempotent

      const room = await dataSource.findCallRoom(recording.tenantId, recording.roomId);
      if (!room) return { reconciled: false };

      const storageKey = recordingFilepath({
        tenantId: recording.tenantId,
        roomId: recording.roomId,
        sessionId: recording.sessionId,
        recordingGroupId: recording.recordingGroupId,
        participantId: recording.participantId ?? "unknown",
        trackId: recording.trackId ?? recording.id,
        kind: recording.kind === "audio" ? "audio" : "video"
      });
      const mimeType = recording.kind === "audio" ? "audio/ogg" : "video/mp4";
      const displayName = `${recording.title}.${recording.kind === "audio" ? "ogg" : "mp4"}`;

      const asset = await dataSource.createPendingFileAsset({
        id: `file-asset-${randomUUID()}`,
        tenantId: recording.tenantId,
        provider: "s3",
        storageKey,
        originalName: displayName,
        safeDisplayName: displayName,
        mimeType,
        sizeBytes: input.sizeBytes,
        createdByUserId: recording.createdByUserId
      });
      await dataSource.markFileAssetReady({
        tenantId: recording.tenantId,
        assetId: asset.id,
        sizeBytes: input.sizeBytes,
        checksumSha256: ""
      });
      const attachment = await dataSource.createEntityAttachment({
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
      await dataSource.updateCallRecordingByEgress({
        tenantId: recording.tenantId,
        egressId: input.egressId,
        status: "ready",
        attachmentId: attachment.id,
        durationSeconds: input.durationSeconds,
        endedAt: new Date()
      });
      return { reconciled: true };
    }
  };
}
