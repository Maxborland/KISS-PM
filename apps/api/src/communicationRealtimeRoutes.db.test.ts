import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  type PostgresClient
} from "@kiss-pm/persistence";

import { createApp } from "./app";
import type { ApiTenantDataSource } from "./apiTypes";
import { createDefaultBackgroundJobRegistry } from "./backgroundJobs/jobHandlers";
import type { LiveKitEgressProvider } from "./communications/recording/livekitEgressProvider";
import { createCommunicationRecordingWorkspace } from "./communications/recording/recordingWorkspace";
import {
  communicationJsonHeaders as jsonHeaders,
  communicationRealtimeDatabaseUrl,
  createCommunicationExternalReferenceAttachment,
  createCommunicationRealtimeTestApp,
  loginCommunicationRealtimeUser,
  seedCommunicationRealtimeScenario,
  truncateCommunicationRealtimeState
} from "./communicationRealtimeTestFixture";
import type { VideoProvider } from "./videoProvider";

describe("communications realtime API", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    client = createPostgresClient(communicationRealtimeDatabaseUrl);
    app = createCommunicationRealtimeTestApp(client);
  });

  beforeEach(async () => {
    await seedCommunicationRealtimeScenario(client);
  });

  afterAll(async () => {
    await truncateCommunicationRealtimeState(client);
    await client.end();
  });

  it("creates call room, starts session, issues safe join token and records participant events", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("reader@kiss-pm.local", "reader12345");

    const room = await createRoom(adminCookie);
    expect(room.callRoom).toMatchObject({
      entityId: "project-alpha",
      entityType: "project",
      mediaKind: "video",
      provider: "livekit",
      status: "open"
    });

    const start = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/start`, {
      method: "POST",
      headers: jsonHeaders(adminCookie)
    });
    expect(start.status).toBe(201);
    const started = await start.json() as {
      callRoom: { status: string };
      session: { id: string; status: string };
    };
    expect(started.callRoom.status).toBe("active");
    expect(started.session.status).toBe("active");

    const join = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/join-token`,
      { method: "POST", headers: jsonHeaders(readerCookie) }
    );
    expect(join.status).toBe(200);
    const joinPayload = await join.json() as {
      join: { provider: string; joinUrl: string; token: string; expiresAt: string };
    };
    expect(joinPayload.join).toMatchObject({
      provider: "livekit",
      joinUrl: "https://livekit.kiss.local"
    });
    expect(joinPayload.join.token).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
    expect(joinPayload.join.token).not.toContain("livekit-secret");

    const state = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/participant-state`,
      {
        method: "POST",
        headers: jsonHeaders(readerCookie),
        body: JSON.stringify({ state: "joined" })
      }
    );
    expect(state.status).toBe(200);
    await expect(state.json()).resolves.toMatchObject({
      participantState: {
        state: "joined",
        userId: "user-alpha-reader"
      }
    });

    const events = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/events`, {
      headers: { cookie: adminCookie }
    });
    expect(events.status).toBe(200);
    const eventsPayload = await events.json() as {
      events: Array<{ eventType: string; payload: Record<string, unknown> }>;
    };
    expect(eventsPayload.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "join_token_issued" }),
        expect.objectContaining({ eventType: "participant_joined" })
      ])
    );
    expect(JSON.stringify(eventsPayload.events)).not.toContain(joinPayload.join.token);

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    const auditPayload = await audit.json() as { auditEvents: Array<Record<string, unknown>> };
    expect(auditPayload.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: "communications.call_join_token_issued" })
      ])
    );
    expect(JSON.stringify(auditPayload.auditEvents)).not.toContain(joinPayload.join.token);
    expect(JSON.stringify(auditPayload.auditEvents)).not.toContain("livekit-secret");
  });

  it("supports call rooms scoped to the workspace general communication channel", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("reader@kiss-pm.local", "reader12345");

    const channels = await app.request("/api/workspace/communication-channels", {
      headers: { cookie: adminCookie }
    });
    expect(channels.status).toBe(200);
    const channelsPayload = await channels.json() as {
      channels: Array<{ id: string; channelType: string }>;
    };
    const generalChannel = channelsPayload.channels.find(
      (channel) => channel.channelType === "workspace_general"
    );
    expect(generalChannel?.id).toBe("channel-workspace-general");

    const roomResponse = await app.request("/api/workspace/call-rooms", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        entityType: "communication_channel",
        entityId: generalChannel?.id,
        title: "Общий созвон",
        mediaKind: "audio",
        provider: "livekit",
        providerRoomId: "workspace-general-room"
      })
    });
    expect(roomResponse.status).toBe(201);
    const room = await roomResponse.json() as { callRoom: { roomId: string } };

    const started = await startSession(adminCookie, room.callRoom.roomId);
    const join = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/join-token`,
      { method: "POST", headers: jsonHeaders(readerCookie) }
    );
    expect(join.status).toBe(200);
    await expect(join.json()).resolves.toMatchObject({
      join: {
        provider: "livekit",
        joinUrl: "https://livekit.kiss.local"
      }
    });

    const channelAttachment = await createExternalReferenceAttachment({
      attachmentId: "attachment-channel-recording",
      entityType: "communication_channel",
      entityId: generalChannel?.id ?? "channel-workspace-general"
    });
    const recording = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/recordings`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        attachmentId: channelAttachment,
        title: "Запись общего созвона"
      })
    });
    expect(recording.status).toBe(201);
    await expect(recording.json()).resolves.toMatchObject({
      recording: {
        attachmentId: channelAttachment,
        title: "Запись общего созвона"
      }
    });
  });

  it("emits distinct events for invited and joining participant states", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);

    const invited = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/participant-state`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ state: "invited" })
      }
    );
    expect(invited.status).toBe(200);
    await expect(invited.json()).resolves.toMatchObject({
      event: { eventType: "participant_invited" },
      participantState: { state: "invited" }
    });

    const joining = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/participant-state`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ state: "joining" })
      }
    );
    expect(joining.status).toBe(200);
    await expect(joining.json()).resolves.toMatchObject({
      event: { eventType: "participant_joining" },
      participantState: { state: "joining" }
    });
  });

  it("rejects join tokens when the session ends after the route pre-check", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("reader@kiss-pm.local", "reader12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);
    const race = createSessionEndedRaceApp(started.session.id);

    const join = await race.app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/join-token`,
      { method: "POST", headers: jsonHeaders(readerCookie) }
    );

    expect(join.status).toBe(409);
    await expect(join.json()).resolves.toEqual({ error: "call_session_not_active" });
    expect(race.joinTokenCalls()).toBe(1);

    const events = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/events`, {
      headers: { cookie: adminCookie }
    });
    const eventsPayload = await events.json() as { events: Array<{ eventType: string }> };
    expect(eventsPayload.events).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "join_token_issued" })])
    );
  });

  it("rejects participant updates when the session ends after the route pre-check", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("reader@kiss-pm.local", "reader12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);
    const race = createSessionEndedRaceApp(started.session.id);

    const state = await race.app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/participant-state`,
      {
        method: "POST",
        headers: jsonHeaders(readerCookie),
        body: JSON.stringify({ state: "joined" })
      }
    );

    expect(state.status).toBe(409);
    await expect(state.json()).resolves.toEqual({ error: "call_session_not_active" });

    const events = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/events`, {
      headers: { cookie: adminCookie }
    });
    const eventsPayload = await events.json() as { events: Array<{ eventType: string }> };
    expect(eventsPayload.events).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "participant_joined" })])
    );
  });

  it("blocks users without parent entity access", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const deniedCookie = await loginAs("denied@kiss-pm.local", "denied12345");
    const room = await createRoom(adminCookie);

    const deniedList = await app.request(
      "/api/workspace/call-rooms?entityType=project&entityId=project-alpha",
      { headers: { cookie: deniedCookie } }
    );
    expect(deniedList.status).toBe(403);

    const deniedStart = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/start`, {
      method: "POST",
      headers: jsonHeaders(deniedCookie)
    });
    expect(deniedStart.status).toBe(403);
  });

  it("maps concurrent active session creation to a stable conflict", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const room = await createRoom(adminCookie);
    await startSession(adminCookie, room.callRoom.roomId);

    await client`
      UPDATE call_rooms
      SET status = 'open'
      WHERE tenant_id = 'tenant-alpha' AND id = ${room.callRoom.roomId}
    `;

    const racedStart = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/start`, {
      method: "POST",
      headers: jsonHeaders(adminCookie)
    });
    expect(racedStart.status).toBe(409);
    await expect(racedStart.json()).resolves.toEqual({ error: "call_room_already_active" });
  });

  it("maps duplicate provider room ids to a stable conflict", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createRoom(adminCookie);

    const duplicate = await app.request("/api/workspace/call-rooms", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        entityType: "project",
        entityId: "project-alpha",
        title: "Повторная проектная комната",
        mediaKind: "video",
        provider: "livekit",
        providerRoomId: "project-alpha-room"
      })
    });

    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toEqual({ error: "call_room_provider_room_conflict" });
  });

  it("returns stable conflict when ending an already-ended session", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);

    const ended = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/end`,
      { method: "POST", headers: jsonHeaders(adminCookie) }
    );
    expect(ended.status).toBe(200);

    const alreadyEnded = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/end`,
      { method: "POST", headers: jsonHeaders(adminCookie) }
    );
    expect(alreadyEnded.status).toBe(409);
    await expect(alreadyEnded.json()).resolves.toEqual({ error: "call_session_not_active" });
  });

  it("returns stable validation errors before recording and participant FK failures", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);
    const sameEntityAttachment = await createExternalReferenceAttachment({
      attachmentId: "attachment-project",
      entityType: "project",
      entityId: "project-alpha"
    });

    const missingParticipant = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/participant-state`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ state: "joined", userId: "user-missing" })
      }
    );
    expect(missingParticipant.status).toBe(404);
    await expect(missingParticipant.json()).resolves.toEqual({ error: "participant_user_not_found" });

    const missingSessionRecording = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/recordings`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        attachmentId: sameEntityAttachment,
        sessionId: "call-session-missing",
        title: "Запись без сессии"
      })
    });
    expect(missingSessionRecording.status).toBe(404);
    await expect(missingSessionRecording.json()).resolves.toEqual({ error: "call_session_not_found" });
  });

  it("audits denied manage attempts before returning forbidden", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("reader@kiss-pm.local", "reader12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);

    const deniedParticipant = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/participant-state`,
      {
        method: "POST",
        headers: jsonHeaders(readerCookie),
        body: JSON.stringify({ state: "joined", userId: "user-alpha-admin" })
      }
    );
    expect(deniedParticipant.status).toBe(403);

    const deniedEnd = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/end`,
      { method: "POST", headers: jsonHeaders(readerCookie) }
    );
    expect(deniedEnd.status).toBe(403);

    const deniedRecording = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/recordings`, {
      method: "POST",
      headers: jsonHeaders(readerCookie),
      body: JSON.stringify({})
    });
    expect(deniedRecording.status).toBe(403);

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    expect(audit.status).toBe(200);
    const auditPayload = await audit.json() as { auditEvents: Array<{
      actionType: string;
      input?: { action?: string };
      executionResult?: { status?: string };
    }> };
    const deniedActions = auditPayload.auditEvents
      .filter((event) => event.actionType === "communications.denied")
      .map((event) => event.input?.action);
    expect(deniedActions).toEqual(
      expect.arrayContaining(["participant-state.update", "session.end", "recording.attach"])
    );
    expect(auditPayload.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "communications.denied",
          executionResult: expect.objectContaining({ status: "denied" })
        })
      ])
    );
  });

  it("attaches recordings only through same-entity attachments", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const room = await createRoom(adminCookie);
    const sameEntityAttachment = await createExternalReferenceAttachment({
      attachmentId: "attachment-project",
      entityType: "project",
      entityId: "project-alpha"
    });
    const otherEntityAttachment = await createExternalReferenceAttachment({
      attachmentId: "attachment-other",
      entityType: "project",
      entityId: "project-other"
    });
    const archivedAttachment = await createExternalReferenceAttachment({
      attachmentId: "attachment-archived",
      entityType: "project",
      entityId: "project-alpha"
    });

    const accepted = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/recordings`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        attachmentId: sameEntityAttachment,
        title: "Запись планерки"
      })
    });
    expect(accepted.status).toBe(201);
    await expect(accepted.json()).resolves.toMatchObject({
      recording: {
        attachmentId: sameEntityAttachment,
        title: "Запись планерки"
      }
    });

    const rejected = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/recordings`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        attachmentId: otherEntityAttachment,
        title: "Чужая запись"
      })
    });
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toEqual({
      error: "call_recording_attachment_invalid"
    });

    const archived = await app.request(`/api/workspace/attachments/${archivedAttachment}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie)
    });
    expect(archived.status).toBe(200);
    const rejectedArchived = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/recordings`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        attachmentId: archivedAttachment,
        title: "Удаленная запись"
      })
    });
    expect(rejectedArchived.status).toBe(400);
    await expect(rejectedArchived.json()).resolves.toEqual({
      error: "call_recording_attachment_invalid"
    });
  });

  async function createRoom(cookie: string) {
    const response = await app.request("/api/workspace/call-rooms", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        entityType: "project",
        entityId: "project-alpha",
        title: "Проектный звонок",
        mediaKind: "video",
        provider: "livekit",
        providerRoomId: "project-alpha-room"
      })
    });
    expect(response.status).toBe(201);
    return await response.json() as { callRoom: { roomId: string } };
  }

  async function startSession(cookie: string, roomId: string) {
    const response = await app.request(`/api/workspace/call-rooms/${roomId}/sessions/start`, {
      method: "POST",
      headers: jsonHeaders(cookie)
    });
    expect(response.status).toBe(201);
    return await response.json() as { session: { id: string; status: string } };
  }

  async function loginAs(email: string, password: string) {
    return loginCommunicationRealtimeUser(app, email, password);
  }

  async function createExternalReferenceAttachment(input: {
    attachmentId: string;
    entityType: "project" | "communication_channel";
    entityId: string;
  }) {
    return createCommunicationExternalReferenceAttachment(client, input);
  }

  function createSessionEndedRaceApp(sessionId: string) {
    const baseDataSource = createPostgresTenantDataSource(createDatabase(client));
    let endedAfterPrecheck = false;
    let issuedJoinTokens = 0;
    const dataSource: ApiTenantDataSource = {
      ...baseDataSource,
      async findCallSession(tenantId, requestedSessionId) {
        const session = await baseDataSource.findCallSession(tenantId, requestedSessionId);
        if (!endedAfterPrecheck && requestedSessionId === sessionId && session?.status === "active") {
          endedAfterPrecheck = true;
          await forceEndSession(tenantId, requestedSessionId);
        }
        return session;
      }
    };
    const videoProvider: VideoProvider = {
      kind: "livekit",
      async issueJoinToken() {
        issuedJoinTokens += 1;
        return {
          provider: "livekit",
          joinUrl: "https://livekit.kiss.local",
          token: "race-token",
          expiresAt: "2026-05-25T00:10:00.000Z"
        };
      }
    };
    return {
      app: createApp({ dataSource, videoProvider }),
      joinTokenCalls: () => issuedJoinTokens
    };
  }

  async function forceEndSession(tenantId: string, sessionId: string) {
    await client`
      UPDATE call_sessions
      SET status = 'ended',
        ended_by_user_id = 'user-alpha-admin',
        ended_at = now()
      WHERE tenant_id = ${tenantId}
        AND id = ${sessionId}
    `;
  }

  it("reconcileEgressEnded marks the track ready and logs recording_track_completed", async () => {
    const tenantId = "tenant-alpha";
    const dataSource = createPostgresTenantDataSource(createDatabase(client));

    const room = await dataSource.createCallRoom({
      id: "call-room-rec",
      tenantId,
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "Запись",
      mediaKind: "video",
      provider: "livekit",
      providerRoomId: "provider-room-rec",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const session = await dataSource.createCallSession({
      id: "call-session-rec",
      tenantId,
      roomId: room.id,
      providerSessionId: null,
      status: "active",
      startedByUserId: "user-alpha-admin"
    });
    await dataSource.createCallRecording({
      id: "call-recording-rec",
      tenantId,
      roomId: room.id,
      sessionId: session.id,
      recordingGroupId: "call-rec-group-rec",
      attachmentId: null,
      egressId: "egress-rec-1",
      participantId: "user-alpha-admin",
      trackId: "track-1",
      kind: "video",
      status: "recording",
      durationSeconds: null,
      endedAt: null,
      title: "Запись · user-alpha-admin",
      createdByUserId: "user-alpha-admin"
    });

    const workspace = createCommunicationRecordingWorkspace({
      dataSource,
      egressProvider: null,
      appendManagementAuditEvent: async () => "audit-id"
    });

    const result = await workspace.reconcileEgressEnded({
      tenantId,
      egressId: "egress-rec-1",
      storageKey: `recordings/${tenantId}/${room.id}/${session.id}/call-rec-group-rec/user-alpha-admin/track-1.webm`,
      sizeBytes: 2048,
      durationSeconds: 42
    });
    expect(result.reconciled).toBe(true);

    const recordings = await dataSource.listCallRecordingsByGroup({
      tenantId,
      recordingGroupId: "call-rec-group-rec"
    });
    expect(recordings).toHaveLength(1);
    expect(recordings[0]).toMatchObject({ status: "ready", durationSeconds: 42 });
    expect(recordings[0]?.attachmentId).toBeTruthy();

    const events = await dataSource.listCallEvents({ tenantId, roomId: room.id, limit: 50 });
    const completed = events.find((event) => event.eventType === "recording_track_completed");
    expect(completed).toBeDefined();
    expect(completed?.payload).toMatchObject({
      recordingId: "call-recording-rec",
      trackId: "track-1",
      durationSeconds: 42
    });

    // Idempotent: a retried webhook delivery must not emit a second completion event.
    const retry = await workspace.reconcileEgressEnded({
      tenantId,
      egressId: "egress-rec-1",
      storageKey: `recordings/${tenantId}/${room.id}/${session.id}/call-rec-group-rec/user-alpha-admin/track-1.webm`,
      sizeBytes: 2048,
      durationSeconds: 42
    });
    expect(retry.reconciled).toBe(true);
    const eventsAfter = await dataSource.listCallEvents({ tenantId, roomId: room.id, limit: 50 });
    expect(eventsAfter.filter((event) => event.eventType === "recording_track_completed")).toHaveLength(1);
  });

  it("callRecordingJanitor fails stale in-progress recordings and logs recording_failed", async () => {
    const tenantId = "tenant-alpha";
    const dataSource = createPostgresTenantDataSource(createDatabase(client));

    const room = await dataSource.createCallRoom({
      id: "call-room-stale",
      tenantId,
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "Запись",
      mediaKind: "video",
      provider: "livekit",
      providerRoomId: "provider-room-stale",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const session = await dataSource.createCallSession({
      id: "call-session-stale",
      tenantId,
      roomId: room.id,
      providerSessionId: null,
      status: "active",
      startedByUserId: "user-alpha-admin"
    });
    await dataSource.createCallRecording({
      id: "call-recording-stale",
      tenantId,
      roomId: room.id,
      sessionId: session.id,
      recordingGroupId: "call-rec-group-stale",
      attachmentId: null,
      egressId: "egress-stale-1",
      participantId: "user-alpha-admin",
      trackId: "track-9",
      kind: "video",
      status: "recording",
      durationSeconds: null,
      endedAt: null,
      title: "Запись · stale",
      createdByUserId: "user-alpha-admin"
    });

    const janitor = createDefaultBackgroundJobRegistry()["calls.recording_janitor"];
    expect(janitor).toBeDefined();
    const stoppedEgress: string[] = [];
    const egress: LiveKitEgressProvider = {
      async listRoomTracks() {
        return [];
      },
      async startTrackEgress() {
        return "x";
      },
      async stopEgress(id) {
        stoppedEgress.push(id);
      },
      async receiveWebhook() {
        return { kind: "other" };
      }
    };
    // context.now 10 min ahead makes the just-created row older than the 1-minute window.
    const result = await janitor!(
      { tenantId, payload: { staleAfterMinutes: 1 } } as unknown as Parameters<NonNullable<typeof janitor>>[0],
      { dataSource, egressProvider: egress, now: new Date(Date.now() + 10 * 60_000) }
    );
    expect(result).toMatchObject({ metadata: { failed: 1, stoppedEgress: 1 } });
    // Orphaned egress (lost webhook) is stopped, not just marked failed.
    expect(stoppedEgress).toContain("egress-stale-1");

    const recordings = await dataSource.listCallRecordingsByGroup({
      tenantId,
      recordingGroupId: "call-rec-group-stale"
    });
    expect(recordings[0]).toMatchObject({ status: "failed" });

    const events = await dataSource.listCallEvents({ tenantId, roomId: room.id, limit: 50 });
    const failedEvent = events.find((event) => event.eventType === "recording_failed");
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.payload).toMatchObject({
      recordingId: "call-recording-stale",
      reason: "stale_egress"
    });
  });

  it("startRecording starts egress per track and logs recording_started (injected egress provider)", async () => {
    const tenantId = "tenant-alpha";
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const room = await dataSource.createCallRoom({
      id: "call-room-start",
      tenantId,
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "Запись",
      mediaKind: "video",
      provider: "livekit",
      providerRoomId: "provider-room-start",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const session = await dataSource.createCallSession({
      id: "call-session-start",
      tenantId,
      roomId: room.id,
      providerSessionId: null,
      status: "active",
      startedByUserId: "user-alpha-admin"
    });

    const startedTracks: string[] = [];
    const fakeEgress: LiveKitEgressProvider = {
      async listRoomTracks() {
        return [{ trackId: "track-a", kind: "video", participantIdentity: "user-alpha-admin" }];
      },
      async startTrackEgress(input) {
        startedTracks.push(input.trackId);
        return "egress-start-1";
      },
      async stopEgress() {},
      async receiveWebhook() {
        return { kind: "other" };
      }
    };
    // The recording happy-path was previously unreachable by tests because the egress
    // provider was built from env inside the route; it is now injected via deps.
    const recApp = createCommunicationRealtimeTestApp(client, undefined, fakeEgress);
    const adminCookie = await loginCommunicationRealtimeUser(recApp, "admin@kiss-pm.local", "admin12345");

    const response = await recApp.request(
      `/api/workspace/call-rooms/${room.id}/sessions/${session.id}/recordings/start`,
      { method: "POST", headers: jsonHeaders(adminCookie) }
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      recordingGroupId: string;
      recordings: { trackId: string; status: string }[];
    };
    expect(body.recordings).toHaveLength(1);
    expect(body.recordings[0]).toMatchObject({ trackId: "track-a", status: "recording" });
    expect(startedTracks).toEqual(["track-a"]);

    const events = await dataSource.listCallEvents({ tenantId, roomId: room.id, limit: 50 });
    expect(events.some((event) => event.eventType === "recording_started")).toBe(true);
  });

  it("rejects recording start for non-LiveKit rooms", async () => {
    const tenantId = "tenant-alpha";
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const room = await dataSource.createCallRoom({
      id: "call-room-manual",
      tenantId,
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "Звонок",
      mediaKind: "video",
      provider: "manual",
      providerRoomId: "provider-room-manual",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const session = await dataSource.createCallSession({
      id: "call-session-manual",
      tenantId,
      roomId: room.id,
      providerSessionId: null,
      status: "active",
      startedByUserId: "user-alpha-admin"
    });
    const egress: LiveKitEgressProvider = {
      async listRoomTracks() {
        return [{ trackId: "t", kind: "video", participantIdentity: "user-alpha-admin" }];
      },
      async startTrackEgress() {
        return "egress-x";
      },
      async stopEgress() {},
      async receiveWebhook() {
        return { kind: "other" };
      }
    };
    const recApp = createCommunicationRealtimeTestApp(client, undefined, egress);
    const cookie = await loginCommunicationRealtimeUser(recApp, "admin@kiss-pm.local", "admin12345");
    const res = await recApp.request(
      `/api/workspace/call-rooms/${room.id}/sessions/${session.id}/recordings/start`,
      { method: "POST", headers: jsonHeaders(cookie) }
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("call_recording_provider_unsupported");
  });

  it("rejects recording start when no tracks are published", async () => {
    const tenantId = "tenant-alpha";
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const room = await dataSource.createCallRoom({
      id: "call-room-empty",
      tenantId,
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "Звонок",
      mediaKind: "video",
      provider: "livekit",
      providerRoomId: "provider-room-empty",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const session = await dataSource.createCallSession({
      id: "call-session-empty",
      tenantId,
      roomId: room.id,
      providerSessionId: null,
      status: "active",
      startedByUserId: "user-alpha-admin"
    });
    const egress: LiveKitEgressProvider = {
      async listRoomTracks() {
        return [];
      },
      async startTrackEgress() {
        return "egress-x";
      },
      async stopEgress() {},
      async receiveWebhook() {
        return { kind: "other" };
      }
    };
    const recApp = createCommunicationRealtimeTestApp(client, undefined, egress);
    const cookie = await loginCommunicationRealtimeUser(recApp, "admin@kiss-pm.local", "admin12345");
    const res = await recApp.request(
      `/api/workspace/call-rooms/${room.id}/sessions/${session.id}/recordings/start`,
      { method: "POST", headers: jsonHeaders(cookie) }
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("call_recording_no_tracks");
  });

  it("does not stop a recording group that belongs to a different room", async () => {
    const tenantId = "tenant-alpha";
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const roomA = await dataSource.createCallRoom({
      id: "call-room-a",
      tenantId,
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "A",
      mediaKind: "video",
      provider: "livekit",
      providerRoomId: "provider-room-a",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const roomB = await dataSource.createCallRoom({
      id: "call-room-b",
      tenantId,
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "B",
      mediaKind: "video",
      provider: "livekit",
      providerRoomId: "provider-room-b",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const sessionB = await dataSource.createCallSession({
      id: "call-session-b",
      tenantId,
      roomId: roomB.id,
      providerSessionId: null,
      status: "active",
      startedByUserId: "user-alpha-admin"
    });
    await dataSource.createCallRecording({
      id: "call-recording-b",
      tenantId,
      roomId: roomB.id,
      sessionId: sessionB.id,
      recordingGroupId: "call-rec-group-b",
      attachmentId: null,
      egressId: "egress-b-1",
      participantId: "user-alpha-admin",
      trackId: "track-b",
      kind: "video",
      status: "recording",
      durationSeconds: null,
      endedAt: null,
      title: "B",
      createdByUserId: "user-alpha-admin"
    });
    const stopped: string[] = [];
    const egress: LiveKitEgressProvider = {
      async listRoomTracks() {
        return [];
      },
      async startTrackEgress() {
        return "egress-x";
      },
      async stopEgress(id) {
        stopped.push(id);
      },
      async receiveWebhook() {
        return { kind: "other" };
      }
    };
    const recApp = createCommunicationRealtimeTestApp(client, undefined, egress);
    const cookie = await loginCommunicationRealtimeUser(recApp, "admin@kiss-pm.local", "admin12345");
    // Stop room B's group through room A, which the same admin also manages.
    const res = await recApp.request(
      `/api/workspace/call-rooms/${roomA.id}/recordings/groups/call-rec-group-b/stop`,
      { method: "POST", headers: jsonHeaders(cookie) }
    );
    expect(res.status).toBe(404);
    expect(stopped).toEqual([]);
  });

  it("stops active recording egress when the session ends", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const room = await dataSource.createCallRoom({
      id: "call-room-end",
      tenantId: "tenant-alpha",
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "Звонок",
      mediaKind: "video",
      provider: "livekit",
      providerRoomId: "provider-room-end",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const session = await dataSource.createCallSession({
      id: "call-session-end",
      tenantId: "tenant-alpha",
      roomId: room.id,
      providerSessionId: null,
      status: "active",
      startedByUserId: "user-alpha-admin"
    });
    const stopped: string[] = [];
    const egress: LiveKitEgressProvider = {
      async listRoomTracks() {
        return [{ trackId: "track-end", kind: "video", participantIdentity: "user-alpha-admin" }];
      },
      async startTrackEgress() {
        return "egress-end-1";
      },
      async stopEgress(id) {
        stopped.push(id);
      },
      async receiveWebhook() {
        return { kind: "other" };
      }
    };
    const recApp = createCommunicationRealtimeTestApp(client, undefined, egress);
    const cookie = await loginCommunicationRealtimeUser(recApp, "admin@kiss-pm.local", "admin12345");
    const startRes = await recApp.request(
      `/api/workspace/call-rooms/${room.id}/sessions/${session.id}/recordings/start`,
      { method: "POST", headers: jsonHeaders(cookie) }
    );
    expect(startRes.status).toBe(201);
    const endRes = await recApp.request(
      `/api/workspace/call-rooms/${room.id}/sessions/${session.id}/end`,
      { method: "POST", headers: jsonHeaders(cookie) }
    );
    expect(endRes.status).toBe(200);
    expect(stopped).toContain("egress-end-1");
  });

  it("exposes the active session in the call room detail so a second participant can join", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);

    const detail = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}`, {
      headers: jsonHeaders(adminCookie)
    });
    expect(detail.status).toBe(200);
    const body = (await detail.json()) as { activeSession: { id: string; status: string } | null };
    expect(body.activeSession?.id).toBe(started.session.id);
    expect(body.activeSession?.status).toBe("active");
  });

  it("failRecordingByEgress fails a recording from a failed egress callback and logs recording_failed", async () => {
    const tenantId = "tenant-alpha";
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const room = await dataSource.createCallRoom({
      id: "call-room-fail",
      tenantId,
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "Звонок",
      mediaKind: "video",
      provider: "livekit",
      providerRoomId: "provider-room-fail",
      status: "active",
      createdByUserId: "user-alpha-admin"
    });
    const session = await dataSource.createCallSession({
      id: "call-session-fail",
      tenantId,
      roomId: room.id,
      providerSessionId: null,
      status: "active",
      startedByUserId: "user-alpha-admin"
    });
    await dataSource.createCallRecording({
      id: "call-recording-fail",
      tenantId,
      roomId: room.id,
      sessionId: session.id,
      recordingGroupId: "call-rec-group-fail",
      attachmentId: null,
      egressId: "egress-fail-1",
      participantId: "user-alpha-admin",
      trackId: "track-f",
      kind: "video",
      status: "recording",
      durationSeconds: null,
      endedAt: null,
      title: "Запись · fail",
      createdByUserId: "user-alpha-admin"
    });

    const workspace = createCommunicationRecordingWorkspace({
      dataSource,
      egressProvider: null,
      appendManagementAuditEvent: async () => "audit-id"
    });
    const result = await workspace.failRecordingByEgress({ tenantId, egressId: "egress-fail-1" });
    expect(result.failed).toBe(true);

    const recordings = await dataSource.listCallRecordingsByGroup({
      tenantId,
      recordingGroupId: "call-rec-group-fail"
    });
    expect(recordings[0]).toMatchObject({ status: "failed" });

    const events = await dataSource.listCallEvents({ tenantId, roomId: room.id, limit: 50 });
    const failedEvent = events.find((event) => event.eventType === "recording_failed");
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.payload).toMatchObject({
      recordingId: "call-recording-fail",
      reason: "egress_failed"
    });
  });
});
