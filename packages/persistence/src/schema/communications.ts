import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  check,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { entityAttachments, fileAssets } from "./attachments";
import { tenantUsers, tenants } from "./core";

export const communicationChannels = pgTable(
  "communication_channels",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    channelType: text("channel_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    scopeEntityType: text("scope_entity_type"),
    scopeEntityId: text("scope_entity_id"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "communication_channels_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "communication_channels_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    uniqueIndex("communication_channels_workspace_general_uidx")
      .on(table.tenantId, table.channelType)
      .where(sql`${table.channelType} = 'workspace_general' and ${table.archivedAt} is null`),
    index("communication_channels_tenant_type_idx").on(
      table.tenantId,
      table.channelType,
      table.createdAt
    ),
    check(
      "communication_channels_type_chk",
      sql`${table.channelType} in ('workspace_general', 'team', 'project_general', 'custom')`
    ),
    check(
      "communication_channels_scope_type_chk",
      sql`${table.scopeEntityType} is null or ${table.scopeEntityType} in ('project', 'org_unit')`
    ),
    check(
      "communication_channels_scope_chk",
      sql`(
        (${table.channelType} in ('team', 'project_general') and ${table.scopeEntityType} is not null and ${table.scopeEntityId} is not null)
        or
        (${table.channelType} not in ('team', 'project_general'))
      )`
    )
  ]
);

export const communicationChannelMembers = pgTable(
  "communication_channel_members",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "communication_channel_members_pkey",
      columns: [table.tenantId, table.channelId, table.userId]
    }),
    foreignKey({
      name: "communication_channel_members_channel_fk",
      columns: [table.tenantId, table.channelId],
      foreignColumns: [communicationChannels.tenantId, communicationChannels.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "communication_channel_members_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "communication_channel_members_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("communication_channel_members_tenant_user_idx").on(table.tenantId, table.userId),
    check("communication_channel_members_role_chk", sql`${table.role} in ('owner', 'moderator', 'member')`)
  ]
);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    conversationType: text("conversation_type").notNull(),
    title: text("title").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "conversations_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "conversations_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    uniqueIndex("conversations_tenant_entity_type_uidx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.conversationType
    ),
    index("conversations_tenant_entity_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId
    ),
    check(
      "conversations_entity_type_chk",
      sql`${table.entityType} in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel', 'direct', 'agent')`
    ),
    check("conversations_type_chk", sql`${table.conversationType} in ('default', 'meeting_followup', 'direct', 'agent')`)
  ]
);

// Участники беседы (P4.2 DM): явное членство для прямых сообщений. Доступ к direct-беседе
// определяется наличием строки здесь (а не правами на сущность). Сущностные беседы членство
// не используют — доступ к ним остаётся по правам на entity.

export const conversationMembers = pgTable(
  "conversation_members",
  {
    tenantId: text("tenant_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "conversation_members_pkey",
      columns: [table.tenantId, table.conversationId, table.userId]
    }),
    index("conversation_members_user_idx").on(table.tenantId, table.userId),
    foreignKey({
      name: "conversation_members_conversation_fk",
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [conversations.tenantId, conversations.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "conversation_members_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade")
  ]
);

export const discussionMessages = pgTable(
  "discussion_messages",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    pinnedByUserId: text("pinned_by_user_id")
  },
  (table) => [
    primaryKey({
      name: "discussion_messages_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "discussion_messages_conversation_fk",
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [conversations.tenantId, conversations.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "discussion_messages_author_fk",
      columns: [table.tenantId, table.authorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "discussion_messages_pinned_by_fk",
      columns: [table.tenantId, table.pinnedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("discussion_messages_tenant_conversation_created_idx").on(
      table.tenantId,
      table.conversationId,
      table.createdAt,
      table.id
    )
  ]
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    userId: text("user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "message_reactions_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "message_reactions_message_fk",
      columns: [table.tenantId, table.messageId],
      foreignColumns: [discussionMessages.tenantId, discussionMessages.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "message_reactions_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    uniqueIndex("message_reactions_active_uidx")
      .on(table.tenantId, table.messageId, table.userId, table.emoji)
      .where(sql`${table.archivedAt} is null`),
    index("message_reactions_tenant_message_idx").on(table.tenantId, table.messageId)
  ]
);

export const stickerPacks = pgTable(
  "sticker_packs",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "sticker_packs_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "sticker_packs_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("sticker_packs_tenant_created_idx").on(table.tenantId, table.createdAt),
    check(
      "sticker_packs_source_chk",
      sql`${table.source} in ('manual_upload', 'telegram_export', 'other_import')`
    ),
    check("sticker_packs_status_chk", sql`${table.status} in ('ready', 'archived')`)
  ]
);

export const stickerAssets = pgTable(
  "sticker_assets",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    packId: text("pack_id").notNull(),
    fileAssetId: text("file_asset_id").notNull(),
    emoji: text("emoji").notNull(),
    title: text("title").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "sticker_assets_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "sticker_assets_pack_fk",
      columns: [table.tenantId, table.packId],
      foreignColumns: [stickerPacks.tenantId, stickerPacks.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "sticker_assets_file_asset_fk",
      columns: [table.tenantId, table.fileAssetId],
      foreignColumns: [fileAssets.tenantId, fileAssets.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "sticker_assets_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("sticker_assets_tenant_pack_idx").on(table.tenantId, table.packId),
    check("sticker_assets_mime_chk", sql`${table.mimeType} in ('image/png', 'image/webp')`),
    check("sticker_assets_status_chk", sql`${table.status} in ('pending', 'ready', 'archived', 'failed')`),
    check("sticker_assets_size_chk", sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= ${2 * 1024 * 1024}`),
    check("sticker_assets_dimensions_chk", sql`${table.width} between 64 and 512 and ${table.height} between 64 and 512`)
  ]
);

export const messageStickers = pgTable(
  "message_stickers",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    stickerAssetId: text("sticker_asset_id").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "message_stickers_pkey",
      columns: [table.tenantId, table.messageId]
    }),
    foreignKey({
      name: "message_stickers_message_fk",
      columns: [table.tenantId, table.messageId],
      foreignColumns: [discussionMessages.tenantId, discussionMessages.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "message_stickers_sticker_fk",
      columns: [table.tenantId, table.stickerAssetId],
      foreignColumns: [stickerAssets.tenantId, stickerAssets.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "message_stickers_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("message_stickers_tenant_sticker_idx").on(table.tenantId, table.stickerAssetId)
  ]
);

export const messageMentions = pgTable(
  "message_mentions",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    mentionedUserId: text("mentioned_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "message_mentions_pkey",
      columns: [table.tenantId, table.messageId, table.mentionedUserId]
    }),
    foreignKey({
      name: "message_mentions_message_fk",
      columns: [table.tenantId, table.messageId],
      foreignColumns: [discussionMessages.tenantId, discussionMessages.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "message_mentions_user_fk",
      columns: [table.tenantId, table.mentionedUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("message_mentions_tenant_user_created_idx").on(
      table.tenantId,
      table.mentionedUserId,
      table.createdAt
    )
  ]
);

export const conversationReadStates = pgTable(
  "conversation_read_states",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id").notNull(),
    lastReadMessageId: text("last_read_message_id"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull()
  },
  (table) => [
    primaryKey({
      name: "conversation_read_states_pkey",
      columns: [table.tenantId, table.conversationId, table.userId]
    }),
    foreignKey({
      name: "conversation_read_states_conversation_fk",
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [conversations.tenantId, conversations.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "conversation_read_states_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    check("conversation_read_states_unread_chk", sql`${table.unreadCount} >= 0`)
  ]
);

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    notificationType: text("notification_type").notNull(),
    sourceEntityType: text("source_entity_type").notNull(),
    sourceEntityId: text("source_entity_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    route: text("route").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "user_notifications_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "user_notifications_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    index("user_notifications_tenant_user_created_idx").on(
      table.tenantId,
      table.userId,
      table.createdAt
    ),
    index("user_notifications_tenant_user_unread_idx").on(
      table.tenantId,
      table.userId,
      table.readAt
    ),
    check(
      "user_notifications_type_chk",
      sql`${table.notificationType} in ('mention', 'assignment_changed', 'deadline_risk', 'control_signal', 'meeting_invite', 'meeting_action_item')`
    )
  ]
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    channel: text("channel").notNull(),
    notificationType: text("notification_type").notNull(),
    enabled: boolean("enabled").notNull(),
    digestFrequency: text("digest_frequency").notNull()
  },
  (table) => [
    primaryKey({
      name: "notification_preferences_pkey",
      columns: [table.tenantId, table.userId, table.channel, table.notificationType]
    }),
    foreignKey({
      name: "notification_preferences_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    check("notification_preferences_channel_chk", sql`${table.channel} in ('in_app', 'email', 'digest')`),
    check(
      "notification_preferences_type_chk",
      sql`${table.notificationType} in ('mention', 'assignment_changed', 'deadline_risk', 'control_signal', 'meeting_invite', 'meeting_action_item')`
    ),
    check("notification_preferences_digest_chk", sql`${table.digestFrequency} in ('none', 'daily', 'weekly')`)
  ]
);

export const meetings = pgTable(
  "meetings",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    agenda: text("agenda").notNull(),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    scheduledFinish: timestamp("scheduled_finish", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "meetings_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "meetings_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("meetings_tenant_entity_start_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.scheduledStart
    ),
    check(
      "meetings_entity_type_chk",
      sql`${table.entityType} in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel')`
    ),
    check("meetings_status_chk", sql`${table.status} in ('scheduled', 'completed', 'cancelled')`),
    check("meetings_schedule_chk", sql`${table.scheduledFinish} > ${table.scheduledStart}`)
  ]
);

export const meetingParticipants = pgTable(
  "meeting_participants",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    response: text("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "meeting_participants_pkey",
      columns: [table.tenantId, table.meetingId, table.userId]
    }),
    foreignKey({
      name: "meeting_participants_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "meeting_participants_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    check("meeting_participants_role_chk", sql`${table.role} in ('organizer', 'required', 'optional')`),
    check("meeting_participants_response_chk", sql`${table.response} in ('pending', 'accepted', 'declined')`)
  ]
);

export const meetingExternalLinks = pgTable(
  "meeting_external_links",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").notNull(),
    provider: text("provider").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "meeting_external_links_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "meeting_external_links_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "meeting_external_links_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("meeting_external_links_tenant_meeting_idx").on(table.tenantId, table.meetingId),
    check(
      "meeting_external_links_provider_chk",
      sql`${table.provider} in ('zoom', 'teams', 'google_meet', 'manual_link', 'other')`
    )
  ]
);

export const meetingNotes = pgTable(
  "meeting_notes",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "meeting_notes_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "meeting_notes_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "meeting_notes_author_fk",
      columns: [table.tenantId, table.authorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("meeting_notes_tenant_meeting_created_idx").on(
      table.tenantId,
      table.meetingId,
      table.createdAt
    )
  ]
);

export const meetingActionItems = pgTable(
  "meeting_action_items",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").notNull(),
    title: text("title").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    dueDate: text("due_date"),
    targetEntityType: text("target_entity_type").notNull(),
    targetEntityId: text("target_entity_id").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "meeting_action_items_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "meeting_action_items_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "meeting_action_items_owner_fk",
      columns: [table.tenantId, table.ownerUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "meeting_action_items_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("meeting_action_items_tenant_meeting_created_idx").on(
      table.tenantId,
      table.meetingId,
      table.createdAt
    ),
    check(
      "meeting_action_items_target_type_chk",
      sql`${table.targetEntityType} in ('task', 'corrective_action', 'project', 'opportunity')`
    ),
    check("meeting_action_items_status_chk", sql`${table.status} in ('open', 'done', 'cancelled')`)
  ]
);

export const callRooms = pgTable(
  "call_rooms",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    meetingId: text("meeting_id"),
    title: text("title").notNull(),
    mediaKind: text("media_kind").notNull(),
    provider: text("provider").notNull(),
    providerRoomId: text("provider_room_id").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "call_rooms_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "call_rooms_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "call_rooms_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("call_rooms_tenant_entity_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    uniqueIndex("call_rooms_tenant_provider_room_uidx").on(
      table.tenantId,
      table.provider,
      table.providerRoomId
    ),
    check(
      "call_rooms_entity_type_chk",
      sql`${table.entityType} in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel')`
    ),
    check("call_rooms_media_kind_chk", sql`${table.mediaKind} in ('audio', 'video')`),
    check("call_rooms_provider_chk", sql`${table.provider} in ('manual', 'jitsi', 'livekit')`),
    check(
      "call_rooms_status_chk",
      sql`${table.status} in ('scheduled', 'open', 'active', 'ended', 'cancelled')`
    )
  ]
);

export const callSessions = pgTable(
  "call_sessions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    providerSessionId: text("provider_session_id"),
    status: text("status").notNull(),
    startedByUserId: text("started_by_user_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedByUserId: text("ended_by_user_id"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    failureReason: text("failure_reason")
  },
  (table) => [
    primaryKey({
      name: "call_sessions_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "call_sessions_room_fk",
      columns: [table.tenantId, table.roomId],
      foreignColumns: [callRooms.tenantId, callRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_sessions_started_by_fk",
      columns: [table.tenantId, table.startedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "call_sessions_ended_by_fk",
      columns: [table.tenantId, table.endedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("call_sessions_tenant_room_started_idx").on(
      table.tenantId,
      table.roomId,
      table.startedAt
    ),
    uniqueIndex("call_sessions_tenant_room_id_uidx").on(
      table.tenantId,
      table.roomId,
      table.id
    ),
    uniqueIndex("call_sessions_one_active_per_room_uidx")
      .on(table.tenantId, table.roomId)
      .where(sql`${table.status} = 'active'`),
    check("call_sessions_status_chk", sql`${table.status} in ('active', 'ended', 'failed')`),
    check(
      "call_sessions_end_chk",
      sql`(
        (${table.status} = 'active' and ${table.endedAt} is null)
        or
        (${table.status} <> 'active' and ${table.endedAt} is not null)
      )`
    )
  ]
);

export const callParticipantStates = pgTable(
  "call_participant_states",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    sessionId: text("session_id").notNull(),
    userId: text("user_id").notNull(),
    state: text("state").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "call_participant_states_pkey",
      columns: [table.tenantId, table.roomId, table.sessionId, table.userId]
    }),
    foreignKey({
      name: "call_participant_states_session_fk",
      columns: [table.tenantId, table.roomId, table.sessionId],
      foreignColumns: [callSessions.tenantId, callSessions.roomId, callSessions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_participant_states_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    check(
      "call_participant_states_state_chk",
      sql`${table.state} in ('invited', 'joining', 'joined', 'left', 'removed')`
    )
  ]
);

export const callEvents = pgTable(
  "call_events",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    sessionId: text("session_id"),
    eventType: text("event_type").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "call_events_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "call_events_room_fk",
      columns: [table.tenantId, table.roomId],
      foreignColumns: [callRooms.tenantId, callRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_events_session_fk",
      columns: [table.tenantId, table.roomId, table.sessionId],
      foreignColumns: [callSessions.tenantId, callSessions.roomId, callSessions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_events_actor_fk",
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("call_events_tenant_room_created_idx").on(
      table.tenantId,
      table.roomId,
      table.createdAt,
      table.id
    ),
    check(
      "call_events_type_chk",
      sql`${table.eventType} in ('room_created', 'session_started', 'join_token_issued', 'participant_invited', 'participant_joining', 'participant_joined', 'participant_left', 'session_ended', 'recording_attached', 'recording_started', 'recording_track_completed', 'recording_completed', 'recording_failed')`
    )
  ]
);

export const callRecordings = pgTable(
  "call_recordings",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    sessionId: text("session_id"),
    recordingGroupId: text("recording_group_id").notNull(),
    attachmentId: text("attachment_id"),
    egressId: text("egress_id"),
    participantId: text("participant_id"),
    trackId: text("track_id"),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    durationSeconds: integer("duration_seconds"),
    title: text("title").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "call_recordings_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "call_recordings_room_fk",
      columns: [table.tenantId, table.roomId],
      foreignColumns: [callRooms.tenantId, callRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_recordings_session_fk",
      columns: [table.tenantId, table.roomId, table.sessionId],
      foreignColumns: [callSessions.tenantId, callSessions.roomId, callSessions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_recordings_attachment_fk",
      columns: [table.tenantId, table.attachmentId],
      foreignColumns: [entityAttachments.tenantId, entityAttachments.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "call_recordings_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("call_recordings_tenant_room_created_idx").on(
      table.tenantId,
      table.roomId,
      table.createdAt
    ),
    index("call_recordings_tenant_group_idx").on(table.tenantId, table.recordingGroupId),
    uniqueIndex("call_recordings_tenant_egress_uidx")
      .on(table.tenantId, table.egressId)
      .where(sql`${table.egressId} is not null`),
    check("call_recordings_kind_chk", sql`${table.kind} in ('audio', 'video', 'composed')`),
    check(
      "call_recordings_status_chk",
      sql`${table.status} in ('starting', 'recording', 'ready', 'failed')`
    ),
    check(
      "call_recordings_ready_attachment_chk",
      sql`((${table.status} = 'ready' and ${table.attachmentId} is not null) or (${table.status} <> 'ready'))`
    )
  ]
);
