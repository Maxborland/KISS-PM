import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  type PostgresClient
} from "@kiss-pm/persistence";

import { createApp } from "./app";
import type { ApiTenantDataSource } from "./apiTypes";
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

  it("stores screen-share state as safe call metadata without leaking provider details", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("reader@kiss-pm.local", "reader12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);

    const startedShare = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/screen-share`,
      {
        method: "POST",
        headers: jsonHeaders(readerCookie),
        body: JSON.stringify({
          state: "started",
          source: "browser_tab",
          label: "Project review"
        })
      }
    );
    expect(startedShare.status).toBe(200);
    const startedPayload = await startedShare.json() as { event: { eventType: string; payload: Record<string, unknown> } };
    expect(startedPayload.event).toMatchObject({
      eventType: "screen_share_started",
      payload: {
        userId: "user-alpha-reader",
        state: "started",
        source: "browser_tab",
        label: "Project review"
      }
    });

    const stoppedShare = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/screen-share`,
      {
        method: "POST",
        headers: jsonHeaders(readerCookie),
        body: JSON.stringify({
          state: "stopped"
        })
      }
    );
    expect(stoppedShare.status).toBe(200);

    const events = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/events`, {
      headers: { cookie: adminCookie }
    });
    expect(events.status).toBe(200);
    const eventsPayload = await events.json() as { events: Array<{ eventType: string; payload: Record<string, unknown> }> };
    expect(eventsPayload.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "screen_share_started",
          payload: expect.objectContaining({ userId: "user-alpha-reader", source: "browser_tab" })
        }),
        expect.objectContaining({
          eventType: "screen_share_stopped",
          payload: expect.objectContaining({ userId: "user-alpha-reader" })
        })
      ])
    );
    expect(JSON.stringify(eventsPayload.events)).not.toContain("provider-room-secret");

    const auditRows = await client`
      SELECT action_type, input, after_state
      FROM audit_events
      WHERE action_type = 'communications.screen_share_state_updated'
      ORDER BY created_at ASC
    `;
    expect(auditRows).toHaveLength(2);
    expect(JSON.stringify(auditRows)).toContain("screen_share_started");
    expect(JSON.stringify(auditRows)).not.toContain("provider-room-secret");
    expect(JSON.stringify(auditRows)).not.toContain("storageKey");
  });

  it("rejects unsafe screen-share metadata and inactive sessions", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("reader@kiss-pm.local", "reader12345");
    const deniedCookie = await loginAs("denied@kiss-pm.local", "denied12345");
    const room = await createRoom(adminCookie);
    const started = await startSession(adminCookie, room.callRoom.roomId);

    const unsafe = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/screen-share`,
      {
        method: "POST",
        headers: jsonHeaders(readerCookie),
        body: JSON.stringify({
          state: "started",
          source: "screen",
          token: "must-not-persist",
          providerRoomId: "provider-room-secret",
          storageKey: "tenant/raw/capture.webm",
          localPath: "/tmp/capture.webm",
          streamId: "stream-123",
          sdp: "v=0",
          url: "https://user:pass@example.test/capture"
        })
      }
    );
    expect(unsafe.status).toBe(400);
    await expect(unsafe.json()).resolves.toEqual({ error: "screen_share_payload_unsafe" });

    const denied = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/screen-share`,
      {
        method: "POST",
        headers: jsonHeaders(deniedCookie),
        body: JSON.stringify({ state: "started" })
      }
    );
    expect(denied.status).toBe(403);

    const ended = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/end`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie)
      }
    );
    expect(ended.status).toBe(200);

    const inactive = await app.request(
      `/api/workspace/call-rooms/${room.callRoom.roomId}/sessions/${started.session.id}/screen-share`,
      {
        method: "POST",
        headers: jsonHeaders(readerCookie),
        body: JSON.stringify({ state: "stopped" })
      }
    );
    expect(inactive.status).toBe(409);
    await expect(inactive.json()).resolves.toEqual({ error: "call_session_not_active" });

    const events = await app.request(`/api/workspace/call-rooms/${room.callRoom.roomId}/events`, {
      headers: { cookie: adminCookie }
    });
    const eventsPayload = await events.json() as { events: Array<{ eventType: string }> };
    expect(eventsPayload.events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "screen_share_started" })
      ])
    );
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
});
