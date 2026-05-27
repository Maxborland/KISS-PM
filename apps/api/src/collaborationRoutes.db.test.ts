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

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const collaborationSeed: SeedTenantDataset = {
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
        "tenant.project_activation.manage",
        "tenant.tasks.create",
        "tenant.tasks.edit",
        "tenant.project_plan.read",
        "tenant.project_resources.read",
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
      id: "user-alpha-executor",
      tenantId: "tenant-alpha",
      email: "executor@kiss-pm.local",
      name: "Егор Исполнитель",
      accessProfileId: "access-profile-reader",
      positionId: "position-engineer",
      password: "executor12345"
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

describe("collaboration and communications API", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await truncateCollaborationState();
    await seedTenantDataset(
      createDatabase(client),
      collaborationSeed,
      new Date("2026-05-25T00:00:00.000Z")
    );
    await createActiveProject();
  });

  afterAll(async () => {
    await truncateCollaborationState();
    await client.end();
  });

  it("creates project conversation messages, mentions and readable notifications", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");

    const conversations = await app.request(
      "/api/workspace/conversations?entityType=project&entityId=project-alpha",
      { headers: { cookie: adminCookie } }
    );
    expect(conversations.status).toBe(200);
    const conversationsPayload = await conversations.json() as {
      conversations: Array<{ id: string; readState: { unreadCount: number } }>;
    };
    expect(conversationsPayload.conversations).toHaveLength(1);
    expect(conversationsPayload.conversations[0]?.readState.unreadCount).toBe(0);
    const conversationId = conversationsPayload.conversations[0]?.id;
    expect(conversationId).toBeTruthy();

    const message = await app.request(`/api/workspace/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        body: "Егор, посмотри риск по срокам @user-alpha-executor",
        metadata: {
          links: [
            { entityType: "project", entityId: "project-alpha" },
            { entityType: "kpi_signal", entityId: "signal-schedule-risk" }
          ],
          attachmentIds: ["attachment-risk-note"]
        }
      })
    });
    expect(message.status).toBe(201);
    await expect(message.json()).resolves.toMatchObject({
      message: {
        body: "Егор, посмотри риск по срокам @user-alpha-executor",
        metadata: {
          links: [
            { entityType: "project", entityId: "project-alpha" },
            { entityType: "kpi_signal", entityId: "signal-schedule-risk" }
          ],
          attachmentIds: ["attachment-risk-note"]
        }
      },
      mentions: [{ mentionedUserId: "user-alpha-executor" }]
    });

    const notifications = await app.request("/api/workspace/notifications?status=unread", {
      headers: { cookie: executorCookie }
    });
    expect(notifications.status).toBe(200);
    await expect(notifications.json()).resolves.toMatchObject({
      notifications: [
        expect.objectContaining({
          notificationType: "mention",
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          readAt: null
        })
      ]
    });

    const executorConversations = await app.request(
      "/api/workspace/conversations?entityType=project&entityId=project-alpha",
      { headers: { cookie: executorCookie } }
    );
    const executorPayload = await executorConversations.json() as {
      conversations: Array<{ readState: { unreadCount: number } }>;
    };
    expect(executorPayload.conversations[0]?.readState.unreadCount).toBe(1);
  });

  it("lists the latest conversation messages and pages older history by cursor", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const conversations = await app.request(
      "/api/workspace/conversations?entityType=project&entityId=project-alpha",
      { headers: { cookie: adminCookie } }
    );
    const conversationsPayload = await conversations.json() as {
      conversations: Array<{ id: string }>;
    };
    const conversationId = conversationsPayload.conversations[0]?.id;
    expect(conversationId).toBeTruthy();

    const created: string[] = [];
    for (const index of [1, 2, 3, 4]) {
      const response = await app.request(`/api/workspace/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ body: `Сообщение ${index}` })
      });
      expect(response.status).toBe(201);
      const payload = await response.json() as { message: { id: string } };
      await client`
        UPDATE discussion_messages
        SET created_at = ${`2026-05-25T09:0${index}:00.000Z`}::timestamptz
        WHERE tenant_id = 'tenant-alpha'
          AND id = ${payload.message.id}
      `;
      created.push(payload.message.id);
    }

    const latest = await app.request(
      `/api/workspace/conversations/${conversationId}/messages?limit=2`,
      { headers: { cookie: adminCookie } }
    );
    expect(latest.status).toBe(200);
    const latestPayload = await latest.json() as {
      messages: Array<{ id: string; body: string }>;
      nextCursor: string | null;
    };
    expect(latestPayload.messages.map((message) => message.body)).toEqual([
      "Сообщение 3",
      "Сообщение 4"
    ]);
    expect(latestPayload.nextCursor).toBe(created[2]);

    const older = await app.request(
      `/api/workspace/conversations/${conversationId}/messages?limit=2&cursor=${encodeURIComponent(latestPayload.nextCursor ?? "")}`,
      { headers: { cookie: adminCookie } }
    );
    expect(older.status).toBe(200);
    const olderPayload = await older.json() as {
      messages: Array<{ body: string }>;
      nextCursor: string | null;
    };
    expect(olderPayload.messages.map((message) => message.body)).toEqual([
      "Сообщение 1",
      "Сообщение 2"
    ]);
    expect(olderPayload.nextCursor).toBe(created[0]);
  });

  it("blocks users without parent entity access and rejects unsafe meeting links", async () => {
    const deniedCookie = await loginAs("denied@kiss-pm.local", "denied12345");
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");

    const denied = await app.request(
      "/api/workspace/conversations?entityType=project&entityId=project-alpha",
      { headers: { cookie: deniedCookie } }
    );
    expect(denied.status).toBe(403);

    const meeting = await createMeeting(adminCookie);
    const unsafeLink = await app.request(`/api/workspace/meetings/${meeting.meeting.id}/external-links`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        provider: "zoom",
        title: "Локальный звонок",
        url: "http://127.0.0.1:8080/meeting"
      })
    });
    expect(unsafeLink.status).toBe(400);
    await expect(unsafeLink.json()).resolves.toEqual({ error: "external_url_private_host" });
  });

  it("supports task and opportunity scoped discussions", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask();

    for (const entity of [
      { entityType: "task", entityId: "task-alpha" },
      { entityType: "opportunity", entityId: "opportunity-alpha" }
    ]) {
      const conversations = await app.request(
        `/api/workspace/conversations?entityType=${entity.entityType}&entityId=${entity.entityId}`,
        { headers: { cookie: adminCookie } }
      );
      expect(conversations.status).toBe(200);
      const payload = await conversations.json() as { conversations: Array<{ id: string }> };
      const conversationId = payload.conversations[0]?.id;
      expect(conversationId).toBeTruthy();

      const message = await app.request(`/api/workspace/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({
          body: `Обсуждение ${entity.entityType}`,
          metadata: { links: [{ entityType: entity.entityType, entityId: entity.entityId }] }
        })
      });
      expect(message.status).toBe(201);

      const messages = await app.request(`/api/workspace/conversations/${conversationId}/messages`, {
        headers: { cookie: adminCookie }
      });
      expect(messages.status).toBe(200);
      await expect(messages.json()).resolves.toMatchObject({
        messages: [expect.objectContaining({ body: `Обсуждение ${entity.entityType}` })]
      });
    }
  });

  it("creates meetings with participants, external links, notes and action items", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");

    const meeting = await createMeeting(adminCookie);
    expect(meeting.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "user-alpha-admin", role: "organizer" }),
        expect.objectContaining({ userId: "user-alpha-executor", role: "required" })
      ])
    );

    const link = await app.request(`/api/workspace/meetings/${meeting.meeting.id}/external-links`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        provider: "google_meet",
        title: "Планерка",
        url: "https://meet.google.com/abc-defg-hij"
      })
    });
    expect(link.status).toBe(201);
    await expect(link.json()).resolves.toMatchObject({
      externalLink: { provider: "google_meet", title: "Планерка" }
    });

    const note = await app.request(`/api/workspace/meetings/${meeting.meeting.id}/notes`, {
      method: "POST",
      headers: jsonHeaders(executorCookie),
      body: JSON.stringify({ body: "Решили сдвинуть ревью на утро." })
    });
    expect(note.status).toBe(201);

    const actionItem = await app.request(`/api/workspace/meetings/${meeting.meeting.id}/action-items`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        title: "Подготовить список рисков",
        ownerUserId: "user-alpha-executor",
        dueDate: "2026-06-03",
        targetEntityType: "project",
        targetEntityId: "project-alpha"
      })
    });
    expect(actionItem.status).toBe(201);
    await expect(actionItem.json()).resolves.toMatchObject({
      actionItem: {
        title: "Подготовить список рисков",
        ownerUserId: "user-alpha-executor",
        status: "open"
      }
    });

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    const auditPayload = await audit.json() as { auditEvents: Array<{ actionType: string }> };
    expect(auditPayload.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: "collaboration.meeting_created" }),
        expect.objectContaining({ actionType: "collaboration.external_meeting_link_added" }),
        expect.objectContaining({ actionType: "collaboration.meeting_action_item_created" })
      ])
    );
  });

  it("persists notification preferences for digest-ready notification feeds", async () => {
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");

    const update = await app.request("/api/workspace/notification-preferences", {
      method: "PUT",
      headers: jsonHeaders(executorCookie),
      body: JSON.stringify({
        preferences: [
          {
            channel: "in_app",
            notificationType: "mention",
            enabled: true,
            digestFrequency: "none"
          },
          {
            channel: "digest",
            notificationType: "deadline_risk",
            enabled: true,
            digestFrequency: "daily"
          }
        ]
      })
    });
    expect(update.status).toBe(200);
    await expect(update.json()).resolves.toMatchObject({
      preferences: [
        expect.objectContaining({ channel: "digest", digestFrequency: "daily" }),
        expect.objectContaining({ channel: "in_app", notificationType: "mention" })
      ]
    });

    const list = await app.request("/api/workspace/notification-preferences", {
      headers: { cookie: executorCookie }
    });
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      preferences: [
        expect.objectContaining({ channel: "digest", notificationType: "deadline_risk" }),
        expect.objectContaining({ channel: "in_app", notificationType: "mention" })
      ]
    });
  });

  it("rolls back message edits when success audit cannot be written", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const conversations = await app.request(
      "/api/workspace/conversations?entityType=project&entityId=project-alpha",
      { headers: { cookie: adminCookie } }
    );
    const conversationsPayload = await conversations.json() as {
      conversations: Array<{ id: string }>;
    };
    const conversationId = conversationsPayload.conversations[0]?.id;
    expect(conversationId).toBeTruthy();
    const message = await app.request(`/api/workspace/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ body: "Исходное сообщение" })
    });
    expect(message.status).toBe(201);
    const messagePayload = await message.json() as { message: { id: string } };
    const failingApp = createAuditFailingApp();

    const update = await failingApp.request(
      `/api/workspace/conversations/${conversationId}/messages/${messagePayload.message.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ body: "Не должно сохраниться" })
      }
    );

    expect(update.status).toBe(500);
    const rows = await client`
      SELECT body
      FROM discussion_messages
      WHERE tenant_id = 'tenant-alpha'
        AND id = ${messagePayload.message.id}
    `;
    expect(rows[0]?.body).toBe("Исходное сообщение");
  });

  it("rolls back meeting external links when success audit cannot be written", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const meeting = await createMeeting(adminCookie);
    const failingApp = createAuditFailingApp();

    const response = await failingApp.request(
      `/api/workspace/meetings/${meeting.meeting.id}/external-links`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({
          provider: "google_meet",
          title: "Неатомарная ссылка",
          url: "https://meet.google.com/rollback-check"
        })
      }
    );

    expect(response.status).toBe(500);
    const rows = await client`
      SELECT count(*)::int AS count
      FROM meeting_external_links
      WHERE tenant_id = 'tenant-alpha'
        AND meeting_id = ${meeting.meeting.id}
    `;
    expect(Number(rows[0]?.count ?? 0)).toBe(0);
  });

  async function createMeeting(cookie: string) {
    const response = await app.request("/api/workspace/meetings", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        entityType: "project",
        entityId: "project-alpha",
        title: "Планерка по рискам",
        agenda: "Сроки, блокеры, решения",
        scheduledStart: "2026-06-02T09:00:00.000Z",
        scheduledFinish: "2026-06-02T09:30:00.000Z",
        participants: [{ userId: "user-alpha-executor", role: "required" }]
      })
    });
    expect(response.status).toBe(201);
    return await response.json() as {
      meeting: { id: string };
      participants: Array<{ userId: string; role: string }>;
    };
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
    await dataSource.activateProjectDraft({
      tenantId: "tenant-alpha",
      projectId: draft.id
    });
  }

  async function createTask() {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const status = (await dataSource.listTaskStatuses("tenant-alpha"))[0];
    if (!status) throw new Error("task_status_missing");
    await dataSource.createTask({
      id: "task-alpha",
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      stageId: null,
      title: "Задача для обсуждения",
      description: null,
      status: status.category,
      statusId: status.id,
      statusName: status.name,
      statusCategory: status.category,
      priority: "normal",
      requesterUserId: "user-alpha-admin",
      ownerUserId: "user-alpha-executor",
      plannedStart: new Date("2026-06-02T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-03T00:00:00.000Z"),
      durationWorkingDays: 2,
      plannedWork: 960,
      actualWork: 0,
      progress: 0,
      requiresAcceptance: false,
      source: "manual",
      participants: [{ userId: "user-alpha-executor", role: "executor" }]
    });
  }

  async function truncateCollaborationState() {
    await client`TRUNCATE meeting_action_items, meeting_notes, meeting_external_links, meeting_participants, meetings, notification_preferences, user_notifications, conversation_read_states, message_mentions, discussion_messages, conversations, audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignment_allocations, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
  }

  function createAuditFailingApp() {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    return createApp({
      dataSource: {
        ...dataSource,
        async withTransaction(operation) {
          return dataSource.withTransaction(async (transactionDataSource) =>
            operation({
              ...transactionDataSource,
              async appendAuditEvent() {
                throw new Error("audit_write_failed");
              }
            })
          );
        }
      }
    });
  }
});

function jsonHeaders(cookie: string) {
  return {
    "content-type": "application/json",
    "x-kiss-pm-action": "same-origin",
    cookie
  };
}
