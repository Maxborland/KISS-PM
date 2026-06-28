import {
  parseCallMediaKind,
  parseCallParticipantState,
  parseCallRoomProvider,
  parseCallTitle,
  parseCollaborationEntityType,
  parseCollaborationId,
  parseProviderRoomId,
  type CallRoom,
  type CallSession,
  type CollaborationEntityType,
  type TenantUser
} from "@kiss-pm/domain";
import type { Hono } from "hono";

import { createCommunicationCallWorkspace } from "./communications/callWorkspace";
import {
  serializeCallEvent,
  serializeCallParticipantState,
  serializeCallRecording,
  serializeCallRoom,
  serializeCallSession
} from "./communications/callSerializers";
import {
  resolveCommunicationEntityAccess,
  type CommunicationEntityAccessContext
} from "./communications/entityAccess";
import { readLimitedJsonBody } from "./jsonBody";
import { createCommunicationRecordingWorkspace } from "./communications/recording/recordingWorkspace";
import { createTurnConfigFromEnv, issueTurnCredentials } from "./turnCredentials";
import type { ApiRouteDeps } from "./routeTypes";

type ResolvedCallRoom = {
  access: CommunicationEntityAccessContext;
  room: CallRoom;
};

export function registerCommunicationRealtimeRoutes(app: Hono, deps: ApiRouteDeps) {
  const callWorkspace = createCommunicationCallWorkspace(deps);
  const recordingWorkspace = createCommunicationRecordingWorkspace({
    dataSource: deps.dataSource,
    egressProvider: deps.egressProvider,
    appendManagementAuditEvent: deps.appendManagementAuditEvent
  });
  const turnConfig = createTurnConfigFromEnv();

  app.get("/api/workspace/call-rooms", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const entity = parseEntityQuery(context.req.query("entityType"), context.req.query("entityId"));
    if (!entity.ok) return context.json({ error: entity.error }, 400);
    const access = await resolveAccessForActor(actor, entity.value, deps);
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.readDecision.allowed) {
      return context.json({ error: access.value.readDecision.reason }, 403);
    }
    if (!deps.dataSource.listCallRoomsByEntity) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const rooms = await deps.dataSource.listCallRoomsByEntity({
      tenantId: actor.tenantId,
      entityType: entity.value.entityType,
      entityId: entity.value.entityId
    });
    return context.json({ callRooms: rooms.map(serializeCallRoom) });
  });

  app.post("/api/workspace/call-rooms", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = parseRecordBody(body.value);
    if (!record.ok) return context.json({ error: record.error }, 400);
    const parsed = parseCreateRoomBody(record.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const access = await resolveAccessForActor(actor, parsed.value, deps);
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.manageDecision.allowed) {
      await callWorkspace.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: { entityType: parsed.value.entityType, entityId: parsed.value.entityId },
        permissionResult: access.value.manageDecision,
        sourceEntity: access.value.sourceEntity
      });
      return context.json({ error: access.value.manageDecision.reason }, 403);
    }
    const result = await callWorkspace.createRoom({
      access: access.value,
      actor,
      command: parsed.value
    });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }
    return context.json({ callRoom: serializeCallRoom(result.room), event: serializeCallEvent(result.event) }, 201);
  });

  app.get("/api/workspace/call-rooms/:roomId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomForActor(context.req.param("roomId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    const [events, recordings, activeSession] = await Promise.all([
      deps.dataSource.listCallEvents?.({
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        limit: 50
      }) ?? [],
      deps.dataSource.listCallRecordings?.({
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id
      }) ?? [],
      deps.dataSource.findActiveCallSessionByRoom?.({
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id
      }) ?? undefined
    ]);
    return context.json({
      callRoom: serializeCallRoom(resolved.value.room),
      // The active session a second participant joins instead of starting a new one.
      activeSession: activeSession ? serializeCallSession(activeSession) : null,
      events: events.map(serializeCallEvent),
      recordings: recordings.map(serializeCallRecording)
    });
  });

  app.post("/api/workspace/call-rooms/:roomId/sessions/start", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomForActor(context.req.param("roomId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await callWorkspace.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: { roomId: context.req.param("roomId"), action: "session.start" },
        permissionResult: resolved.value.access.manageDecision,
        sourceEntity: resolved.value.access.sourceEntity
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    const result = await callWorkspace.startSession({
      access: resolved.value.access,
      actor,
      room: resolved.value.room
    });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }
    return context.json({
      callRoom: serializeCallRoom(result.room),
      session: serializeCallSession(result.session),
      event: serializeCallEvent(result.event)
    }, 201);
  });

  app.post("/api/workspace/call-rooms/:roomId/sessions/:sessionId/join-token", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomAndSession(context.req.param("roomId"), context.req.param("sessionId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    const result = await callWorkspace.issueJoinToken({
      access: resolved.value.access,
      actor,
      room: resolved.value.room,
      session: resolved.value.session
    });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }
    return context.json({
      join: {
        provider: result.join.provider,
        joinUrl: result.join.joinUrl,
        token: result.join.token,
        expiresAt: result.join.expiresAt
      },
      event: serializeCallEvent(result.event)
    });
  });

  app.post("/api/workspace/call-rooms/:roomId/sessions/:sessionId/turn-credentials", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomAndSession(
      context.req.param("roomId"),
      context.req.param("sessionId"),
      actor,
      deps
    );
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    if (resolved.value.session.status !== "active") {
      return context.json({ error: "call_session_not_active" }, 409);
    }
    if (!turnConfig) {
      // No TURN configured — the client falls back to STUN/host candidates.
      return context.json({ turn: null });
    }
    const credentials = issueTurnCredentials(turnConfig, actor.id, Math.floor(Date.now() / 1000));
    return context.json({ turn: credentials });
  });

  app.post("/api/workspace/call-rooms/:roomId/sessions/:sessionId/participant-state", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomAndSession(context.req.param("roomId"), context.req.param("sessionId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = parseRecordBody(body.value);
    if (!record.ok) return context.json({ error: record.error }, 400);
    const parsed = parseParticipantStateBody(record.value, actor, resolved.value.access);
    if (!parsed.ok) {
      if (parsed.status === 403) {
        await callWorkspace.appendDeniedAudit({
          actionType: "communications.denied",
          actor,
          commandInput: {
            action: "participant-state.update",
            roomId: resolved.value.room.id,
            sessionId: resolved.value.session.id,
            userId: typeof record.value.userId === "string" ? record.value.userId : null
          },
          permissionResult: resolved.value.access.manageDecision,
          sourceEntity: resolved.value.access.sourceEntity
        });
      }
      return context.json({ error: parsed.error }, parsed.status);
    }
    const result = await callWorkspace.updateParticipantState({
      access: resolved.value.access,
      actor,
      command: parsed.value,
      room: resolved.value.room,
      session: resolved.value.session
    });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }
    return context.json({
      participantState: serializeCallParticipantState(result.participantState),
      event: serializeCallEvent(result.event)
    });
  });

  app.post("/api/workspace/call-rooms/:roomId/sessions/:sessionId/end", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomAndSession(context.req.param("roomId"), context.req.param("sessionId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await callWorkspace.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: {
          action: "session.end",
          roomId: context.req.param("roomId"),
          sessionId: context.req.param("sessionId")
        },
        permissionResult: resolved.value.access.manageDecision,
        sourceEntity: resolved.value.access.sourceEntity
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    const result = await callWorkspace.endSession({
      access: resolved.value.access,
      actor,
      room: resolved.value.room,
      session: resolved.value.session
    });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }
    // Ending the session must not leave egress recording the (now-ended) call.
    await recordingWorkspace.stopActiveEgressForSession({
      tenantId: actor.tenantId,
      roomId: resolved.value.room.id,
      sessionId: resolved.value.session.id
    });
    return context.json({
      callRoom: serializeCallRoom(result.room),
      session: serializeCallSession(result.session),
      event: serializeCallEvent(result.event)
    });
  });

  app.post("/api/workspace/call-rooms/:roomId/recordings", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomForActor(context.req.param("roomId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await callWorkspace.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: { action: "recording.attach", roomId: context.req.param("roomId") },
        permissionResult: resolved.value.access.manageDecision,
        sourceEntity: resolved.value.access.sourceEntity
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = parseRecordBody(body.value);
    if (!record.ok) return context.json({ error: record.error }, 400);
    const parsed = parseRecordingBody(record.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const result = await callWorkspace.attachRecording({
      access: resolved.value.access,
      actor,
      command: parsed.value,
      room: resolved.value.room
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({
      event: serializeCallEvent(result.event),
      recording: serializeCallRecording(result.recording)
    }, 201);
  });

  app.post("/api/workspace/call-rooms/:roomId/sessions/:sessionId/recordings/start", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomAndSession(
      context.req.param("roomId"),
      context.req.param("sessionId"),
      actor,
      deps
    );
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await callWorkspace.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: { action: "recording.start", roomId: context.req.param("roomId") },
        permissionResult: resolved.value.access.manageDecision,
        sourceEntity: resolved.value.access.sourceEntity
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    const result = await recordingWorkspace.startRecording({
      access: resolved.value.access,
      actor,
      room: resolved.value.room,
      session: resolved.value.session
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(
      {
        recordingGroupId: result.recordingGroupId,
        recordings: result.recordings.map(serializeCallRecording)
      },
      201
    );
  });

  app.post("/api/workspace/call-rooms/:roomId/recordings/groups/:groupId/stop", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomForActor(context.req.param("roomId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await callWorkspace.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: { action: "recording.stop", roomId: context.req.param("roomId") },
        permissionResult: resolved.value.access.manageDecision,
        sourceEntity: resolved.value.access.sourceEntity
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    const result = await recordingWorkspace.stopRecording({
      access: resolved.value.access,
      actor,
      room: resolved.value.room,
      recordingGroupId: context.req.param("groupId")
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ stopped: result.stopped, failed: result.failed });
  });

  app.get("/api/workspace/call-rooms/:roomId/events", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveCallRoomForActor(context.req.param("roomId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    if (!deps.dataSource.listCallEvents) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const events = await deps.dataSource.listCallEvents({
      tenantId: actor.tenantId,
      roomId: resolved.value.room.id,
      limit: parseLimit(context.req.query("limit"))
    });
    return context.json({ events: events.map(serializeCallEvent) });
  });
}

async function requireActor(cookie: string | null, deps: ApiRouteDeps) {
  return deps.getSessionActorFromHeaders(cookie);
}

function parseCreateRoomBody(record: Record<string, unknown>) {
  const entity = parseEntityQuery(record.entityType, record.entityId);
  if (!entity.ok) return entity;
  const title = parseCallTitle(record.title);
  if (!title.ok) return title;
  const mediaKind = parseCallMediaKind(record.mediaKind ?? "video");
  if (!mediaKind.ok) return mediaKind;
  const provider = parseCallRoomProvider(record.provider);
  if (!provider.ok) return provider;
  const meetingId = record.meetingId === undefined || record.meetingId === null
    ? { ok: true as const, value: null }
    : parseCollaborationId(record.meetingId, "meeting_id_invalid");
  if (!meetingId.ok) return meetingId;
  const providerRoomId = record.providerRoomId === undefined || record.providerRoomId === null
    ? { ok: true as const, value: null }
    : parseProviderRoomId(record.providerRoomId);
  if (!providerRoomId.ok) return providerRoomId;
  return {
    ok: true as const,
    value: {
      ...entity.value,
      mediaKind: mediaKind.value,
      meetingId: meetingId.value,
      provider: provider.value,
      providerRoomId: providerRoomId.value,
      title: title.value
    }
  };
}

function parseRecordBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false as const, error: "invalid_json" };
  }
  return { ok: true as const, value: value as Record<string, unknown> };
}

function parseParticipantStateBody(
  record: Record<string, unknown>,
  actor: TenantUser,
  access: CommunicationEntityAccessContext
) {
  const state = parseCallParticipantState(record.state);
  if (!state.ok) return { ok: false as const, status: 400 as const, error: state.error };
  const userId = record.userId === undefined || record.userId === null
    ? { ok: true as const, value: actor.id }
    : parseCollaborationId(record.userId, "participant_user_id_invalid");
  if (!userId.ok) return { ok: false as const, status: 400 as const, error: userId.error };
  if (userId.value !== actor.id && !access.manageDecision.allowed) {
    return {
      ok: false as const,
      status: 403 as const,
      error: access.manageDecision.reason
    };
  }
  return {
    ok: true as const,
    value: {
      permissionResult: userId.value === actor.id ? access.readDecision : access.manageDecision,
      state: state.value,
      userId: userId.value
    }
  };
}

function parseRecordingBody(record: Record<string, unknown>) {
  const attachmentId = parseCollaborationId(record.attachmentId, "attachment_id_invalid");
  if (!attachmentId.ok) return attachmentId;
  const title = parseCallTitle(record.title ?? "Recording");
  if (!title.ok) return title;
  const sessionId = record.sessionId === undefined || record.sessionId === null
    ? { ok: true as const, value: null }
    : parseCollaborationId(record.sessionId, "call_session_id_invalid");
  if (!sessionId.ok) return sessionId;
  return {
    ok: true as const,
    value: {
      attachmentId: attachmentId.value,
      sessionId: sessionId.value,
      title: title.value
    }
  };
}

function parseEntityQuery(entityType: unknown, entityId: unknown) {
  const parsedType = parseCollaborationEntityType(entityType);
  if (!parsedType.ok) return parsedType;
  const parsedId = parseCollaborationId(entityId, "collaboration_entity_id_invalid");
  if (!parsedId.ok) return parsedId;
  return { ok: true as const, value: { entityType: parsedType.value, entityId: parsedId.value } };
}

async function resolveCallRoomForActor(
  roomIdRaw: string,
  actor: TenantUser,
  deps: ApiRouteDeps
): Promise<
  | { ok: true; value: ResolvedCallRoom }
  | { ok: false; status: 400 | 403 | 404 | 501; error: string }
> {
  const roomId = parseCollaborationId(roomIdRaw, "call_room_id_invalid");
  if (!roomId.ok) return { ok: false, status: 400, error: roomId.error };
  const room = await deps.dataSource.findCallRoom?.(actor.tenantId, roomId.value);
  if (!room) return { ok: false, status: 404, error: "call_room_not_found" };
  const access = await resolveAccessForActor(actor, room, deps);
  if (!access.ok) return access;
  return { ok: true, value: { access: access.value, room } };
}

async function resolveCallRoomAndSession(
  roomIdRaw: string,
  sessionIdRaw: string,
  actor: TenantUser,
  deps: ApiRouteDeps
): Promise<
  | { ok: true; value: ResolvedCallRoom & { session: CallSession } }
  | { ok: false; status: 400 | 403 | 404 | 501; error: string }
> {
  const resolved = await resolveCallRoomForActor(roomIdRaw, actor, deps);
  if (!resolved.ok) return resolved;
  const sessionId = parseCollaborationId(sessionIdRaw, "call_session_id_invalid");
  if (!sessionId.ok) return { ok: false, status: 400, error: sessionId.error };
  const session = await deps.dataSource.findCallSession?.(actor.tenantId, sessionId.value);
  if (!session || session.roomId !== resolved.value.room.id) {
    return { ok: false, status: 404, error: "call_session_not_found" };
  }
  return { ok: true, value: { ...resolved.value, session } };
}

async function resolveAccessForActor(
  actor: TenantUser,
  entity: { entityType: CollaborationEntityType; entityId: string },
  deps: ApiRouteDeps
) {
  const profile = await deps.getActorProfile(actor);
  return resolveCommunicationEntityAccess({
    actor,
    dataSource: deps.dataSource,
    entityId: entity.entityId,
    entityType: entity.entityType,
    profile
  });
}

function parseLimit(value: string | undefined): number {
  if (!value) return 50;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(parsed, 100));
}
