import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import { createApp } from "./app";
import type { ApiTenantDataSource } from "./apiTypes";
import { createVideoProvider } from "./videoProvider";
import type { VideoProvider } from "./videoProvider";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const seed: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    {
      id: "access-profile-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: [
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.opportunities.read",
        "tenant.opportunities.manage",
        "tenant.communications.read",
        "tenant.communications.manage",
        "tenant.project_activation.manage",
        "tenant.tasks.create",
        "tenant.tasks.edit",
        "tenant.audit_events.read"
      ]
    },
    {
      id: "access-profile-reader",
      tenantId: "tenant-alpha",
      name: "Участник",
      permissions: ["tenant.projects.read"]
    },
    {
      id: "access-profile-denied",
      tenantId: "tenant-alpha",
      name: "Без доступа",
      permissions: []
    }
  ],
  positions: [
    { id: "position-manager", tenantId: "tenant-alpha", name: "Руководитель" },
    { id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" }
  ],
  clients: [{ id: "client-romashka", tenantId: "tenant-alpha", name: "ООО Ромашка" }],
  projectTypes: [
    { id: "project-type-implementation", tenantId: "tenant-alpha", name: "Внедрение" }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-admin",
      positionId: "position-manager",
      password: "admin12345"
    },
    {
      id: "user-alpha-reader",
      tenantId: "tenant-alpha",
      email: "reader@kiss-pm.local",
      name: "Роман Участник",
      accessProfileId: "access-profile-reader",
      positionId: "position-engineer",
      password: "reader12345"
    },
    {
      id: "user-alpha-denied",
      tenantId: "tenant-alpha",
      email: "denied@kiss-pm.local",
      name: "Дина Без Прав",
      accessProfileId: "access-profile-denied",
      password: "denied12345"
    }
  ]
};

describe("communications realtime API", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client)),
      videoProvider: createVideoProvider({
        kind: "livekit",
        url: "https://livekit.kiss.local",
        apiKey: "livekit-key",
        apiSecret: "livekit-secret",
        tokenTtlSeconds: 120
      })
    });
  });

  beforeEach(async () => {
    await truncateState();
    await seedTenantDataset(createDatabase(client), seed, new Date("2026-05-25T00:00:00.000Z"));
    await createActiveProject();
  });

  afterAll(async () => {
    await truncateState();
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
    const sameEntityAttachment = await createProjectAttachment("attachment-project", "project-alpha");

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
    const sameEntityAttachment = await createProjectAttachment("attachment-project", "project-alpha");
    const otherEntityAttachment = await createProjectAttachment("attachment-other", "project-other");

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
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }

  async function createActiveProject() {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const opportunity = await dataSource.createOpportunity({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      primaryContactId: null,
      projectTypeId: "project-type-implementation",
      stageId: null,
      clientName: "ООО Ромашка",
      contactName: "Ирина Клиент",
      title: "Внедрение KISS PM",
      projectType: "Внедрение",
      description: null,
      plannedStart: new Date("2026-06-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
      contractValue: 1000000,
      plannedHourlyRate: 5000,
      plannedHours: 200,
      probability: 80,
      status: "ready_to_activate",
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 80 }]
    });
    const draft = await dataSource.createProjectDraftFromOpportunity({
      id: "project-alpha",
      tenantId: "tenant-alpha",
      sourceOpportunityId: opportunity.id,
      clientId: opportunity.clientId,
      projectTypeId: opportunity.projectTypeId,
      title: opportunity.title,
      clientName: opportunity.clientName,
      status: "draft",
      plannedStart: opportunity.plannedStart,
      plannedFinish: opportunity.plannedFinish,
      contractValue: opportunity.contractValue,
      plannedHours: opportunity.plannedHours,
      templateId: null,
      demand: opportunity.demand
    });
    await dataSource.activateProjectDraft({ tenantId: "tenant-alpha", projectId: draft.id });
    await dataSource.createProjectDraftFromOpportunity({
      id: "project-other",
      tenantId: "tenant-alpha",
      sourceOpportunityId: "opportunity-alpha",
      clientId: opportunity.clientId,
      projectTypeId: opportunity.projectTypeId,
      title: "Другой проект",
      clientName: opportunity.clientName,
      status: "draft",
      plannedStart: opportunity.plannedStart,
      plannedFinish: opportunity.plannedFinish,
      contractValue: opportunity.contractValue,
      plannedHours: opportunity.plannedHours,
      templateId: null,
      demand: opportunity.demand
    }).catch(() => undefined);
  }

  async function createProjectAttachment(attachmentId: string, projectId: string) {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const referenceId = `reference-${attachmentId}`;
    await dataSource.createExternalReference({
      id: referenceId,
      tenantId: "tenant-alpha",
      connectorType: "manual_link",
      externalId: null,
      url: `https://files.kiss.local/${attachmentId}`,
      title: attachmentId,
      metadata: {},
      createdByUserId: "user-alpha-admin"
    });
    const attachment = await dataSource.createEntityAttachment({
      id: attachmentId,
      tenantId: "tenant-alpha",
      entityType: "project",
      entityId: projectId,
      assetId: null,
      externalReferenceId: referenceId,
      relationType: "recording",
      sourceActivityType: null,
      sourceActivityId: null,
      createdByUserId: "user-alpha-admin"
    });
    return attachment.id;
  }

  async function truncateState() {
    await client`TRUNCATE message_stickers, sticker_assets, sticker_packs, message_reactions, communication_channel_members, communication_channels, call_recordings, call_participant_states, call_events, call_sessions, call_rooms, meeting_action_items, meeting_notes, meeting_external_links, meeting_participants, meetings, notification_preferences, user_notifications, conversation_read_states, message_mentions, discussion_messages, conversations, entity_attachments, external_references, file_assets, audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignment_allocations, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
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

function jsonHeaders(cookie: string) {
  return {
    "content-type": "application/json",
    "x-kiss-pm-action": "same-origin",
    cookie
  };
}
