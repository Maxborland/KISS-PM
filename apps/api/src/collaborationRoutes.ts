import { randomUUID } from "node:crypto";

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
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  extractMentionedUserIds,
  meetingActionTargetTypes,
  meetingParticipantRoles,
  parseCollaborationEntityType,
  parseCollaborationId,
  parseConversationTitle,
  parseDigestFrequency,
  parseMeetingActionTargetType,
  parseMeetingAgenda,
  parseMeetingExternalLinkProvider,
  parseMeetingNoteBody,
  parseMeetingStatus,
  parseMeetingTitle,
  parseMessageReactionEmoji,
  parseMessageBody,
  parseNotificationChannel,
  parseNotificationType,
  type CollaborationEntityType,
  type Conversation,
  type Meeting
} from "@kiss-pm/domain";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  ProjectRecord
} from "./apiTypes";
import { parseExternalReferenceUrl, parseReferenceTitle } from "./attachmentValidation";
import { resolveCommunicationChannelAccess } from "./communicationChannelAccess";
import { readLimitedJsonBody } from "./jsonBody";

export type CollaborationRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

type EntityAccessContext = {
  entityType: CollaborationEntityType;
  entityId: string;
  sourceEntity: { type: string; id: string };
  readDecision: PolicyDecision;
  manageDecision: PolicyDecision;
  title: string;
};

export function registerCollaborationRoutes(app: Hono, deps: CollaborationRouteDeps) {
  app.get("/api/workspace/conversations", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const entity = parseEntityQuery(context.req.query("entityType"), context.req.query("entityId"));
    if (!entity.ok) return context.json({ error: entity.error }, 400);
    const access = await resolveEntityAccess({
      actor,
      dataSource: deps.dataSource,
      entityId: entity.value.entityId,
      entityType: entity.value.entityType,
      profile
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.readDecision.allowed) {
      return context.json({ error: access.value.readDecision.reason }, 403);
    }
    if (!deps.dataSource.ensureConversation || !deps.dataSource.listConversationsByEntity) {
      return context.json({ error: "collaboration_not_configured" }, 501);
    }

    await deps.dataSource.ensureConversation({
      id: `conversation-${randomUUID()}`,
      tenantId: actor.tenantId,
      entityType: access.value.entityType,
      entityId: access.value.entityId,
      conversationType: "default",
      title: access.value.title,
      createdByUserId: actor.id
    });
    const conversations = await deps.dataSource.listConversationsByEntity({
      tenantId: actor.tenantId,
      entityType: access.value.entityType,
      entityId: access.value.entityId
    });
    const result = [];
    for (const conversation of conversations) {
      const readState = deps.dataSource.getConversationReadState
        ? await deps.dataSource.getConversationReadState({
            tenantId: actor.tenantId,
            conversationId: conversation.id,
            userId: actor.id
          })
        : null;
      result.push({
        ...serializeConversation(conversation),
        readState
      });
    }
    return context.json({ conversations: result });
  });

  app.get("/api/workspace/conversations/:conversationId/messages", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const conversation = await resolveConversationForActor(context.req.param("conversationId"), actor, deps);
    if (!conversation.ok) return context.json({ error: conversation.error }, conversation.status);
    const limit = parseLimit(context.req.query("limit"), 50);
    const cursor = parseOptionalCursor(context.req.query("cursor"));
    if (!cursor.ok) return context.json({ error: cursor.error }, 400);
    const messages = await deps.dataSource.listDiscussionMessages?.({
      tenantId: actor.tenantId,
      conversationId: conversation.value.conversation.id,
      limit,
      ...(cursor.value ? { cursor: cursor.value } : {})
    });
    if (!messages) return context.json({ error: "collaboration_not_configured" }, 501);
    const messageIds = messages.map((message) => message.id);
    const reactions = await deps.dataSource.listMessageReactionsByMessageIds?.({
      tenantId: actor.tenantId,
      messageIds
    }) ?? [];
    const stickers = await deps.dataSource.listMessageStickersByMessageIds?.({
      tenantId: actor.tenantId,
      messageIds
    }) ?? [];
    return context.json({
      messages: messages.map((message) => serializeMessageWithExtras(message, {
        reactions: reactions.filter((reaction) => reaction.messageId === message.id),
        stickers: stickers.filter((sticker) => sticker.messageId === message.id)
      })),
      nextCursor: messages[0]?.id ?? null
    });
  });

  app.post("/api/workspace/conversations/:conversationId/messages", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const conversation = await resolveConversationForActor(context.req.param("conversationId"), actor, deps);
    if (!conversation.ok) return context.json({ error: conversation.error }, conversation.status);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = readRecord(body.value);
    const stickerAssetId = parseOptionalCollaborationId(record.stickerAssetId, "sticker_asset_id_invalid");
    if (!stickerAssetId.ok) return context.json({ error: stickerAssetId.error }, 400);
    let stickerAsset: import("@kiss-pm/domain").StickerAsset | undefined;
    if (stickerAssetId.value) {
      if (!deps.dataSource.findStickerAsset || !deps.dataSource.createMessageSticker) {
        return context.json({ error: "collaboration_not_configured" }, 501);
      }
      stickerAsset = await deps.dataSource.findStickerAsset(actor.tenantId, stickerAssetId.value);
      if (!stickerAsset) return context.json({ error: "sticker_asset_not_found" }, 404);
    }
    const parsedBody = parseMessageBody(record.body ?? stickerAsset?.emoji);
    if (!parsedBody.ok) return context.json({ error: parsedBody.error }, 400);
    if (!deps.dataSource.createDiscussionMessage || !deps.dataSource.replaceMessageMentions) {
      return context.json({ error: "collaboration_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const message = await requireMethod(transactionDataSource.createDiscussionMessage).call(transactionDataSource, {
        id: `message-${randomUUID()}`,
        tenantId: actor.tenantId,
        conversationId: conversation.value.conversation.id,
        authorUserId: actor.id,
        body: parsedBody.value,
        metadata: parseMessageMetadata(record.metadata)
      });
      const sticker = stickerAsset
        ? await requireMethod(transactionDataSource.createMessageSticker).call(transactionDataSource, {
            tenantId: actor.tenantId,
            messageId: message.id,
            stickerAssetId: stickerAsset.id,
            createdByUserId: actor.id
          })
        : null;
      const mentionUserIds = await filterMentionRecipients({
        actor,
        body: parsedBody.value,
        dataSource: transactionDataSource,
        entity: conversation.value.access
      });
      const mentions = await requireMethod(transactionDataSource.replaceMessageMentions).call(
        transactionDataSource,
        {
          tenantId: actor.tenantId,
          messageId: message.id,
          mentionedUserIds: mentionUserIds
        }
      );
      for (const userId of mentionUserIds) {
        await transactionDataSource.createUserNotification?.({
          id: `notification-${randomUUID()}`,
          tenantId: actor.tenantId,
          userId,
          notificationType: "mention",
          sourceEntityType: conversation.value.access.entityType,
          sourceEntityId: conversation.value.access.entityId,
          title: "Вас упомянули",
          body: trimNotificationBody(parsedBody.value),
          route: routeForEntity(conversation.value.access)
        });
      }
      await deps.appendManagementAuditEvent(
        collaborationAudit({
          actionType: "collaboration.message_created",
          actor,
          sourceEntity: conversation.value.access.sourceEntity,
          commandInput: { conversationId: conversation.value.conversation.id },
          permissionResult: conversation.value.access.readDecision,
          afterState: { messageId: message.id, mentionedUserIds: mentionUserIds, stickerAssetId: sticker?.stickerAssetId ?? null }
        }),
        transactionDataSource
      );
      return { message, mentions, sticker };
    });

    return context.json({
      message: serializeMessageWithExtras(result.message, {
        reactions: [],
        stickers: result.sticker ? [result.sticker] : []
      }),
      mentions: result.mentions
    }, 201);
  });

  app.post("/api/workspace/conversations/:conversationId/messages/:messageId/reactions", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const conversation = await resolveConversationForActor(context.req.param("conversationId"), actor, deps);
    if (!conversation.ok) return context.json({ error: conversation.error }, conversation.status);
    const message = await deps.dataSource.findDiscussionMessage?.(
      actor.tenantId,
      context.req.param("messageId")
    );
    if (!message || message.conversationId !== conversation.value.conversation.id || message.archivedAt) {
      return context.json({ error: "message_not_found" }, 404);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const emoji = parseMessageReactionEmoji(readRecord(body.value).emoji);
    if (!emoji.ok) return context.json({ error: emoji.error }, 400);
    if (!deps.dataSource.upsertMessageReaction) {
      return context.json({ error: "collaboration_not_configured" }, 501);
    }
    const reaction = await deps.dataSource.upsertMessageReaction({
      id: `reaction-${randomUUID()}`,
      tenantId: actor.tenantId,
      messageId: message.id,
      userId: actor.id,
      emoji: emoji.value
    });
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "communications.message_reaction_added",
      actor,
      sourceEntity: conversation.value.access.sourceEntity,
      commandInput: { messageId: message.id, emoji: emoji.value },
      permissionResult: conversation.value.access.readDecision,
      afterState: { reactionId: reaction.id }
    }));
    return context.json({ reaction: serializeReaction(reaction) }, 201);
  });

  app.delete("/api/workspace/conversations/:conversationId/messages/:messageId/reactions/:reactionId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const conversation = await resolveConversationForActor(context.req.param("conversationId"), actor, deps);
    if (!conversation.ok) return context.json({ error: conversation.error }, conversation.status);
    const message = await deps.dataSource.findDiscussionMessage?.(
      actor.tenantId,
      context.req.param("messageId")
    );
    if (!message || message.conversationId !== conversation.value.conversation.id) {
      return context.json({ error: "message_not_found" }, 404);
    }
    const reactionId = parseCollaborationId(context.req.param("reactionId"), "reaction_id_invalid");
    if (!reactionId.ok) return context.json({ error: reactionId.error }, 400);
    const reaction = await deps.dataSource.archiveMessageReaction?.({
      tenantId: actor.tenantId,
      messageId: message.id,
      reactionId: reactionId.value,
      userId: actor.id
    });
    if (!reaction) {
      return context.json({ error: "reaction_not_found" }, 404);
    }
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "communications.message_reaction_removed",
      actor,
      sourceEntity: conversation.value.access.sourceEntity,
      commandInput: { messageId: message.id, reactionId: reaction.id },
      permissionResult: conversation.value.access.readDecision,
      afterState: { archivedAt: reaction.archivedAt?.toISOString() ?? null }
    }));
    return context.json({ reaction: serializeReaction(reaction) });
  });

  app.patch("/api/workspace/conversations/:conversationId/messages/:messageId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const conversation = await resolveConversationForActor(context.req.param("conversationId"), actor, deps);
    if (!conversation.ok) return context.json({ error: conversation.error }, conversation.status);
    const message = await deps.dataSource.findDiscussionMessage?.(
      actor.tenantId,
      context.req.param("messageId")
    );
    if (!message || message.conversationId !== conversation.value.conversation.id) {
      return context.json({ error: "message_not_found" }, 404);
    }
    if (message.authorUserId !== actor.id && !conversation.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, {
        actionType: "collaboration.message_edited",
        actor,
        sourceEntity: conversation.value.access.sourceEntity,
        commandInput: { messageId: message.id },
        permissionResult: conversation.value.access.manageDecision
      });
      return context.json({ error: conversation.value.access.manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsedBody = parseMessageBody(readRecord(body.value).body);
    if (!parsedBody.ok) return context.json({ error: parsedBody.error }, 400);
    const updated = await deps.dataSource.updateDiscussionMessage?.({
      tenantId: actor.tenantId,
      messageId: message.id,
      body: parsedBody.value,
      metadata: parseMessageMetadata(readRecord(body.value).metadata)
    });
    if (!updated) return context.json({ error: "message_not_found" }, 404);
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "collaboration.message_edited",
      actor,
      sourceEntity: conversation.value.access.sourceEntity,
      commandInput: { messageId: message.id },
      permissionResult: message.authorUserId === actor.id
        ? { allowed: true, reason: "same_tenant_permission_granted" }
        : conversation.value.access.manageDecision,
      beforeState: { body: message.body },
      afterState: { body: updated.body }
    }));
    return context.json({ message: serializeMessage(updated) });
  });

  app.post("/api/workspace/conversations/:conversationId/messages/:messageId/pin", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const conversation = await resolveConversationForActor(context.req.param("conversationId"), actor, deps);
    if (!conversation.ok) return context.json({ error: conversation.error }, conversation.status);
    if (!conversation.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, {
        actionType: "collaboration.message_pinned",
        actor,
        sourceEntity: conversation.value.access.sourceEntity,
        commandInput: { messageId: context.req.param("messageId") },
        permissionResult: conversation.value.access.manageDecision
      });
      return context.json({ error: conversation.value.access.manageDecision.reason }, 403);
    }
    const message = await deps.dataSource.findDiscussionMessage?.(
      actor.tenantId,
      context.req.param("messageId")
    );
    if (!message || message.conversationId !== conversation.value.conversation.id) {
      return context.json({ error: "message_not_found" }, 404);
    }
    const pinned = await deps.dataSource.pinDiscussionMessage?.({
      tenantId: actor.tenantId,
      messageId: message.id,
      pinnedByUserId: actor.id
    });
    if (!pinned) {
      return context.json({ error: "message_not_found" }, 404);
    }
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "collaboration.message_pinned",
      actor,
      sourceEntity: conversation.value.access.sourceEntity,
      commandInput: { messageId: pinned.id },
      permissionResult: conversation.value.access.manageDecision,
      afterState: { pinnedAt: pinned.pinnedAt?.toISOString() ?? null }
    }));
    return context.json({ message: serializeMessage(pinned) });
  });

  app.delete("/api/workspace/conversations/:conversationId/messages/:messageId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const conversation = await resolveConversationForActor(context.req.param("conversationId"), actor, deps);
    if (!conversation.ok) return context.json({ error: conversation.error }, conversation.status);
    const message = await deps.dataSource.findDiscussionMessage?.(
      actor.tenantId,
      context.req.param("messageId")
    );
    if (!message || message.conversationId !== conversation.value.conversation.id) {
      return context.json({ error: "message_not_found" }, 404);
    }
    if (message.authorUserId !== actor.id && !conversation.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, {
        actionType: "collaboration.message_removed",
        actor,
        sourceEntity: conversation.value.access.sourceEntity,
        commandInput: { messageId: message.id },
        permissionResult: conversation.value.access.manageDecision
      });
      return context.json({ error: conversation.value.access.manageDecision.reason }, 403);
    }
    const archived = await deps.dataSource.archiveDiscussionMessage?.({
      tenantId: actor.tenantId,
      messageId: message.id
    });
    if (!archived) return context.json({ error: "message_not_found" }, 404);
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "collaboration.message_removed",
      actor,
      sourceEntity: conversation.value.access.sourceEntity,
      commandInput: { messageId: message.id },
      permissionResult: message.authorUserId === actor.id
        ? { allowed: true, reason: "same_tenant_permission_granted" }
        : conversation.value.access.manageDecision,
      beforeState: { messageId: message.id },
      afterState: { archivedAt: archived.archivedAt?.toISOString() ?? null }
    }));
    return context.json({ message: serializeMessage(archived) });
  });

  app.post("/api/workspace/conversations/:conversationId/read-state", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const conversation = await resolveConversationForActor(context.req.param("conversationId"), actor, deps);
    if (!conversation.ok) return context.json({ error: conversation.error }, conversation.status);
    const readState = await deps.dataSource.markConversationRead?.({
      tenantId: actor.tenantId,
      conversationId: conversation.value.conversation.id,
      userId: actor.id
    });
    if (!readState) return context.json({ error: "collaboration_not_configured" }, 501);
    return context.json({ readState });
  });

  app.get("/api/workspace/notifications", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const status = parseNotificationStatus(context.req.query("status"));
    if (!status.ok) return context.json({ error: status.error }, 400);
    const notificationQuery = {
      tenantId: actor.tenantId,
      userId: actor.id,
      limit: parseLimit(context.req.query("limit"), 20)
    };
    const notifications = await deps.dataSource.listUserNotifications?.(
      status.value === undefined
        ? notificationQuery
        : { ...notificationQuery, status: status.value }
    );
    if (!notifications) return context.json({ error: "collaboration_not_configured" }, 501);
    const profile = await deps.getActorProfile(actor);
    const readable = [];
    for (const notification of notifications) {
      const entityType = parseCollaborationEntityType(notification.sourceEntityType);
      if (!entityType.ok) continue;
      const access = await resolveEntityAccess({
        actor,
        dataSource: deps.dataSource,
        entityId: notification.sourceEntityId,
        entityType: entityType.value,
        profile
      });
      if (access.ok && access.value.readDecision.allowed) {
        readable.push(serializeNotification(notification));
      }
    }
    return context.json({ notifications: readable });
  });

  app.post("/api/workspace/notifications/:notificationId/read", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const notificationId = parseCollaborationId(
      context.req.param("notificationId"),
      "notification_id_invalid"
    );
    if (!notificationId.ok) return context.json({ error: notificationId.error }, 400);
    const notification = await deps.dataSource.markUserNotificationRead?.({
      tenantId: actor.tenantId,
      notificationId: notificationId.value,
      userId: actor.id
    });
    if (!notification) return context.json({ error: "notification_not_found" }, 404);
    return context.json({ notification: serializeNotification(notification) });
  });

  app.get("/api/workspace/notification-preferences", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const preferences = await deps.dataSource.listNotificationPreferences?.(
      actor.tenantId,
      actor.id
    );
    if (!preferences) return context.json({ error: "collaboration_not_configured" }, 501);
    return context.json({ preferences });
  });

  app.put("/api/workspace/notification-preferences", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePreferences(readRecord(body.value).preferences, actor);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const preferences = await deps.dataSource.upsertNotificationPreferences?.(parsed.value);
    if (!preferences) return context.json({ error: "collaboration_not_configured" }, 501);
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "notification.preference_updated",
      actor,
      sourceEntity: { type: "User", id: actor.id },
      commandInput: { count: parsed.value.length },
      permissionResult: { allowed: true, reason: "same_tenant_permission_granted" },
      afterState: { count: preferences.length }
    }));
    return context.json({ preferences });
  });

  app.get("/api/workspace/meetings", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const entity = parseEntityQuery(context.req.query("entityType"), context.req.query("entityId"));
    if (!entity.ok) return context.json({ error: entity.error }, 400);
    const access = await resolveEntityAccess({
      actor,
      dataSource: deps.dataSource,
      entityId: entity.value.entityId,
      entityType: entity.value.entityType,
      profile
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.readDecision.allowed) return context.json({ error: access.value.readDecision.reason }, 403);
    const meetings = await deps.dataSource.listMeetingsByEntity?.({
      tenantId: actor.tenantId,
      entityType: access.value.entityType,
      entityId: access.value.entityId
    });
    if (!meetings) return context.json({ error: "collaboration_not_configured" }, 501);
    return context.json({ meetings: meetings.map(serializeMeeting) });
  });

  app.post("/api/workspace/meetings", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseMeetingCreateBody(readRecord(body.value));
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const validParticipants = await validateTenantUserIds(
      deps.dataSource,
      actor.tenantId,
      parsed.value.participants.map((participant) => participant.userId)
    );
    if (!validParticipants.ok) return context.json({ error: validParticipants.error }, 400);
    const access = await resolveEntityAccess({
      actor,
      dataSource: deps.dataSource,
      entityId: parsed.value.entityId,
      entityType: parsed.value.entityType,
      profile
    });
    if (!access.ok) return context.json({ error: access.error }, access.status);
    if (!access.value.manageDecision.allowed) {
      await appendDeniedAudit(deps, {
        actionType: "collaboration.meeting_created",
        actor,
        sourceEntity: access.value.sourceEntity,
        commandInput: { entityType: access.value.entityType, entityId: access.value.entityId },
        permissionResult: access.value.manageDecision
      });
      return context.json({ error: access.value.manageDecision.reason }, 403);
    }
    if (!deps.dataSource.createMeeting || !deps.dataSource.replaceMeetingParticipants) {
      return context.json({ error: "collaboration_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createMeeting || !transactionDataSource.replaceMeetingParticipants) {
        return { ok: false as const };
      }
      const meeting = await transactionDataSource.createMeeting({
        id: `meeting-${randomUUID()}`,
        tenantId: actor.tenantId,
        entityType: access.value.entityType,
        entityId: access.value.entityId,
        title: parsed.value.title,
        agenda: parsed.value.agenda,
        scheduledStart: parsed.value.scheduledStart,
        scheduledFinish: parsed.value.scheduledFinish,
        status: "scheduled",
        createdByUserId: actor.id
      });
      const participants = await transactionDataSource.replaceMeetingParticipants({
        tenantId: actor.tenantId,
        meetingId: meeting.id,
        participants: ensureOrganizer(parsed.value.participants, actor.id)
      });
      for (const participant of participants) {
        if (participant.userId === actor.id) continue;
        await transactionDataSource.createUserNotification?.({
          id: `notification-${randomUUID()}`,
          tenantId: actor.tenantId,
          userId: participant.userId,
          notificationType: "meeting_invite",
          sourceEntityType: access.value.entityType,
          sourceEntityId: access.value.entityId,
          title: "Новая встреча",
          body: parsed.value.title,
          route: routeForEntity(access.value)
        });
      }
      await deps.appendManagementAuditEvent(
        collaborationAudit({
          actionType: "collaboration.meeting_created",
          actor,
          sourceEntity: access.value.sourceEntity,
          commandInput: { meetingId: meeting.id },
          permissionResult: access.value.manageDecision,
          afterState: { participantIds: participants.map((participant) => participant.userId) }
        }),
        transactionDataSource
      );
      return { ok: true as const, meeting, participants };
    });
    if (!result.ok) return context.json({ error: "collaboration_not_configured" }, 501);
    return context.json({
      meeting: serializeMeeting(result.meeting),
      participants: result.participants
    }, 201);
  });

  app.patch("/api/workspace/meetings/:meetingId", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const meeting = await resolveMeetingForActor(context.req.param("meetingId"), actor, deps);
    if (!meeting.ok) return context.json({ error: meeting.error }, meeting.status);
    if (!meeting.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, {
        actionType: "collaboration.meeting_updated",
        actor,
        sourceEntity: meeting.value.access.sourceEntity,
        commandInput: { meetingId: meeting.value.meeting.id },
        permissionResult: meeting.value.access.manageDecision
      });
      return context.json({ error: meeting.value.access.manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseMeetingUpdateBody(readRecord(body.value), meeting.value.meeting);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const updated = await deps.dataSource.updateMeeting?.({
      tenantId: actor.tenantId,
      meetingId: meeting.value.meeting.id,
      ...parsed.value
    });
    if (!updated) return context.json({ error: "meeting_not_found" }, 404);
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: updated.status === "completed" && meeting.value.meeting.status !== "completed"
        ? "collaboration.meeting_completed"
        : "collaboration.meeting_updated",
      actor,
      sourceEntity: meeting.value.access.sourceEntity,
      commandInput: { meetingId: updated.id },
      permissionResult: meeting.value.access.manageDecision,
      beforeState: { status: meeting.value.meeting.status },
      afterState: { status: updated.status }
    }));
    return context.json({ meeting: serializeMeeting(updated) });
  });

  app.post("/api/workspace/meetings/:meetingId/external-links", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const meeting = await resolveMeetingForActor(context.req.param("meetingId"), actor, deps);
    if (!meeting.ok) return context.json({ error: meeting.error }, meeting.status);
    if (!meeting.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, {
        actionType: "collaboration.external_meeting_link_added",
        actor,
        sourceEntity: meeting.value.access.sourceEntity,
        commandInput: { meetingId: meeting.value.meeting.id },
        permissionResult: meeting.value.access.manageDecision
      });
      return context.json({ error: meeting.value.access.manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = readRecord(body.value);
    const provider = parseMeetingExternalLinkProvider(record.provider);
    if (!provider.ok) return context.json({ error: provider.error }, 400);
    const url = parseExternalReferenceUrl(record.url);
    if (!url.ok) return context.json({ error: url.error }, 400);
    const title = parseReferenceTitle(record.title);
    if (!title.ok) return context.json({ error: title.error }, 400);
    const link = await deps.dataSource.createMeetingExternalLink?.({
      id: `meeting-link-${randomUUID()}`,
      tenantId: actor.tenantId,
      meetingId: meeting.value.meeting.id,
      provider: provider.value,
      url: url.value,
      title: title.value,
      createdByUserId: actor.id
    });
    if (!link) return context.json({ error: "collaboration_not_configured" }, 501);
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "collaboration.external_meeting_link_added",
      actor,
      sourceEntity: meeting.value.access.sourceEntity,
      commandInput: { meetingId: meeting.value.meeting.id, provider: provider.value },
      permissionResult: meeting.value.access.manageDecision,
      afterState: { linkId: link.id, provider: link.provider }
    }));
    return context.json({ externalLink: serializeMeetingExternalLink(link) }, 201);
  });

  app.post("/api/workspace/meetings/:meetingId/notes", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const meeting = await resolveMeetingForActor(context.req.param("meetingId"), actor, deps);
    if (!meeting.ok) return context.json({ error: meeting.error }, meeting.status);
    const participants = await deps.dataSource.listMeetingParticipants?.(
      actor.tenantId,
      meeting.value.meeting.id
    );
    const participant = participants?.some((candidate) => candidate.userId === actor.id) ?? false;
    if (!participant && !meeting.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, {
        actionType: "collaboration.meeting_note_created",
        actor,
        sourceEntity: meeting.value.access.sourceEntity,
        commandInput: { meetingId: meeting.value.meeting.id },
        permissionResult: meeting.value.access.manageDecision
      });
      return context.json({ error: meeting.value.access.manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsedBody = parseMeetingNoteBody(readRecord(body.value).body);
    if (!parsedBody.ok) return context.json({ error: parsedBody.error }, 400);
    const note = await deps.dataSource.createMeetingNote?.({
      id: `meeting-note-${randomUUID()}`,
      tenantId: actor.tenantId,
      meetingId: meeting.value.meeting.id,
      authorUserId: actor.id,
      body: parsedBody.value
    });
    if (!note) return context.json({ error: "collaboration_not_configured" }, 501);
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "collaboration.meeting_note_created",
      actor,
      sourceEntity: meeting.value.access.sourceEntity,
      commandInput: { meetingId: meeting.value.meeting.id },
      permissionResult: participant
        ? { allowed: true, reason: "same_tenant_permission_granted" }
        : meeting.value.access.manageDecision,
      afterState: { noteId: note.id }
    }));
    return context.json({ note: serializeMeetingNote(note) }, 201);
  });

  app.post("/api/workspace/meetings/:meetingId/action-items", async (context) => {
    const actor = await requireActor(context.req.header("cookie") ?? null, deps);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const meeting = await resolveMeetingForActor(context.req.param("meetingId"), actor, deps);
    if (!meeting.ok) return context.json({ error: meeting.error }, meeting.status);
    if (!meeting.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, {
        actionType: "collaboration.meeting_action_item_created",
        actor,
        sourceEntity: meeting.value.access.sourceEntity,
        commandInput: { meetingId: meeting.value.meeting.id },
        permissionResult: meeting.value.access.manageDecision
      });
      return context.json({ error: meeting.value.access.manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseMeetingActionItemBody(readRecord(body.value), meeting.value.access);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const ownerExists = await validateTenantUserIds(
      deps.dataSource,
      actor.tenantId,
      [parsed.value.ownerUserId]
    );
    if (!ownerExists.ok) return context.json({ error: ownerExists.error }, 400);
    const actionItem = await deps.dataSource.createMeetingActionItem?.({
      id: `meeting-action-${randomUUID()}`,
      tenantId: actor.tenantId,
      meetingId: meeting.value.meeting.id,
      title: parsed.value.title,
      ownerUserId: parsed.value.ownerUserId,
      dueDate: parsed.value.dueDate,
      targetEntityType: parsed.value.targetEntityType,
      targetEntityId: parsed.value.targetEntityId,
      status: "open",
      createdByUserId: actor.id
    });
    if (!actionItem) return context.json({ error: "collaboration_not_configured" }, 501);
    if (actionItem.ownerUserId !== actor.id) {
      await deps.dataSource.createUserNotification?.({
        id: `notification-${randomUUID()}`,
        tenantId: actor.tenantId,
        userId: actionItem.ownerUserId,
        notificationType: "meeting_action_item",
        sourceEntityType: meeting.value.access.entityType,
        sourceEntityId: meeting.value.access.entityId,
        title: "Action item после встречи",
        body: actionItem.title,
        route: routeForEntity(meeting.value.access)
      });
    }
    await deps.appendManagementAuditEvent(collaborationAudit({
      actionType: "collaboration.meeting_action_item_created",
      actor,
      sourceEntity: meeting.value.access.sourceEntity,
      commandInput: { meetingId: meeting.value.meeting.id },
      permissionResult: meeting.value.access.manageDecision,
      afterState: { actionItemId: actionItem.id, ownerUserId: actionItem.ownerUserId }
    }));
    return context.json({ actionItem: serializeMeetingActionItem(actionItem) }, 201);
  });
}

async function requireActor(cookie: string | null, deps: CollaborationRouteDeps) {
  return deps.getSessionActorFromHeaders(cookie);
}

function parseEntityQuery(entityType: unknown, entityId: unknown) {
  const parsedType = parseCollaborationEntityType(entityType);
  if (!parsedType.ok) return parsedType;
  const parsedId = parseCollaborationId(entityId, "collaboration_entity_id_invalid");
  if (!parsedId.ok) return parsedId;
  return { ok: true as const, value: { entityType: parsedType.value, entityId: parsedId.value } };
}

async function resolveConversationForActor(
  conversationIdRaw: string,
  actor: TenantUser,
  deps: CollaborationRouteDeps
): Promise<
  | { ok: true; value: { conversation: Conversation; access: EntityAccessContext } }
  | { ok: false; status: 400 | 403 | 404 | 501; error: string }
> {
  const conversationId = parseCollaborationId(conversationIdRaw, "conversation_id_invalid");
  if (!conversationId.ok) return { ok: false, status: 400, error: conversationId.error };
  const conversation = await deps.dataSource.findConversation?.(actor.tenantId, conversationId.value);
  if (!conversation) return { ok: false, status: 404, error: "conversation_not_found" };
  const profile = await deps.getActorProfile(actor);
  const access = await resolveEntityAccess({
    actor,
    dataSource: deps.dataSource,
    entityId: conversation.entityId,
    entityType: conversation.entityType,
    profile
  });
  if (!access.ok) return access;
  if (!access.value.readDecision.allowed) {
    return { ok: false, status: 403, error: access.value.readDecision.reason };
  }
  return { ok: true, value: { conversation, access: access.value } };
}

async function resolveMeetingForActor(
  meetingIdRaw: string,
  actor: TenantUser,
  deps: CollaborationRouteDeps
): Promise<
  | { ok: true; value: { meeting: Meeting; access: EntityAccessContext } }
  | { ok: false; status: 400 | 403 | 404 | 501; error: string }
> {
  const meetingId = parseCollaborationId(meetingIdRaw, "meeting_id_invalid");
  if (!meetingId.ok) return { ok: false, status: 400, error: meetingId.error };
  const meeting = await deps.dataSource.findMeeting?.(actor.tenantId, meetingId.value);
  if (!meeting) return { ok: false, status: 404, error: "meeting_not_found" };
  const profile = await deps.getActorProfile(actor);
  const access = await resolveEntityAccess({
    actor,
    dataSource: deps.dataSource,
    entityId: meeting.entityId,
    entityType: meeting.entityType,
    profile
  });
  if (!access.ok) return access;
  if (!access.value.readDecision.allowed) {
    return { ok: false, status: 403, error: access.value.readDecision.reason };
  }
  return { ok: true, value: { meeting, access: access.value } };
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
    if (!opportunity) return { ok: false, status: 404, error: "collaboration_entity_not_found" };
    return { ok: true, value: {
      entityType: "opportunity",
      entityId: opportunity.id,
      sourceEntity: { type: "Opportunity", id: opportunity.id },
      readDecision: canReadOpportunities(policyInput),
      manageDecision: canManageOpportunities(policyInput),
      title: opportunity.title
    } };
  }
  if (input.entityType === "client") {
    const client = await input.dataSource.findClientById?.(input.actor.tenantId, input.entityId);
    if (!client) return { ok: false, status: 404, error: "collaboration_entity_not_found" };
    return { ok: true, value: {
      entityType: "client",
      entityId: client.id,
      sourceEntity: { type: "Client", id: client.id },
      readDecision: canReadClients(policyInput),
      manageDecision: canManageClients(policyInput),
      title: client.name
    } };
  }
  if (input.entityType === "contact") {
    const contact = await input.dataSource.findContactById?.(input.actor.tenantId, input.entityId);
    if (!contact) return { ok: false, status: 404, error: "collaboration_entity_not_found" };
    return { ok: true, value: {
      entityType: "contact",
      entityId: contact.id,
      sourceEntity: { type: "Contact", id: contact.id },
      readDecision: canReadContacts(policyInput),
      manageDecision: canManageContacts(policyInput),
      title: contact.name
    } };
  }
  if (input.entityType === "product") {
    const product = await input.dataSource.findProductById?.(input.actor.tenantId, input.entityId);
    if (!product) return { ok: false, status: 404, error: "collaboration_entity_not_found" };
    return { ok: true, value: {
      entityType: "product",
      entityId: product.id,
      sourceEntity: { type: "Product", id: product.id },
      readDecision: canReadProducts(policyInput),
      manageDecision: canManageProducts(policyInput),
      title: product.name
    } };
  }
  if (input.entityType === "communication_channel") {
    const channel = await input.dataSource.findCommunicationChannel?.(
      input.actor.tenantId,
      input.entityId
    );
    if (!channel) return { ok: false, status: 404, error: "collaboration_entity_not_found" };
    const channelAccess = await resolveCommunicationChannelAccess({
      actor: input.actor,
      channel,
      dataSource: input.dataSource,
      profile: input.profile
    });
    return { ok: true, value: {
      entityType: "communication_channel",
      entityId: channel.id,
      sourceEntity: { type: "CommunicationChannel", id: channel.id },
      readDecision: channelAccess.readDecision,
      manageDecision: channelAccess.manageDecision,
      title: channel.title
    } };
  }
  if (input.entityType === "project") {
    const project = await findProject(input.dataSource, input.actor.tenantId, input.entityId);
    if (!project) return { ok: false, status: 404, error: "collaboration_entity_not_found" };
    return { ok: true, value: {
      entityType: "project",
      entityId: project.id,
      sourceEntity: { type: "Project", id: project.id },
      readDecision: canReadProjects(policyInput),
      manageDecision: canManageProjects(policyInput),
      title: project.title
    } };
  }
  const task = await input.dataSource.findTaskById?.(input.actor.tenantId, input.entityId);
  if (!task) return { ok: false, status: 404, error: "collaboration_entity_not_found" };
  const projectRead = canReadProjects(policyInput);
  const directTaskRead =
    task.ownerUserId === input.actor.id ||
    task.requesterUserId === input.actor.id ||
    task.participants.some((participant) => participant.userId === input.actor.id);
  return { ok: true, value: {
    entityType: "task",
    entityId: task.id,
    sourceEntity: { type: "Task", id: task.id },
    readDecision: projectRead.allowed || directTaskRead
      ? { allowed: true, reason: "same_tenant_permission_granted" }
      : projectRead,
    manageDecision: canEditTasks(policyInput),
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

async function filterMentionRecipients(input: {
  actor: TenantUser;
  body: string;
  dataSource: ApiTenantDataSource;
  entity: EntityAccessContext;
}): Promise<string[]> {
  const rawIds = extractMentionedUserIds(input.body).filter((id) => id !== input.actor.id);
  if (rawIds.length === 0) return [];
  const tenantUsers = await input.dataSource.listUsersByTenantId(input.actor.tenantId);
  const usersById = new Map(tenantUsers.map((user) => [user.id, user]));
  const allowed: string[] = [];
  for (const userId of rawIds) {
    const user = usersById.get(userId);
    if (!user) continue;
    const profile = input.dataSource.findAccessProfileById
      ? await input.dataSource.findAccessProfileById(user.tenantId, user.accessProfileId)
      : undefined;
    if (!profile) continue;
    const access = await resolveEntityAccess({
      actor: user,
      dataSource: input.dataSource,
      entityId: input.entity.entityId,
      entityType: input.entity.entityType,
      profile
    });
    if (access.ok && access.value.readDecision.allowed) allowed.push(userId);
  }
  return allowed;
}

function parseMeetingCreateBody(record: Record<string, unknown>) {
  const entity = parseEntityQuery(record.entityType, record.entityId);
  if (!entity.ok) return entity;
  const title = parseMeetingTitle(record.title);
  if (!title.ok) return title;
  const agenda = parseMeetingAgenda(record.agenda);
  if (!agenda.ok) return agenda;
  const start = parseDateTime(record.scheduledStart, "meeting_start_invalid");
  if (!start.ok) return start;
  const finish = parseDateTime(record.scheduledFinish, "meeting_finish_invalid");
  if (!finish.ok) return finish;
  if (finish.value <= start.value) return { ok: false as const, error: "meeting_schedule_invalid" };
  const participants = parseMeetingParticipants(record.participants);
  if (!participants.ok) return participants;
  return { ok: true as const, value: {
    ...entity.value,
    title: title.value,
    agenda: agenda.value,
    scheduledStart: start.value,
    scheduledFinish: finish.value,
    participants: participants.value
  } };
}

function parseMeetingUpdateBody(record: Record<string, unknown>, current: Meeting) {
  const title = record.title === undefined ? { ok: true as const, value: current.title } : parseMeetingTitle(record.title);
  if (!title.ok) return title;
  const agenda = record.agenda === undefined ? { ok: true as const, value: current.agenda } : parseMeetingAgenda(record.agenda);
  if (!agenda.ok) return agenda;
  const start = record.scheduledStart === undefined
    ? { ok: true as const, value: current.scheduledStart }
    : parseDateTime(record.scheduledStart, "meeting_start_invalid");
  if (!start.ok) return start;
  const finish = record.scheduledFinish === undefined
    ? { ok: true as const, value: current.scheduledFinish }
    : parseDateTime(record.scheduledFinish, "meeting_finish_invalid");
  if (!finish.ok) return finish;
  if (finish.value <= start.value) return { ok: false as const, error: "meeting_schedule_invalid" };
  const status = record.status === undefined
    ? { ok: true as const, value: current.status }
    : parseMeetingStatus(record.status);
  if (!status.ok) return status;
  return { ok: true as const, value: {
    title: title.value,
    agenda: agenda.value,
    scheduledStart: start.value,
    scheduledFinish: finish.value,
    status: status.value
  } };
}

function parseMeetingParticipants(value: unknown) {
  if (!Array.isArray(value)) return { ok: true as const, value: [] };
  if (value.length > 50) return { ok: false as const, error: "meeting_participants_too_many" };
  const parsed = [];
  const seen = new Set<string>();
  for (const item of value) {
    const record = readRecord(item);
    const userId = parseCollaborationId(record.userId, "meeting_participant_user_id_invalid");
    if (!userId.ok) return userId;
    if (seen.has(userId.value)) continue;
    const role = typeof record.role === "string" && meetingParticipantRoles.includes(record.role as never)
      ? record.role as "organizer" | "required" | "optional"
      : "required";
    parsed.push({ userId: userId.value, role, response: "pending" as const });
    seen.add(userId.value);
  }
  return { ok: true as const, value: parsed };
}

function ensureOrganizer(
  participants: Array<{ userId: string; role: "organizer" | "required" | "optional"; response: "pending" }>,
  actorUserId: string
) {
  const withoutActor = participants.filter((participant) => participant.userId !== actorUserId);
  return [
    { userId: actorUserId, role: "organizer" as const, response: "accepted" as const },
    ...withoutActor
  ];
}

function parseMeetingActionItemBody(
  record: Record<string, unknown>,
  entity: EntityAccessContext
) {
  const title = parseConversationTitle(record.title);
  if (!title.ok) return title;
  const ownerUserId = parseCollaborationId(record.ownerUserId, "meeting_action_owner_invalid");
  if (!ownerUserId.ok) return ownerUserId;
  const dueDate = parseOptionalDate(record.dueDate);
  if (!dueDate.ok) return dueDate;
  const canDefaultTarget = isMeetingActionTargetType(entity.entityType);
  const hasTargetEntityType = record.targetEntityType !== undefined;
  const hasTargetEntityId = record.targetEntityId !== undefined;
  if ((!canDefaultTarget || hasTargetEntityType !== hasTargetEntityId) && (!hasTargetEntityType || !hasTargetEntityId)) {
    return { ok: false as const, error: "meeting_action_target_required" };
  }
  const targetEntityType = record.targetEntityType === undefined
    ? { ok: true as const, value: defaultTargetType(entity.entityType) }
    : parseMeetingActionTargetType(record.targetEntityType);
  if (!targetEntityType.ok) return targetEntityType;
  const targetEntityId = record.targetEntityId === undefined
    ? { ok: true as const, value: entity.entityId }
    : parseCollaborationId(record.targetEntityId, "meeting_action_target_id_invalid");
  if (!targetEntityId.ok) return targetEntityId;
  return { ok: true as const, value: {
    title: title.value,
    ownerUserId: ownerUserId.value,
    dueDate: dueDate.value,
    targetEntityType: targetEntityType.value,
    targetEntityId: targetEntityId.value
  } };
}

function defaultTargetType(entityType: CollaborationEntityType) {
  return isMeetingActionTargetType(entityType)
    ? entityType as "task" | "project" | "opportunity"
    : "project";
}

function isMeetingActionTargetType(entityType: CollaborationEntityType) {
  return meetingActionTargetTypes.includes(entityType as never);
}

function parsePreferences(value: unknown, actor: TenantUser) {
  if (!Array.isArray(value)) return { ok: false as const, error: "notification_preferences_invalid" };
  if (value.length > 100) return { ok: false as const, error: "notification_preferences_too_many" };
  const preferences = [];
  for (const item of value) {
    const record = readRecord(item);
    const channel = parseNotificationChannel(record.channel);
    if (!channel.ok) return channel;
    const notificationType = parseNotificationType(record.notificationType);
    if (!notificationType.ok) return notificationType;
    const digestFrequency = parseDigestFrequency(record.digestFrequency ?? "none");
    if (!digestFrequency.ok) return digestFrequency;
    preferences.push({
      tenantId: actor.tenantId,
      userId: actor.id,
      channel: channel.value,
      notificationType: notificationType.value,
      enabled: record.enabled !== false,
      digestFrequency: digestFrequency.value
    });
  }
  return { ok: true as const, value: preferences };
}

function parseNotificationStatus(value: string | undefined):
  | { ok: true; value: "unread" | "read" | undefined }
  | { ok: false; error: string } {
  if (value === undefined || value === "") return { ok: true as const, value: undefined };
  if (value === "unread" || value === "read") return { ok: true as const, value };
  return { ok: false as const, error: "notification_status_invalid" };
}

function parseLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100);
}

function parseOptionalCursor(value: string | undefined):
  | { ok: true; value: string | undefined }
  | { ok: false; error: string } {
  if (value === undefined || value === "") return { ok: true as const, value: undefined };
  const parsed = parseCollaborationId(value, "conversation_cursor_invalid");
  if (!parsed.ok) return parsed;
  return { ok: true as const, value: parsed.value };
}

function parseOptionalCollaborationId(value: unknown, error: string):
  | { ok: true; value: string | undefined }
  | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: undefined };
  }
  const parsed = parseCollaborationId(value, error);
  if (!parsed.ok) return parsed;
  return { ok: true as const, value: parsed.value };
}

function parseDateTime(value: unknown, error: string) {
  if (typeof value !== "string") return { ok: false as const, error };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { ok: false as const, error };
  return { ok: true as const, value: date };
}

function parseOptionalDate(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: null };
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false as const, error: "meeting_action_due_date_invalid" };
  }
  return { ok: true as const, value };
}

function parseMessageMetadata(value: unknown): Record<string, unknown> {
  const record = readRecord(value);
  const links = Array.isArray(record.links)
    ? record.links.slice(0, 20).flatMap((link) => {
        const linkRecord = readRecord(link);
        const type = parseMessageLinkEntityType(linkRecord.entityType);
        const id = parseCollaborationId(linkRecord.entityId, "link_entity_id_invalid");
        if (!type.ok || !id.ok) return [];
        return [{ entityType: type.value, entityId: id.value }];
      })
    : [];
  const attachmentIds = Array.isArray(record.attachmentIds)
    ? record.attachmentIds.slice(0, 20).flatMap((attachmentId) => {
        const parsed = parseCollaborationId(attachmentId, "attachment_id_invalid");
        return parsed.ok ? [parsed.value] : [];
      })
    : [];
  return {
    ...(links.length ? { links } : {}),
    ...(attachmentIds.length ? { attachmentIds } : {})
  };
}

function parseMessageLinkEntityType(value: unknown) {
  const allowed = [
    "project",
    "task",
    "opportunity",
    "kpi_signal",
    "corrective_action",
    "control_action"
  ] as const;
  if (typeof value === "string" && allowed.includes(value as never)) {
    return { ok: true as const, value };
  }
  return { ok: false as const, error: "link_entity_type_invalid" };
}

async function validateTenantUserIds(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  userIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return { ok: true };
  const tenantUsers = await dataSource.listUsersByTenantId(tenantId);
  const existing = new Set(tenantUsers.map((user) => user.id));
  return uniqueIds.every((userId) => existing.has(userId))
    ? { ok: true }
    : { ok: false, error: "tenant_user_not_found" };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requireMethod<T extends (...args: never[]) => unknown>(method: T | undefined): T {
  if (!method) throw new Error("collaboration_not_configured");
  return method;
}

function trimNotificationBody(body: string) {
  return body.length > 180 ? `${body.slice(0, 177)}...` : body;
}

function routeForEntity(entity: EntityAccessContext) {
  if (entity.entityType === "project") return `/projects/${entity.entityId}`;
  if (entity.entityType === "task") return `/tasks/${entity.entityId}`;
  if (entity.entityType === "opportunity") return `/crm/opportunities/${entity.entityId}`;
  if (entity.entityType === "client") return `/clients/${entity.entityId}`;
  if (entity.entityType === "contact") return `/contacts/${entity.entityId}`;
  if (entity.entityType === "product") return `/products/${entity.entityId}`;
  return `/communication-channels/${entity.entityId}`;
}

async function appendDeniedAudit(
  deps: CollaborationRouteDeps,
  input: {
    actionType: string;
    actor: TenantUser;
    sourceEntity: { type: string; id: string };
    commandInput: Record<string, unknown>;
    permissionResult: Record<string, unknown>;
  }
) {
  await deps.appendManagementAuditEvent(collaborationAudit({
    ...input,
    executionResult: { status: "denied" }
  }));
}

function collaborationAudit(input: {
  actionType: string;
  actor: TenantUser;
  sourceEntity: { type: string; id: string };
  commandInput: Record<string, unknown>;
  permissionResult: Record<string, unknown>;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  executionResult?: Record<string, unknown>;
}): ManagementAuditEventInput {
  const auditInput: ManagementAuditEventInput = {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "collaboration",
    sourceEntity: input.sourceEntity,
    commandInput: input.commandInput,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    permissionResult: input.permissionResult
  };
  if (input.executionResult !== undefined) {
    auditInput.executionResult = input.executionResult;
  }
  return auditInput;
}

function serializeConversation(conversation: Conversation) {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    archivedAt: conversation.archivedAt?.toISOString() ?? null
  };
}

function serializeMessage(message: import("@kiss-pm/domain").DiscussionMessage) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    archivedAt: message.archivedAt?.toISOString() ?? null,
    pinnedAt: message.pinnedAt?.toISOString() ?? null
  };
}

function serializeMessageWithExtras(
  message: import("@kiss-pm/domain").DiscussionMessage,
  extras: {
    reactions: import("@kiss-pm/domain").MessageReaction[];
    stickers: import("@kiss-pm/domain").MessageSticker[];
  }
) {
  return {
    ...serializeMessage(message),
    reactions: extras.reactions.map(serializeReaction),
    stickers: extras.stickers.map(serializeMessageSticker)
  };
}

function serializeNotification(notification: import("@kiss-pm/domain").UserNotification) {
  return {
    ...notification,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
    archivedAt: notification.archivedAt?.toISOString() ?? null
  };
}

function serializeReaction(reaction: import("@kiss-pm/domain").MessageReaction) {
  return {
    ...reaction,
    createdAt: reaction.createdAt.toISOString(),
    archivedAt: reaction.archivedAt?.toISOString() ?? null
  };
}

function serializeMessageSticker(sticker: import("@kiss-pm/domain").MessageSticker) {
  return {
    ...sticker,
    createdAt: sticker.createdAt.toISOString()
  };
}

function serializeMeeting(meeting: Meeting) {
  return {
    ...meeting,
    scheduledStart: meeting.scheduledStart.toISOString(),
    scheduledFinish: meeting.scheduledFinish.toISOString(),
    createdAt: meeting.createdAt.toISOString(),
    archivedAt: meeting.archivedAt?.toISOString() ?? null
  };
}

function serializeMeetingExternalLink(link: import("@kiss-pm/domain").MeetingExternalLink) {
  return {
    ...link,
    createdAt: link.createdAt.toISOString(),
    archivedAt: link.archivedAt?.toISOString() ?? null
  };
}

function serializeMeetingNote(note: import("@kiss-pm/domain").MeetingNote) {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
    editedAt: note.editedAt?.toISOString() ?? null,
    archivedAt: note.archivedAt?.toISOString() ?? null
  };
}

function serializeMeetingActionItem(actionItem: import("@kiss-pm/domain").MeetingActionItem) {
  return {
    ...actionItem,
    createdAt: actionItem.createdAt.toISOString(),
    archivedAt: actionItem.archivedAt?.toISOString() ?? null
  };
}
