import {
  canEditTasks,
  canManageClients,
  canManageContacts,
  canManageOpportunities,
  canManageProducts,
  canManageProjects,
  canReadClients,
  canReadContacts,
  canReadOpportunities,
  canReadProducts,
  canReadProjects,
  type AccessProfile
} from "@kiss-pm/access-control";
import {
  parseCallMediaKind,
  parseCallParticipantState,
  parseCallRoomProvider,
  parseCallTitle,
  parseCollaborationEntityType,
  parseCollaborationId,
  parseProviderRoomId,
  type CallEvent,
  type CallParticipantState,
  type CallRecording,
  type CallRoom,
  type CallSession,
  type CollaborationEntityType,
  type TenantUser
} from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource, ProjectRecord } from "./apiTypes";
import { resolveCommunicationChannelAccess } from "./communicationChannelAccess";
import {
  createCommunicationCallWorkspace,
  summarizeCallRoom,
  type CommunicationCallAccess
} from "./communications/callWorkspace";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiRouteDeps } from "./routeTypes";

type EntityAccessContext = {
  entityType: CollaborationEntityType;
  entityId: string;
  sourceEntity: { type: string; id: string };
  readDecision: CommunicationCallAccess["readDecision"];
  manageDecision: CommunicationCallAccess["manageDecision"];
  title: string;
};

type ResolvedCallRoom = {
  access: EntityAccessContext;
  room: CallRoom;
};

export function registerCommunicationRealtimeRoutes(app: Hono, deps: ApiRouteDeps) {
  const callWorkspace = createCommunicationCallWorkspace(deps);

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
  return resolveEntityAccess({
    actor,
    dataSource: deps.dataSource,
    entityId: entity.entityId,
    entityType: entity.entityType,
    profile
  });
}

async function resolveEntityAccess(input: {
  actor: TenantUser;
  dataSource: ApiTenantDataSource;
  entityId: string;
  entityType: CollaborationEntityType;
  profile: AccessProfile;
}): Promise<
  | { ok: true; value: EntityAccessContext }
  | { ok: false; status: 404 | 501; error: string }
> {
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  if (input.entityType === "opportunity") {
    const opportunity = await input.dataSource.findOpportunityById?.(
      input.actor.tenantId,
      input.entityId
    );
    if (!opportunity) return { ok: false, status: 404, error: "communications_entity_not_found" };
    return { ok: true, value: {
      entityId: opportunity.id,
      entityType: "opportunity",
      manageDecision: canManageOpportunities(policyInput),
      readDecision: canReadOpportunities(policyInput),
      sourceEntity: { type: "Opportunity", id: opportunity.id },
      title: opportunity.title
    } };
  }
  if (input.entityType === "client") {
    const client = await input.dataSource.findClientById?.(input.actor.tenantId, input.entityId);
    if (!client) return { ok: false, status: 404, error: "communications_entity_not_found" };
    return { ok: true, value: {
      entityId: client.id,
      entityType: "client",
      manageDecision: canManageClients(policyInput),
      readDecision: canReadClients(policyInput),
      sourceEntity: { type: "Client", id: client.id },
      title: client.name
    } };
  }
  if (input.entityType === "contact") {
    const contact = await input.dataSource.findContactById?.(input.actor.tenantId, input.entityId);
    if (!contact) return { ok: false, status: 404, error: "communications_entity_not_found" };
    return { ok: true, value: {
      entityId: contact.id,
      entityType: "contact",
      manageDecision: canManageContacts(policyInput),
      readDecision: canReadContacts(policyInput),
      sourceEntity: { type: "Contact", id: contact.id },
      title: contact.name
    } };
  }
  if (input.entityType === "product") {
    const product = await input.dataSource.findProductById?.(input.actor.tenantId, input.entityId);
    if (!product) return { ok: false, status: 404, error: "communications_entity_not_found" };
    return { ok: true, value: {
      entityId: product.id,
      entityType: "product",
      manageDecision: canManageProducts(policyInput),
      readDecision: canReadProducts(policyInput),
      sourceEntity: { type: "Product", id: product.id },
      title: product.name
    } };
  }
  if (input.entityType === "communication_channel") {
    const channel = await input.dataSource.findCommunicationChannel?.(
      input.actor.tenantId,
      input.entityId
    );
    if (!channel) return { ok: false, status: 404, error: "communications_entity_not_found" };
    const channelAccess = await resolveCommunicationChannelAccess({
      actor: input.actor,
      channel,
      dataSource: input.dataSource,
      profile: input.profile
    });
    return { ok: true, value: {
      entityId: channel.id,
      entityType: "communication_channel",
      manageDecision: channelAccess.manageDecision,
      readDecision: channelAccess.readDecision,
      sourceEntity: { type: "CommunicationChannel", id: channel.id },
      title: channel.title
    } };
  }
  if (input.entityType === "project") {
    const project = await findProject(input.dataSource, input.actor.tenantId, input.entityId);
    if (!project) return { ok: false, status: 404, error: "communications_entity_not_found" };
    return { ok: true, value: {
      entityId: project.id,
      entityType: "project",
      manageDecision: canManageProjects(policyInput),
      readDecision: canReadProjects(policyInput),
      sourceEntity: { type: "Project", id: project.id },
      title: project.title
    } };
  }
  const task = await input.dataSource.findTaskById?.(input.actor.tenantId, input.entityId);
  if (!task) return { ok: false, status: 404, error: "communications_entity_not_found" };
  const projectRead = canReadProjects(policyInput);
  const directTaskRead =
    task.ownerUserId === input.actor.id ||
    task.requesterUserId === input.actor.id ||
    task.participants.some((participant) => participant.userId === input.actor.id);
  return { ok: true, value: {
    entityId: task.id,
    entityType: "task",
    manageDecision: canEditTasks(policyInput),
    readDecision: projectRead.allowed || directTaskRead
      ? { allowed: true, reason: "same_tenant_permission_granted" }
      : projectRead,
    sourceEntity: { type: "Task", id: task.id },
    title: task.title
  } };
}

async function findProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  return (await dataSource.listProjects?.(tenantId))?.find((project) => project.id === projectId);
}

function parseLimit(value: string | undefined): number {
  if (!value) return 50;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(parsed, 100));
}

function serializeCallRoom(room: CallRoom) {
  return {
    ...summarizeCallRoom(room),
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
