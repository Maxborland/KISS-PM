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
        "tenant.clients.read",
        "tenant.clients.manage",
        "tenant.contacts.read",
        "tenant.contacts.manage",
        "tenant.communications.read",
        "tenant.communications.manage",
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

  it("supports workspace channel conversations, mentions, reactions and sticker import", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");

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

    const customChannel = await app.request("/api/workspace/communication-channels", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        channelType: "custom",
        title: "Закрытая рабочая группа"
      })
    });
    expect(customChannel.status).toBe(201);
    const customChannelPayload = await customChannel.json() as { channel: { id: string } };

    const projectChannel = await app.request("/api/workspace/communication-channels", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        channelType: "project_general",
        title: "Проектный чат",
        scopeEntityType: "project",
        scopeEntityId: "project-alpha"
      })
    });
    expect(projectChannel.status).toBe(201);
    const projectChannelPayload = await projectChannel.json() as { channel: { id: string } };

    const executorChannels = await app.request("/api/workspace/communication-channels", {
      headers: { cookie: executorCookie }
    });
    expect(executorChannels.status).toBe(200);
    const executorChannelsPayload = await executorChannels.json() as {
      channels: Array<{ id: string; channelType: string }>;
    };
    expect(executorChannelsPayload.channels.map((channel) => channel.id)).toContain(generalChannel?.id);
    expect(executorChannelsPayload.channels.map((channel) => channel.id)).toContain(projectChannelPayload.channel.id);
    expect(executorChannelsPayload.channels.map((channel) => channel.id)).not.toContain(customChannelPayload.channel.id);

    const customDetailsDenied = await app.request(
      `/api/workspace/communication-channels/${customChannelPayload.channel.id}`,
      { headers: { cookie: executorCookie } }
    );
    expect(customDetailsDenied.status).toBe(403);

    const updatedCustom = await app.request(
      `/api/workspace/communication-channels/${customChannelPayload.channel.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({
          title: "Закрытая группа",
          description: "Только для модераторов"
        })
      }
    );
    expect(updatedCustom.status).toBe(200);
    await expect(updatedCustom.json()).resolves.toMatchObject({
      channel: {
        id: customChannelPayload.channel.id,
        title: "Закрытая группа",
        description: "Только для модераторов"
      }
    });

    const channelConversation = await app.request(
      `/api/workspace/communication-channels/${generalChannel?.id}/conversation`,
      { headers: { cookie: adminCookie } }
    );
    expect(channelConversation.status).toBe(200);
    const channelConversationPayload = await channelConversation.json() as {
      conversation: { id: string };
    };

    const message = await app.request(
      `/api/workspace/conversations/${channelConversationPayload.conversation.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ body: "Общий апдейт для @user-alpha-executor" })
      }
    );
    expect(message.status).toBe(201);
    const messagePayload = await message.json() as { message: { id: string } };

    const reaction = await app.request(
      `/api/workspace/conversations/${channelConversationPayload.conversation.id}/messages/${messagePayload.message.id}/reactions`,
      {
        method: "POST",
        headers: jsonHeaders(executorCookie),
        body: JSON.stringify({ emoji: "👍" })
      }
    );
    expect(reaction.status).toBe(201);
    const reactionPayload = await reaction.json() as {
      reaction: { id: string; emoji: string; userId: string };
    };
    expect(reactionPayload).toMatchObject({
      reaction: { emoji: "👍", userId: "user-alpha-executor" }
    });

    const otherMessage = await app.request(
      `/api/workspace/conversations/${channelConversationPayload.conversation.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ body: "Другой апдейт" })
      }
    );
    expect(otherMessage.status).toBe(201);
    const otherMessagePayload = await otherMessage.json() as { message: { id: string } };
    const crossMessageDelete = await app.request(
      `/api/workspace/conversations/${channelConversationPayload.conversation.id}/messages/${otherMessagePayload.message.id}/reactions/${reactionPayload.reaction.id}`,
      {
        method: "DELETE",
        headers: jsonHeaders(executorCookie)
      }
    );
    expect(crossMessageDelete.status).toBe(404);

    const unsafeReaction = await app.request(
      `/api/workspace/conversations/${channelConversationPayload.conversation.id}/messages/${messagePayload.message.id}/reactions`,
      {
        method: "POST",
        headers: jsonHeaders(executorCookie),
        body: JSON.stringify({ emoji: "👍<script>" })
      }
    );
    expect(unsafeReaction.status).toBe(400);

    const notifications = await app.request("/api/workspace/notifications?status=unread", {
      headers: { cookie: executorCookie }
    });
    expect(notifications.status).toBe(200);
    await expect(notifications.json()).resolves.toMatchObject({
      notifications: [
        expect.objectContaining({
          notificationType: "mention",
          sourceEntityType: "communication_channel",
          sourceEntityId: generalChannel?.id
        })
      ]
    });

    const pack = await app.request("/api/workspace/sticker-packs", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        title: "Рабочие реакции",
        description: "PNG/WebP stickers",
        source: "telegram_export"
      })
    });
    expect(pack.status).toBe(201);
    const packPayload = await pack.json() as { stickerPack: { id: string } };

    const fakeForm = new FormData();
    fakeForm.set("file", new File([new Uint8Array([1, 2, 3, 4])], "fake.webp", { type: "image/webp" }));
    fakeForm.set("emoji", "🚀");
    fakeForm.set("title", "Fake");
    fakeForm.set("width", "128");
    fakeForm.set("height", "128");
    const fakeImport = await app.request(
      `/api/workspace/sticker-packs/${packPayload.stickerPack.id}/import`,
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: fakeForm
      }
    );
    expect(fakeImport.status).toBe(400);
    await expect(fakeImport.json()).resolves.toEqual({ error: "sticker_image_invalid" });

    const form = new FormData();
    form.set("file", new File([createWebpStickerBytes(128, 128)], "ship-it.webp", { type: "image/webp" }));
    form.set("emoji", "🚀");
    form.set("title", "Ship it");
    form.set("width", "128");
    form.set("height", "128");
    form.set("tags", "release,fast");
    const imported = await app.request(
      `/api/workspace/sticker-packs/${packPayload.stickerPack.id}/import`,
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: form
      }
    );
    expect(imported.status).toBe(201);
    const importedPayload = await imported.json() as {
      sticker: { id: string; emoji: string; mimeType: string; tags: string[] };
    };
    expect(importedPayload).toMatchObject({
      sticker: {
        emoji: "🚀",
        mimeType: "image/webp",
        tags: ["release", "fast"]
      }
    });

    const mismatchForm = new FormData();
    mismatchForm.set("file", new File([createWebpStickerBytes(128, 128)], "mismatch.webp", { type: "image/webp" }));
    mismatchForm.set("emoji", "🚀");
    mismatchForm.set("title", "Mismatch");
    mismatchForm.set("width", "256");
    mismatchForm.set("height", "128");
    const mismatchImport = await app.request(
      `/api/workspace/sticker-packs/${packPayload.stickerPack.id}/import`,
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: mismatchForm
      }
    );
    expect(mismatchImport.status).toBe(400);
    await expect(mismatchImport.json()).resolves.toEqual({ error: "sticker_dimension_mismatch" });

    const stickerMessage = await app.request(
      `/api/workspace/conversations/${channelConversationPayload.conversation.id}/messages`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ stickerAssetId: importedPayload.sticker.id })
      }
    );
    expect(stickerMessage.status).toBe(201);
    await expect(stickerMessage.json()).resolves.toMatchObject({
      message: {
        body: "🚀",
        stickers: [{ stickerAssetId: importedPayload.sticker.id }]
      }
    });

    const listed = await app.request(
      `/api/workspace/conversations/${channelConversationPayload.conversation.id}/messages`,
      { headers: { cookie: adminCookie } }
    );
    expect(listed.status).toBe(200);
    const listedPayload = await listed.json() as {
      messages: Array<{
        body: string;
        reactions: Array<{ emoji: string; userId: string }>;
        stickers: Array<{ stickerAssetId: string }>;
      }>;
    };
    expect(listedPayload.messages.some((item) =>
      item.reactions.some((itemReaction) =>
        itemReaction.emoji === "👍" && itemReaction.userId === "user-alpha-executor"
      )
    )).toBe(true);
    expect(listedPayload.messages.some((item) =>
      item.body === "🚀" &&
      item.stickers.some((sticker) => sticker.stickerAssetId === importedPayload.sticker.id)
    )).toBe(true);

    const packStickers = await app.request(
      `/api/workspace/sticker-packs/${packPayload.stickerPack.id}/stickers`,
      { headers: { cookie: adminCookie } }
    );
    expect(packStickers.status).toBe(200);
    const packStickersPayload = await packStickers.json() as {
      stickers: Array<{ id: string; checksumSha256?: string }>;
    };
    expect(packStickersPayload.stickers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: importedPayload.sticker.id })])
    );
    expect(packStickersPayload.stickers[0]).not.toHaveProperty("checksumSha256");

    const archivedSticker = await app.request(`/api/workspace/stickers/${importedPayload.sticker.id}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie)
    });
    expect(archivedSticker.status).toBe(200);
    await expect(archivedSticker.json()).resolves.toMatchObject({
      sticker: { id: importedPayload.sticker.id, status: "archived" }
    });

    const archivedPack = await app.request(`/api/workspace/sticker-packs/${packPayload.stickerPack.id}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie)
    });
    expect(archivedPack.status).toBe(200);
    await expect(archivedPack.json()).resolves.toMatchObject({
      stickerPack: { id: packPayload.stickerPack.id, status: "archived" }
    });
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

    const partialTarget = await app.request(`/api/workspace/meetings/${meeting.meeting.id}/action-items`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        title: "Уточнить задачу",
        ownerUserId: "user-alpha-executor",
        targetEntityType: "task"
      })
    });
    expect(partialTarget.status).toBe(400);
    await expect(partialTarget.json()).resolves.toEqual({ error: "meeting_action_target_required" });

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

  it("requires explicit action item target for non-actionable meeting scopes", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const meeting = await app.request("/api/workspace/meetings", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        entityType: "client",
        entityId: "client-romashka",
        title: "Обсуждение клиента",
        scheduledStart: "2026-06-02T10:00:00.000Z",
        scheduledFinish: "2026-06-02T10:30:00.000Z"
      })
    });
    expect(meeting.status).toBe(201);
    const meetingPayload = await meeting.json() as { meeting: { id: string } };

    const missingTarget = await app.request(
      `/api/workspace/meetings/${meetingPayload.meeting.id}/action-items`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({
          title: "Подготовить план контакта",
          ownerUserId: "user-alpha-executor"
        })
      }
    );
    expect(missingTarget.status).toBe(400);
    await expect(missingTarget.json()).resolves.toEqual({ error: "meeting_action_target_required" });

    const explicitTarget = await app.request(
      `/api/workspace/meetings/${meetingPayload.meeting.id}/action-items`,
      {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({
          title: "Подготовить план контакта",
          ownerUserId: "user-alpha-executor",
          targetEntityType: "project",
          targetEntityId: "project-alpha"
        })
      }
    );
    expect(explicitTarget.status).toBe(201);
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
    await client`TRUNCATE message_stickers, sticker_assets, sticker_packs, message_reactions, communication_channel_members, communication_channels, meeting_action_items, meeting_notes, meeting_external_links, meeting_participants, meetings, notification_preferences, user_notifications, conversation_read_states, message_mentions, discussion_messages, conversations, entity_attachments, external_references, file_assets, audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignment_allocations, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
  }
});

function jsonHeaders(cookie: string) {
  return {
    "content-type": "application/json",
    "x-kiss-pm-action": "same-origin",
    cookie
  };
}

function createWebpStickerBytes(width: number, height: number) {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x16, 0x00, 0x00, 0x00], 4);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  bytes.set([0x0a, 0x00, 0x00, 0x00], 16);
  writeUint24LE(bytes, 24, width - 1);
  writeUint24LE(bytes, 27, height - 1);
  return bytes;
}

function writeUint24LE(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
}
