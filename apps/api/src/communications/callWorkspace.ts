import { randomUUID } from "node:crypto";

import type { PolicyDecision } from "@kiss-pm/access-control";
import type {
  CallEvent,
  CallEventType,
  CallParticipantState,
  CallParticipantStateValue,
  CallRecording,
  CallRoom,
  CallSession,
  TenantUser
} from "@kiss-pm/domain";

import type { ManagementAuditDataSource, ManagementAuditEventInput } from "../apiTypes";
import type { VideoJoinContract, VideoProvider } from "../videoProvider";
import type { CommunicationCallDataSource } from "./callDataSource";

export type CommunicationCallAccess = {
  sourceEntity: { type: string; id: string };
  readDecision: PolicyDecision;
  manageDecision: PolicyDecision;
};

export type CommunicationCallWorkspaceDeps = {
  dataSource: CommunicationCallDataSource;
  videoProvider: VideoProvider;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: CommunicationCallDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

export type CommunicationCallWorkspaceError = {
  ok: false;
  status: 400 | 404 | 409 | 501;
  error: string;
};

type WorkspaceResult<T> =
  | ({ ok: true } & T)
  | CommunicationCallWorkspaceError;

export type CreateCallRoomCommand = {
  entityId: string;
  entityType: CallRoom["entityType"];
  mediaKind: CallRoom["mediaKind"];
  meetingId: string | null;
  provider: CallRoom["provider"];
  providerRoomId: string | null;
  title: string;
};

export type UpdateParticipantStateCommand = {
  permissionResult: PolicyDecision;
  state: CallParticipantStateValue;
  userId: string;
};

export type AttachRecordingCommand = {
  attachmentId: string;
  sessionId: string | null;
  title: string;
};

export function createCommunicationCallWorkspace(deps: CommunicationCallWorkspaceDeps) {
  return {
    async appendDeniedAudit(input: {
      actionType: string;
      actor: TenantUser;
      commandInput: Record<string, unknown>;
      permissionResult: PolicyDecision;
      sourceEntity: { type: string; id: string };
    }): Promise<void> {
      await deps.appendManagementAuditEvent(communicationAudit({
        ...input,
        executionResult: { status: "denied" }
      }));
    },

    async createRoom(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      command: CreateCallRoomCommand;
    }): Promise<WorkspaceResult<{ event: CallEvent; room: CallRoom }>> {
      if (!deps.dataSource.createCallRoom || !deps.dataSource.createCallEvent) {
        return notConfigured();
      }

      const roomId = `call-room-${randomUUID()}`;
      const providerRoomId = input.command.providerRoomId ?? roomId;
      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        let room: CallRoom;
        try {
          room = await requireMethod(transactionDataSource.createCallRoom).call(transactionDataSource, {
            id: roomId,
            tenantId: input.actor.tenantId,
            entityType: input.command.entityType,
            entityId: input.command.entityId,
            meetingId: input.command.meetingId,
            title: input.command.title,
            mediaKind: input.command.mediaKind,
            provider: input.command.provider,
            providerRoomId,
            status: "open",
            createdByUserId: input.actor.id
          });
        } catch (error) {
          if (isProviderRoomConflictError(error)) {
            throw new CallWorkspaceError(409, "call_room_provider_room_conflict");
          }
          throw error;
        }
        const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
          id: `call-event-${randomUUID()}`,
          tenantId: input.actor.tenantId,
          roomId: room.id,
          sessionId: null,
          actorUserId: input.actor.id,
          eventType: "room_created",
          payload: { provider: room.provider, mediaKind: room.mediaKind }
        });
        await deps.appendManagementAuditEvent(
          communicationAudit({
            actionType: "communications.call_room_created",
            actor: input.actor,
            afterState: summarizeCallRoom(room),
            commandInput: { roomId: room.id, entityType: room.entityType, entityId: room.entityId },
            permissionResult: input.access.manageDecision,
            sourceEntity: input.access.sourceEntity
          }),
          transactionDataSource
        );
        return { event, room };
      }).catch((error: unknown) => {
        if (error instanceof CallWorkspaceError) return error;
        if (isProviderRoomConflictError(error)) {
          return new CallWorkspaceError(409, "call_room_provider_room_conflict");
        }
        throw error;
      });

      if (result instanceof CallWorkspaceError) return result.toResult();
      return { ok: true, ...result };
    },

    async startSession(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      room: CallRoom;
    }): Promise<WorkspaceResult<{ event: CallEvent; room: CallRoom; session: CallSession }>> {
      if (input.room.status === "active") {
        return { ok: false, status: 409, error: "call_room_already_active" };
      }
      if (
        !deps.dataSource.createCallSession ||
        !deps.dataSource.createCallEvent ||
        !deps.dataSource.updateCallRoomStatus
      ) {
        return notConfigured();
      }
      const sessionId = `call-session-${randomUUID()}`;
      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        try {
          const session = await requireMethod(transactionDataSource.createCallSession).call(transactionDataSource, {
            id: sessionId,
            tenantId: input.actor.tenantId,
            roomId: input.room.id,
            providerSessionId: null,
            status: "active",
            startedByUserId: input.actor.id
          });
          const room = await requireMethod(transactionDataSource.updateCallRoomStatus).call(transactionDataSource, {
            tenantId: input.actor.tenantId,
            roomId: input.room.id,
            status: "active"
          });
          const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
            id: `call-event-${randomUUID()}`,
            tenantId: input.actor.tenantId,
            roomId: input.room.id,
            sessionId: session.id,
            actorUserId: input.actor.id,
            eventType: "session_started",
            payload: { provider: input.room.provider }
          });
          await deps.appendManagementAuditEvent(
            communicationAudit({
              actionType: "communications.call_session_started",
              actor: input.actor,
              afterState: { roomId: input.room.id, sessionId: session.id },
              commandInput: { roomId: input.room.id },
              permissionResult: input.access.manageDecision,
              sourceEntity: input.access.sourceEntity
            }),
            transactionDataSource
          );
          return { event, room: room ?? input.room, session };
        } catch (error) {
          if (isActiveSessionConflictError(error)) {
            throw new CallWorkspaceError(409, "call_room_already_active");
          }
          throw error;
        }
      }).catch((error: unknown) => {
        if (error instanceof CallWorkspaceError) return error;
        if (isActiveSessionConflictError(error)) {
          return new CallWorkspaceError(409, "call_room_already_active");
        }
        throw error;
      });

      if (result instanceof CallWorkspaceError) return result.toResult();
      return { ok: true, ...result };
    },

    async issueJoinToken(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      room: CallRoom;
      session: CallSession;
    }): Promise<WorkspaceResult<{ event: CallEvent; join: VideoJoinContract }>> {
      if (input.session.status !== "active") {
        return { ok: false, status: 409, error: "call_session_not_active" };
      }
      if (deps.videoProvider.kind === "disabled") {
        return { ok: false, status: 501, error: "video_provider_disabled" };
      }
      if (input.room.provider !== deps.videoProvider.kind) {
        return { ok: false, status: 409, error: "video_provider_misconfigured" };
      }
      if (
        !deps.dataSource.withTransaction ||
        !deps.dataSource.findActiveCallSessionForUpdate ||
        !deps.dataSource.createCallEvent
      ) {
        return notConfigured();
      }
      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        const activeSession = await requireMethod(transactionDataSource.findActiveCallSessionForUpdate).call(
          transactionDataSource,
          {
            tenantId: input.actor.tenantId,
            roomId: input.room.id,
            sessionId: input.session.id
          }
        );
        if (!activeSession) return new CallWorkspaceError(409, "call_session_not_active");
        const join = await deps.videoProvider.issueJoinToken({
          providerRoomId: input.room.providerRoomId,
          roomId: input.room.id,
          tenantId: input.actor.tenantId,
          userId: input.actor.id,
          userName: input.actor.name
        });
        const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
          id: `call-event-${randomUUID()}`,
          tenantId: input.actor.tenantId,
          roomId: input.room.id,
          sessionId: activeSession.id,
          actorUserId: input.actor.id,
          eventType: "join_token_issued",
          payload: { provider: join.provider, expiresAt: join.expiresAt }
        });
        await deps.appendManagementAuditEvent(
          communicationAudit({
            actionType: "communications.call_join_token_issued",
            actor: input.actor,
            afterState: { roomId: input.room.id, sessionId: activeSession.id },
            commandInput: { roomId: input.room.id, sessionId: activeSession.id },
            permissionResult: input.access.readDecision,
            sourceEntity: input.access.sourceEntity
          }),
          transactionDataSource
        );
        return { event, join };
      });
      if (result instanceof CallWorkspaceError) return result.toResult();
      return { ok: true, event: result.event, join: result.join };
    },

    async updateParticipantState(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      command: UpdateParticipantStateCommand;
      room: CallRoom;
      session: CallSession;
    }): Promise<WorkspaceResult<{ event: CallEvent; participantState: CallParticipantState }>> {
      if (input.session.status !== "active") {
        return { ok: false, status: 409, error: "call_session_not_active" };
      }
      if (
        !deps.dataSource.withTransaction ||
        !deps.dataSource.findActiveCallSessionForUpdate ||
        !deps.dataSource.upsertCallParticipantState ||
        !deps.dataSource.createCallEvent
      ) {
        return notConfigured();
      }
      if (input.command.userId !== input.actor.id) {
        const participantExists = await tenantUserExists(
          deps.dataSource,
          input.actor.tenantId,
          input.command.userId
        );
        if (!participantExists) return { ok: false, status: 404, error: "participant_user_not_found" };
      }
      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        const activeSession = await requireMethod(transactionDataSource.findActiveCallSessionForUpdate).call(
          transactionDataSource,
          {
            tenantId: input.actor.tenantId,
            roomId: input.room.id,
            sessionId: input.session.id
          }
        );
        if (!activeSession) return new CallWorkspaceError(409, "call_session_not_active");
        const participantState = await requireMethod(transactionDataSource.upsertCallParticipantState).call(
          transactionDataSource,
          {
            tenantId: input.actor.tenantId,
            roomId: input.room.id,
            sessionId: activeSession.id,
            userId: input.command.userId,
            state: input.command.state
          }
        );
        const eventType = eventTypeForParticipantState(input.command.state);
        const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
          id: `call-event-${randomUUID()}`,
          tenantId: input.actor.tenantId,
          roomId: input.room.id,
          sessionId: activeSession.id,
          actorUserId: input.actor.id,
          eventType,
          payload: { userId: input.command.userId, state: input.command.state }
        });
        await deps.appendManagementAuditEvent(
          communicationAudit({
            actionType: "communications.call_participant_state_updated",
            actor: input.actor,
            afterState: { userId: input.command.userId, state: input.command.state },
            commandInput: {
              roomId: input.room.id,
              sessionId: activeSession.id,
              userId: input.command.userId
            },
            permissionResult: input.command.permissionResult,
            sourceEntity: input.access.sourceEntity
          }),
          transactionDataSource
        );
        return { event, participantState };
      });
      if (result instanceof CallWorkspaceError) return result.toResult();
      return { ok: true, ...result };
    },

    async endSession(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      room: CallRoom;
      session: CallSession;
    }): Promise<WorkspaceResult<{ event: CallEvent; room: CallRoom; session: CallSession }>> {
      if (input.session.status !== "active") {
        return { ok: false, status: 409, error: "call_session_not_active" };
      }
      if (
        !deps.dataSource.endCallSession ||
        !deps.dataSource.createCallEvent ||
        !deps.dataSource.updateCallRoomStatus
      ) {
        return notConfigured();
      }
      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        const session = await requireMethod(transactionDataSource.endCallSession).call(transactionDataSource, {
          tenantId: input.actor.tenantId,
          sessionId: input.session.id,
          endedByUserId: input.actor.id,
          status: "ended"
        });
        if (!session) throw new CallWorkspaceError(409, "call_session_not_active");
        const room = await requireMethod(transactionDataSource.updateCallRoomStatus).call(transactionDataSource, {
          tenantId: input.actor.tenantId,
          roomId: input.room.id,
          status: "ended"
        });
        const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
          id: `call-event-${randomUUID()}`,
          tenantId: input.actor.tenantId,
          roomId: input.room.id,
          sessionId: session.id,
          actorUserId: input.actor.id,
          eventType: "session_ended",
          payload: { endedByUserId: input.actor.id }
        });
        await deps.appendManagementAuditEvent(
          communicationAudit({
            actionType: "communications.call_session_ended",
            actor: input.actor,
            afterState: { roomId: input.room.id, sessionId: session.id },
            commandInput: { roomId: input.room.id, sessionId: session.id },
            permissionResult: input.access.manageDecision,
            sourceEntity: input.access.sourceEntity
          }),
          transactionDataSource
        );
        return { event, room: room ?? input.room, session };
      }).catch((error: unknown) => {
        if (error instanceof CallWorkspaceError) return error;
        throw error;
      });
      if (result instanceof CallWorkspaceError) return result.toResult();
      return { ok: true, ...result };
    },

    async attachRecording(input: {
      access: CommunicationCallAccess;
      actor: TenantUser;
      command: AttachRecordingCommand;
      room: CallRoom;
    }): Promise<WorkspaceResult<{ event: CallEvent; recording: CallRecording }>> {
      if (!deps.dataSource.findAttachmentById || !deps.dataSource.createCallRecording || !deps.dataSource.createCallEvent) {
        return notConfigured();
      }
      if (input.command.sessionId) {
        const session = await deps.dataSource.findCallSession?.(input.actor.tenantId, input.command.sessionId);
        if (!session || session.roomId !== input.room.id) {
          return { ok: false, status: 404, error: "call_session_not_found" };
        }
      }
      const attachment = await deps.dataSource.findAttachmentById(input.actor.tenantId, input.command.attachmentId);
      if (
        !attachment ||
        attachment.archivedAt ||
        attachment.entityType !== input.room.entityType ||
        attachment.entityId !== input.room.entityId
      ) {
        return { ok: false, status: 400, error: "call_recording_attachment_invalid" };
      }
      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        const recordingId = `call-recording-${randomUUID()}`;
        // A manually attached recording is a single composed, ready track grouped by itself
        // (the per-track Egress path uses startRecordingGroup in recordingWorkspace.ts).
        const recording = await requireMethod(transactionDataSource.createCallRecording).call(transactionDataSource, {
          id: recordingId,
          tenantId: input.actor.tenantId,
          roomId: input.room.id,
          sessionId: input.command.sessionId,
          recordingGroupId: recordingId,
          attachmentId: attachment.id,
          egressId: null,
          participantId: null,
          trackId: null,
          kind: "composed",
          status: "ready",
          durationSeconds: null,
          endedAt: null,
          title: input.command.title,
          createdByUserId: input.actor.id
        });
        const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
          id: `call-event-${randomUUID()}`,
          tenantId: input.actor.tenantId,
          roomId: input.room.id,
          sessionId: input.command.sessionId,
          actorUserId: input.actor.id,
          eventType: "recording_attached",
          payload: { recordingId: recording.id, attachmentId: attachment.id }
        });
        await deps.appendManagementAuditEvent(
          communicationAudit({
            actionType: "communications.call_recording_attached",
            actor: input.actor,
            afterState: { recordingId: recording.id, attachmentId: attachment.id },
            commandInput: { roomId: input.room.id, attachmentId: attachment.id },
            permissionResult: input.access.manageDecision,
            sourceEntity: input.access.sourceEntity
          }),
          transactionDataSource
        );
        return { event, recording };
      });
      return { ok: true, ...result };
    }
  };
}

export function summarizeCallRoom(room: CallRoom): Record<string, unknown> {
  return {
    entityId: room.entityId,
    entityType: room.entityType,
    mediaKind: room.mediaKind,
    provider: room.provider,
    roomId: room.id,
    status: room.status
  };
}

function notConfigured(): CommunicationCallWorkspaceError {
  return { ok: false, status: 501, error: "communications_not_configured" };
}

function requireMethod<T extends (...args: never[]) => unknown>(method: T | undefined): T {
  if (!method) throw new Error("communications_not_configured");
  return method;
}

class CallWorkspaceError extends Error {
  constructor(
    readonly status: 409,
    readonly error: string
  ) {
    super(error);
  }

  toResult(): CommunicationCallWorkspaceError {
    return { ok: false, status: this.status, error: this.error };
  }
}

function isActiveSessionConflictError(error: unknown): boolean {
  if (error instanceof Error && error.message === "call_room_already_active") return true;
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" &&
    (
      record.constraint_name === "call_sessions_one_active_per_room_uidx" ||
      record.constraint === "call_sessions_one_active_per_room_uidx" ||
      String(record.message ?? "").includes("call_sessions_one_active_per_room_uidx")
    )
  ) || isActiveSessionConflictError(record.cause);
}

function isProviderRoomConflictError(error: unknown): boolean {
  if (error instanceof Error && error.message === "call_room_provider_room_conflict") return true;
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" &&
    (
      record.constraint_name === "call_rooms_tenant_provider_room_uidx" ||
      record.constraint === "call_rooms_tenant_provider_room_uidx" ||
      String(record.message ?? "").includes("call_rooms_tenant_provider_room_uidx")
    )
  ) || isProviderRoomConflictError(record.cause);
}

async function tenantUserExists(
  dataSource: CommunicationCallDataSource,
  tenantId: string,
  userId: string
): Promise<boolean> {
  const users = (await dataSource.listUsersByTenantId?.(tenantId)) ?? [];
  return users.some((user) => user.id === userId);
}

function eventTypeForParticipantState(state: CallParticipantStateValue): CallEventType {
  if (state === "invited") return "participant_invited";
  if (state === "joining") return "participant_joining";
  if (state === "joined") return "participant_joined";
  return "participant_left";
}

function communicationAudit(input: {
  actionType: string;
  actor: TenantUser;
  commandInput: Record<string, unknown>;
  permissionResult: Record<string, unknown>;
  sourceEntity: { type: string; id: string };
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  executionResult?: Record<string, unknown>;
}): ManagementAuditEventInput {
  const auditInput: ManagementAuditEventInput = {
    actionType: input.actionType,
    actorUserId: input.actor.id,
    afterState: input.afterState ?? null,
    beforeState: input.beforeState ?? null,
    commandInput: input.commandInput,
    permissionResult: input.permissionResult,
    sourceEntity: input.sourceEntity,
    sourceWorkflow: "communications",
    tenantId: input.actor.tenantId
  };
  if (input.executionResult !== undefined) auditInput.executionResult = input.executionResult;
  return auditInput;
}
