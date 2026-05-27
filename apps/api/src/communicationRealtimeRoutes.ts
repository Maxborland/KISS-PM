import { randomUUID } from "node:crypto";

import {
  parseCallMediaKind,
  parseCallParticipantState,
  parseCallRoomProvider,
  parseCallTitle,
  parseCollaborationEntityType,
  parseCollaborationId,
  parseProviderRoomId,
  type CallEvent,
  type CallEventType,
  type CallParticipantState,
  type CallRecording,
  type CallRoom,
  type CallSession,
  type CallParticipantStateValue,
  type CollaborationEntityType,
  type TenantUser
} from "@kiss-pm/domain";
import type { Hono } from "hono";

import { createCommunicationApplication } from "./communications/communicationApplication";
import type { EntityAccessContext } from "./entityAccess";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiRouteDeps } from "./routeTypes";

export function registerCommunicationRealtimeRoutes(app: Hono, deps: ApiRouteDeps) {
  const communicationApplication = createCommunicationApplication(deps);

  app.get("/api/workspace/call-rooms", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const entity = parseEntityQuery(context.req.query("entityType"), context.req.query("entityId"));
    if (!entity.ok) return context.json({ error: entity.error }, 400);
    const access = await communicationApplication.resolveEntityAccess(actor, entity.value);
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
    const access = await communicationApplication.resolveEntityAccess(actor, parsed.value);
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.manageDecision.allowed) {
      await communicationApplication.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: { entityType: parsed.value.entityType, entityId: parsed.value.entityId },
        permissionResult: access.value.manageDecision,
        sourceEntity: access.value.sourceEntity
      });
      return context.json({ error: access.value.manageDecision.reason }, 403);
    }
    if (!deps.dataSource.createCallRoom || !deps.dataSource.createCallEvent) {
      return context.json({ error: "communications_not_configured" }, 501);
    }

    const roomId = `call-room-${randomUUID()}`;
    const providerRoomId = parsed.value.providerRoomId ?? roomId;
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      let room: CallRoom;
      try {
        room = await requireMethod(transactionDataSource.createCallRoom).call(transactionDataSource, {
          id: roomId,
          tenantId: actor.tenantId,
          entityType: parsed.value.entityType,
          entityId: parsed.value.entityId,
          meetingId: parsed.value.meetingId,
          title: parsed.value.title,
          mediaKind: parsed.value.mediaKind,
          provider: parsed.value.provider,
          providerRoomId,
          status: "open",
          createdByUserId: actor.id
        });
      } catch (error) {
        if (isProviderRoomConflictError(error)) {
          throw new CallRouteError(409, "call_room_provider_room_conflict");
        }
        throw error;
      }
      const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
        id: `call-event-${randomUUID()}`,
        tenantId: actor.tenantId,
        roomId: room.id,
        sessionId: null,
        actorUserId: actor.id,
        eventType: "room_created",
        payload: { provider: room.provider, mediaKind: room.mediaKind }
      });
      await deps.appendManagementAuditEvent(
        communicationApplication.audit({
          actionType: "communications.call_room_created",
          actor,
          afterState: summarizeRoom(room),
          commandInput: { roomId: room.id, entityType: room.entityType, entityId: room.entityId },
          permissionResult: access.value.manageDecision,
          sourceEntity: access.value.sourceEntity
        }),
        transactionDataSource
      );
      return { event, room };
    }).catch((error: unknown) => {
      if (error instanceof CallRouteError) return error;
      if (isProviderRoomConflictError(error)) {
        return new CallRouteError(409, "call_room_provider_room_conflict");
      }
      throw error;
    });
    if (result instanceof CallRouteError) {
      return context.json({ error: result.error }, result.status);
    }
    return context.json({ callRoom: serializeCallRoom(result.room), event: serializeCallEvent(result.event) }, 201);
  });

  app.get("/api/workspace/call-rooms/:roomId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await communicationApplication.resolveCallRoomForActor(context.req.param("roomId"), actor);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    const [events, recordings] = await Promise.all([
      deps.dataSource.listCallEvents?.({
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        limit: 50
      }) ?? [],
      deps.dataSource.listCallRecordings?.({
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id
      }) ?? []
    ]);
    return context.json({
      callRoom: serializeCallRoom(resolved.value.room),
      events: events.map(serializeCallEvent),
      recordings: recordings.map(serializeCallRecording)
    });
  });

  app.post("/api/workspace/call-rooms/:roomId/sessions/start", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await communicationApplication.resolveCallRoomForActor(context.req.param("roomId"), actor);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await communicationApplication.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: { roomId: context.req.param("roomId"), action: "session.start" },
        permissionResult: resolved.value.access.manageDecision,
        sourceEntity: resolved.value.access.sourceEntity
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    if (resolved.value.room.status === "active") {
      return context.json({ error: "call_room_already_active" }, 409);
    }
    if (
      !deps.dataSource.createCallSession ||
      !deps.dataSource.createCallEvent ||
      !deps.dataSource.updateCallRoomStatus
    ) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const sessionId = `call-session-${randomUUID()}`;
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      try {
        const session = await requireMethod(transactionDataSource.createCallSession).call(transactionDataSource, {
          id: sessionId,
          tenantId: actor.tenantId,
          roomId: resolved.value.room.id,
          providerSessionId: null,
          status: "active",
          startedByUserId: actor.id
        });
        const room = await requireMethod(transactionDataSource.updateCallRoomStatus).call(transactionDataSource, {
          tenantId: actor.tenantId,
          roomId: resolved.value.room.id,
          status: "active"
        });
        const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
          id: `call-event-${randomUUID()}`,
          tenantId: actor.tenantId,
          roomId: resolved.value.room.id,
          sessionId: session.id,
          actorUserId: actor.id,
          eventType: "session_started",
          payload: { provider: resolved.value.room.provider }
        });
        await deps.appendManagementAuditEvent(
          communicationApplication.audit({
            actionType: "communications.call_session_started",
            actor,
            afterState: { roomId: resolved.value.room.id, sessionId: session.id },
            commandInput: { roomId: resolved.value.room.id },
            permissionResult: resolved.value.access.manageDecision,
            sourceEntity: resolved.value.access.sourceEntity
          }),
          transactionDataSource
        );
        return { event, room: room ?? resolved.value.room, session };
      } catch (error) {
        if (isActiveSessionConflictError(error)) {
          throw new CallRouteError(409, "call_room_already_active");
        }
        throw error;
      }
    }).catch((error: unknown) => {
      if (error instanceof CallRouteError) return error;
      if (isActiveSessionConflictError(error)) {
        return new CallRouteError(409, "call_room_already_active");
      }
      throw error;
    });
    if (result instanceof CallRouteError) {
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
    const resolved = await communicationApplication.resolveCallRoomAndSession(context.req.param("roomId"), context.req.param("sessionId"), actor);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    if (resolved.value.session.status !== "active") {
      return context.json({ error: "call_session_not_active" }, 409);
    }
    if (deps.videoProvider.kind === "disabled") {
      return context.json({ error: "video_provider_disabled" }, 501);
    }
    if (resolved.value.room.provider !== deps.videoProvider.kind) {
      return context.json({ error: "video_provider_misconfigured" }, 409);
    }
    if (
      !deps.dataSource.withTransaction ||
      !deps.dataSource.findActiveCallSessionForUpdate ||
      !deps.dataSource.createCallEvent
    ) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const join = await deps.videoProvider.issueJoinToken({
      providerRoomId: resolved.value.room.providerRoomId,
      roomId: resolved.value.room.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      userName: actor.name
    });
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const activeSession = await requireMethod(transactionDataSource.findActiveCallSessionForUpdate).call(
        transactionDataSource,
        {
          tenantId: actor.tenantId,
          roomId: resolved.value.room.id,
          sessionId: resolved.value.session.id
        }
      );
      if (!activeSession) return new CallRouteError(409, "call_session_not_active");
      const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
        id: `call-event-${randomUUID()}`,
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        sessionId: activeSession.id,
        actorUserId: actor.id,
        eventType: "join_token_issued",
        payload: { provider: join.provider, expiresAt: join.expiresAt }
      });
      await deps.appendManagementAuditEvent(
        communicationApplication.audit({
          actionType: "communications.call_join_token_issued",
          actor,
          afterState: { roomId: resolved.value.room.id, sessionId: activeSession.id },
          commandInput: { roomId: resolved.value.room.id, sessionId: activeSession.id },
          permissionResult: resolved.value.access.readDecision,
          sourceEntity: resolved.value.access.sourceEntity
        }),
        transactionDataSource
      );
      return { event };
    });
    if (result instanceof CallRouteError) {
      return context.json({ error: result.error }, result.status);
    }
    return context.json({
      join: {
        provider: join.provider,
        joinUrl: join.joinUrl,
        token: join.token,
        expiresAt: join.expiresAt
      },
      event: serializeCallEvent(result.event)
    });
  });

  app.post("/api/workspace/call-rooms/:roomId/sessions/:sessionId/participant-state", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await communicationApplication.resolveCallRoomAndSession(context.req.param("roomId"), context.req.param("sessionId"), actor);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    if (resolved.value.session.status !== "active") {
      return context.json({ error: "call_session_not_active" }, 409);
    }
    if (
      !deps.dataSource.withTransaction ||
      !deps.dataSource.findActiveCallSessionForUpdate ||
      !deps.dataSource.upsertCallParticipantState ||
      !deps.dataSource.createCallEvent
    ) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = parseRecordBody(body.value);
    if (!record.ok) return context.json({ error: record.error }, 400);
    const parsed = parseParticipantStateBody(record.value, actor, resolved.value.access);
    if (!parsed.ok) {
      if (parsed.status === 403) {
        await communicationApplication.appendDeniedAudit({
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
    if (parsed.value.userId !== actor.id) {
      const participantExists = await communicationApplication.tenantUserExists(parsed.value.userId, actor);
      if (!participantExists) return context.json({ error: "participant_user_not_found" }, 404);
    }
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const activeSession = await requireMethod(transactionDataSource.findActiveCallSessionForUpdate).call(
        transactionDataSource,
        {
          tenantId: actor.tenantId,
          roomId: resolved.value.room.id,
          sessionId: resolved.value.session.id
        }
      );
      if (!activeSession) return new CallRouteError(409, "call_session_not_active");
      const participantState = await requireMethod(transactionDataSource.upsertCallParticipantState).call(transactionDataSource, {
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        sessionId: activeSession.id,
        userId: parsed.value.userId,
        state: parsed.value.state
      });
      const eventType = eventTypeForParticipantState(parsed.value.state);
      const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
        id: `call-event-${randomUUID()}`,
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        sessionId: activeSession.id,
        actorUserId: actor.id,
        eventType,
        payload: { userId: parsed.value.userId, state: parsed.value.state }
      });
      await deps.appendManagementAuditEvent(
        communicationApplication.audit({
          actionType: "communications.call_participant_state_updated",
          actor,
          afterState: { userId: parsed.value.userId, state: parsed.value.state },
          commandInput: {
            roomId: resolved.value.room.id,
            sessionId: activeSession.id,
            userId: parsed.value.userId
          },
          permissionResult: parsed.value.permissionResult,
          sourceEntity: resolved.value.access.sourceEntity
        }),
        transactionDataSource
      );
      return { event, participantState };
    });
    if (result instanceof CallRouteError) {
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
    const resolved = await communicationApplication.resolveCallRoomAndSession(context.req.param("roomId"), context.req.param("sessionId"), actor);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await communicationApplication.appendDeniedAudit({
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
    if (resolved.value.session.status !== "active") {
      return context.json({ error: "call_session_not_active" }, 409);
    }
    if (
      !deps.dataSource.endCallSession ||
      !deps.dataSource.createCallEvent ||
      !deps.dataSource.updateCallRoomStatus
    ) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const session = await requireMethod(transactionDataSource.endCallSession).call(transactionDataSource, {
        tenantId: actor.tenantId,
        sessionId: resolved.value.session.id,
        endedByUserId: actor.id,
        status: "ended"
      });
      if (!session) throw new CallRouteError(409, "call_session_not_active");
      const room = await requireMethod(transactionDataSource.updateCallRoomStatus).call(transactionDataSource, {
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        status: "ended"
      });
      const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
        id: `call-event-${randomUUID()}`,
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        sessionId: session.id,
        actorUserId: actor.id,
        eventType: "session_ended",
        payload: { endedByUserId: actor.id }
      });
      await deps.appendManagementAuditEvent(
        communicationApplication.audit({
          actionType: "communications.call_session_ended",
          actor,
          afterState: { roomId: resolved.value.room.id, sessionId: session.id },
          commandInput: { roomId: resolved.value.room.id, sessionId: session.id },
          permissionResult: resolved.value.access.manageDecision,
          sourceEntity: resolved.value.access.sourceEntity
        }),
        transactionDataSource
      );
      return { event, room: room ?? resolved.value.room, session };
    }).catch((error: unknown) => {
      if (error instanceof CallRouteError) return error;
      throw error;
    });
    if (result instanceof CallRouteError) {
      return context.json({ error: result.error }, result.status);
    }
    return context.json({
      callRoom: serializeCallRoom(result.room),
      session: serializeCallSession(result.session),
      event: serializeCallEvent(result.event)
    });
  });

  app.post("/api/workspace/call-rooms/:roomId/recordings", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await communicationApplication.resolveCallRoomForActor(context.req.param("roomId"), actor);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await communicationApplication.appendDeniedAudit({
        actionType: "communications.denied",
        actor,
        commandInput: { action: "recording.attach", roomId: context.req.param("roomId") },
        permissionResult: resolved.value.access.manageDecision,
        sourceEntity: resolved.value.access.sourceEntity
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    if (!deps.dataSource.findAttachmentById || !deps.dataSource.createCallRecording || !deps.dataSource.createCallEvent) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = parseRecordBody(body.value);
    if (!record.ok) return context.json({ error: record.error }, 400);
    const parsed = parseRecordingBody(record.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (parsed.value.sessionId) {
      const session = await deps.dataSource.findCallSession?.(actor.tenantId, parsed.value.sessionId);
      if (!session || session.roomId !== resolved.value.room.id) {
        return context.json({ error: "call_session_not_found" }, 404);
      }
    }
    const attachment = await deps.dataSource.findAttachmentById(actor.tenantId, parsed.value.attachmentId);
    if (
      !attachment ||
      attachment.entityType !== resolved.value.room.entityType ||
      attachment.entityId !== resolved.value.room.entityId
    ) {
      return context.json({ error: "call_recording_attachment_invalid" }, 400);
    }
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const recording = await requireMethod(transactionDataSource.createCallRecording).call(transactionDataSource, {
        id: `call-recording-${randomUUID()}`,
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        sessionId: parsed.value.sessionId,
        attachmentId: attachment.id,
        title: parsed.value.title,
        createdByUserId: actor.id
      });
      const event = await requireMethod(transactionDataSource.createCallEvent).call(transactionDataSource, {
        id: `call-event-${randomUUID()}`,
        tenantId: actor.tenantId,
        roomId: resolved.value.room.id,
        sessionId: parsed.value.sessionId,
        actorUserId: actor.id,
        eventType: "recording_attached",
        payload: { recordingId: recording.id, attachmentId: attachment.id }
      });
      await deps.appendManagementAuditEvent(
        communicationApplication.audit({
          actionType: "communications.call_recording_attached",
          actor,
          afterState: { recordingId: recording.id, attachmentId: attachment.id },
          commandInput: { roomId: resolved.value.room.id, attachmentId: attachment.id },
          permissionResult: resolved.value.access.manageDecision,
          sourceEntity: resolved.value.access.sourceEntity
        }),
        transactionDataSource
      );
      return { event, recording };
    });
    return context.json({
      event: serializeCallEvent(result.event),
      recording: serializeCallRecording(result.recording)
    }, 201);
  });

  app.get("/api/workspace/call-rooms/:roomId/events", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await communicationApplication.resolveCallRoomForActor(context.req.param("roomId"), actor);
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
  access: EntityAccessContext
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

function eventTypeForParticipantState(state: CallParticipantStateValue): CallEventType {
  if (state === "invited") return "participant_invited";
  if (state === "joining") return "participant_joining";
  if (state === "joined") return "participant_joined";
  return "participant_left";
}

function parseEntityQuery(entityType: unknown, entityId: unknown) {
  const parsedType = parseCollaborationEntityType(entityType);
  if (!parsedType.ok) return parsedType;
  const parsedId = parseCollaborationId(entityId, "collaboration_entity_id_invalid");
  if (!parsedId.ok) return parsedId;
  return { ok: true as const, value: { entityType: parsedType.value, entityId: parsedId.value } };
}

function parseLimit(value: string | undefined): number {
  if (!value) return 50;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(parsed, 100));
}

function requireMethod<T extends (...args: never[]) => unknown>(method: T | undefined): T {
  if (!method) throw new Error("communications_not_configured");
  return method;
}

class CallRouteError extends Error {
  constructor(
    readonly status: 409,
    readonly error: string
  ) {
    super(error);
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

function summarizeRoom(room: CallRoom): Record<string, unknown> {
  return {
    entityId: room.entityId,
    entityType: room.entityType,
    mediaKind: room.mediaKind,
    provider: room.provider,
    roomId: room.id,
    status: room.status
  };
}

function serializeCallRoom(room: CallRoom) {
  return {
    ...summarizeRoom(room),
    createdAt: room.createdAt.toISOString(),
    createdByUserId: room.createdByUserId,
    meetingId: room.meetingId,
    title: room.title,
    updatedAt: room.updatedAt.toISOString()
  };
}

function serializeCallSession(session: CallSession) {
  return {
    endedAt: session.endedAt?.toISOString() ?? null,
    endedByUserId: session.endedByUserId,
    failureReason: session.failureReason,
    id: session.id,
    providerSessionId: session.providerSessionId,
    roomId: session.roomId,
    startedAt: session.startedAt.toISOString(),
    startedByUserId: session.startedByUserId,
    status: session.status
  };
}

function serializeCallParticipantState(participantState: CallParticipantState) {
  return {
    joinedAt: participantState.joinedAt?.toISOString() ?? null,
    lastSeenAt: participantState.lastSeenAt.toISOString(),
    leftAt: participantState.leftAt?.toISOString() ?? null,
    roomId: participantState.roomId,
    sessionId: participantState.sessionId,
    state: participantState.state,
    userId: participantState.userId
  };
}

function serializeCallEvent(event: CallEvent) {
  return {
    actorUserId: event.actorUserId,
    createdAt: event.createdAt.toISOString(),
    eventType: event.eventType,
    id: event.id,
    payload: event.payload,
    roomId: event.roomId,
    sessionId: event.sessionId
  };
}

function serializeCallRecording(recording: CallRecording) {
  return {
    attachmentId: recording.attachmentId,
    createdAt: recording.createdAt.toISOString(),
    createdByUserId: recording.createdByUserId,
    id: recording.id,
    roomId: recording.roomId,
    sessionId: recording.sessionId,
    title: recording.title
  };
}
