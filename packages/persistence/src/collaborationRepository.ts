import { and, asc, count, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";

import type {
  CallEvent,
  CallEventType,
  CallMediaKind,
  CallParticipantState,
  CallParticipantStateValue,
  CallRecording,
  CallRoom,
  CallRoomProvider,
  CallRoomStatus,
  CallSession,
  CallSessionStatus,
  CommunicationChannel,
  CommunicationChannelMember,
  CommunicationChannelRole,
  CommunicationChannelType,
  CollaborationEntityType,
  Conversation,
  ConversationReadState,
  ConversationType,
  DigestFrequency,
  DiscussionMessage,
  Meeting,
  MeetingActionItem,
  MeetingActionItemStatus,
  MeetingActionTargetType,
  MeetingExternalLink,
  MeetingExternalLinkProvider,
  MeetingNote,
  MeetingParticipant,
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MessageMention,
  MessageReaction,
  MessageSticker,
  NotificationChannel,
  NotificationPreference,
  NotificationType,
  StickerAsset,
  StickerMimeType,
  StickerPack,
  StickerPackSource,
  StickerStatus,
  UserNotification,
  TenantId,
  UserId
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  callEvents,
  callParticipantStates,
  callRecordings,
  callRooms,
  callSessions,
  communicationChannelMembers,
  communicationChannels,
  conversationMembers,
  conversationReadStates,
  conversations,
  discussionMessages,
  meetingActionItems,
  meetingExternalLinks,
  meetingNotes,
  meetingParticipants,
  meetings,
  messageMentions,
  messageReactions,
  messageStickers,
  notificationPreferences,
  stickerAssets,
  stickerPacks,
  userNotifications
} from "./schema";

export type CommunicationChannelInput = Omit<
  CommunicationChannel,
  "createdAt" | "updatedAt" | "archivedAt"
>;
export type CommunicationChannelMemberInput = Omit<
  CommunicationChannelMember,
  "createdAt" | "archivedAt"
>;
export type ConversationInput = Omit<Conversation, "createdAt" | "archivedAt">;
export type DiscussionMessageInput = Omit<
  DiscussionMessage,
  "createdAt" | "editedAt" | "archivedAt" | "pinnedAt" | "pinnedByUserId"
>;
export type MessageReactionInput = Omit<MessageReaction, "createdAt" | "archivedAt">;
export type StickerPackInput = Omit<StickerPack, "createdAt" | "archivedAt">;
export type StickerAssetInput = Omit<StickerAsset, "createdAt" | "archivedAt">;
export type MessageStickerInput = Omit<MessageSticker, "createdAt">;
export type UserNotificationInput = Omit<
  UserNotification,
  "createdAt" | "readAt" | "archivedAt"
>;
export type MeetingInput = Omit<Meeting, "createdAt" | "archivedAt">;
export type MeetingExternalLinkInput = Omit<
  MeetingExternalLink,
  "createdAt" | "archivedAt"
>;
export type MeetingNoteInput = Omit<MeetingNote, "createdAt" | "editedAt" | "archivedAt">;
export type MeetingActionItemInput = Omit<MeetingActionItem, "createdAt" | "archivedAt">;
export type CallRoomInput = Omit<CallRoom, "createdAt" | "updatedAt" | "archivedAt">;
export type CallSessionInput = Omit<
  CallSession,
  "startedAt" | "endedByUserId" | "endedAt" | "failureReason"
>;
export type CallParticipantStateInput = Omit<
  CallParticipantState,
  "joinedAt" | "leftAt" | "lastSeenAt"
>;
export type CallEventInput = Omit<CallEvent, "createdAt">;
export type CallRecordingInput = Omit<CallRecording, "createdAt" | "archivedAt">;

export type CollaborationRepository = {
  ensureWorkspaceGeneralChannel(input: {
    tenantId: TenantId;
    createdByUserId: UserId;
    title?: string;
  }): Promise<CommunicationChannel>;
  createCommunicationChannel(input: CommunicationChannelInput): Promise<CommunicationChannel>;
  updateCommunicationChannel(input: {
    tenantId: TenantId;
    channelId: string;
    title?: string;
    description?: string;
  }): Promise<CommunicationChannel | undefined>;
  archiveCommunicationChannel(input: {
    tenantId: TenantId;
    channelId: string;
  }): Promise<CommunicationChannel | undefined>;
  findCommunicationChannel(
    tenantId: TenantId,
    channelId: string
  ): Promise<CommunicationChannel | undefined>;
  listCommunicationChannels(input: {
    tenantId: TenantId;
    channelType?: CommunicationChannelType;
  }): Promise<CommunicationChannel[]>;
  upsertCommunicationChannelMember(
    input: CommunicationChannelMemberInput
  ): Promise<CommunicationChannelMember>;
  archiveCommunicationChannelMember(input: {
    tenantId: TenantId;
    channelId: string;
    userId: UserId;
  }): Promise<CommunicationChannelMember | undefined>;
  listCommunicationChannelMembers(input: {
    tenantId: TenantId;
    channelId: string;
  }): Promise<CommunicationChannelMember[]>;
  ensureConversation(input: ConversationInput): Promise<Conversation>;
  findConversation(tenantId: TenantId, conversationId: string): Promise<Conversation | undefined>;
  listConversationsByEntity(input: {
    tenantId: TenantId;
    entityType: CollaborationEntityType;
    entityId: string;
  }): Promise<Conversation[]>;
  addConversationMembers(input: { tenantId: TenantId; conversationId: string; userIds: string[] }): Promise<void>;
  isConversationMember(tenantId: TenantId, conversationId: string, userId: UserId): Promise<boolean>;
  listConversationMemberIds(tenantId: TenantId, conversationId: string): Promise<string[]>;
  listDirectConversationsForUser(tenantId: TenantId, userId: UserId): Promise<Conversation[]>;
  createDiscussionMessage(input: DiscussionMessageInput): Promise<DiscussionMessage>;
  listDiscussionMessages(input: {
    tenantId: TenantId;
    conversationId: string;
    limit: number;
    cursor?: string;
  }): Promise<DiscussionMessage[]>;
  findDiscussionMessage(
    tenantId: TenantId,
    messageId: string
  ): Promise<DiscussionMessage | undefined>;
  updateDiscussionMessage(input: {
    tenantId: TenantId;
    messageId: string;
    body: string;
    metadata: Record<string, unknown>;
  }): Promise<DiscussionMessage | undefined>;
  archiveDiscussionMessage(input: {
    tenantId: TenantId;
    messageId: string;
  }): Promise<DiscussionMessage | undefined>;
  pinDiscussionMessage(input: {
    tenantId: TenantId;
    messageId: string;
    pinnedByUserId: UserId;
  }): Promise<DiscussionMessage | undefined>;
  unpinDiscussionMessage(input: {
    tenantId: TenantId;
    messageId: string;
  }): Promise<DiscussionMessage | undefined>;
  replaceMessageMentions(input: {
    tenantId: TenantId;
    messageId: string;
    mentionedUserIds: UserId[];
  }): Promise<MessageMention[]>;
  listMessageMentions(tenantId: TenantId, messageId: string): Promise<MessageMention[]>;
  upsertMessageReaction(input: MessageReactionInput): Promise<MessageReaction>;
  archiveMessageReaction(input: {
    tenantId: TenantId;
    messageId: string;
    reactionId: string;
    userId: UserId;
  }): Promise<MessageReaction | undefined>;
  listMessageReactionsByMessageIds(input: {
    tenantId: TenantId;
    messageIds: string[];
  }): Promise<MessageReaction[]>;
  createStickerPack(input: StickerPackInput): Promise<StickerPack>;
  archiveStickerPack(input: {
    tenantId: TenantId;
    packId: string;
  }): Promise<StickerPack | undefined>;
  listStickerPacks(tenantId: TenantId): Promise<StickerPack[]>;
  createStickerAsset(input: StickerAssetInput): Promise<StickerAsset>;
  findStickerAsset(
    tenantId: TenantId,
    stickerAssetId: string
  ): Promise<StickerAsset | undefined>;
  archiveStickerAsset(input: {
    tenantId: TenantId;
    stickerAssetId: string;
  }): Promise<StickerAsset | undefined>;
  listStickerAssets(input: {
    tenantId: TenantId;
    packId: string;
  }): Promise<StickerAsset[]>;
  createMessageSticker(input: MessageStickerInput): Promise<MessageSticker>;
  listMessageStickersByMessageIds(input: {
    tenantId: TenantId;
    messageIds: string[];
  }): Promise<MessageSticker[]>;
  getConversationReadState(input: {
    tenantId: TenantId;
    conversationId: string;
    userId: UserId;
  }): Promise<ConversationReadState>;
  markConversationRead(input: {
    tenantId: TenantId;
    conversationId: string;
    userId: UserId;
  }): Promise<ConversationReadState>;
  countUnreadConversationMessagesForUser(input: { tenantId: TenantId; userId: UserId }): Promise<number>;
  createUserNotification(input: UserNotificationInput): Promise<UserNotification>;
  listUserNotifications(input: {
    tenantId: TenantId;
    userId: UserId;
    status?: "unread" | "read";
    limit: number;
  }): Promise<UserNotification[]>;
  markUserNotificationRead(input: {
    tenantId: TenantId;
    notificationId: string;
    userId: UserId;
  }): Promise<UserNotification | undefined>;
  listNotificationPreferences(
    tenantId: TenantId,
    userId: UserId
  ): Promise<NotificationPreference[]>;
  upsertNotificationPreferences(input: NotificationPreference[]): Promise<NotificationPreference[]>;
  createMeeting(input: MeetingInput): Promise<Meeting>;
  updateMeeting(input: {
    tenantId: TenantId;
    meetingId: string;
    title: string;
    agenda: string;
    scheduledStart: Date;
    scheduledFinish: Date;
    status: MeetingStatus;
  }): Promise<Meeting | undefined>;
  findMeeting(tenantId: TenantId, meetingId: string): Promise<Meeting | undefined>;
  listMeetingsByEntity(input: {
    tenantId: TenantId;
    entityType: CollaborationEntityType;
    entityId: string;
  }): Promise<Meeting[]>;
  replaceMeetingParticipants(input: {
    tenantId: TenantId;
    meetingId: string;
    participants: Array<{
      userId: UserId;
      role: MeetingParticipantRole;
      response: MeetingParticipantResponse;
    }>;
  }): Promise<MeetingParticipant[]>;
  listMeetingParticipants(tenantId: TenantId, meetingId: string): Promise<MeetingParticipant[]>;
  createMeetingExternalLink(input: MeetingExternalLinkInput): Promise<MeetingExternalLink>;
  listMeetingExternalLinks(tenantId: TenantId, meetingId: string): Promise<MeetingExternalLink[]>;
  createMeetingNote(input: MeetingNoteInput): Promise<MeetingNote>;
  listMeetingNotes(tenantId: TenantId, meetingId: string): Promise<MeetingNote[]>;
  createMeetingActionItem(input: MeetingActionItemInput): Promise<MeetingActionItem>;
  listMeetingActionItems(tenantId: TenantId, meetingId: string): Promise<MeetingActionItem[]>;
  updateMeetingActionItem(input: {
    tenantId: TenantId;
    meetingId: string;
    actionItemId: string;
    status: MeetingActionItemStatus;
  }): Promise<MeetingActionItem | undefined>;
  createCallRoom(input: CallRoomInput): Promise<CallRoom>;
  findCallRoom(tenantId: TenantId, roomId: string): Promise<CallRoom | undefined>;
  listCallRoomsByEntity(input: {
    tenantId: TenantId;
    entityType: CollaborationEntityType;
    entityId: string;
  }): Promise<CallRoom[]>;
  updateCallRoomStatus(input: {
    tenantId: TenantId;
    roomId: string;
    status: CallRoomStatus;
  }): Promise<CallRoom | undefined>;
  createCallSession(input: CallSessionInput): Promise<CallSession>;
  findCallSession(
    tenantId: TenantId,
    sessionId: string
  ): Promise<CallSession | undefined>;
  findActiveCallSessionForUpdate(input: {
    tenantId: TenantId;
    roomId: string;
    sessionId: string;
  }): Promise<CallSession | undefined>;
  findActiveCallSessionByRoom(input: {
    tenantId: TenantId;
    roomId: string;
  }): Promise<CallSession | undefined>;
  endCallSession(input: {
    tenantId: TenantId;
    sessionId: string;
    endedByUserId: UserId;
    status: Exclude<CallSessionStatus, "active">;
    failureReason?: string | null;
  }): Promise<CallSession | undefined>;
  upsertCallParticipantState(
    input: CallParticipantStateInput
  ): Promise<CallParticipantState>;
  listCallParticipantStates(input: {
    tenantId: TenantId;
    roomId: string;
    sessionId: string;
  }): Promise<CallParticipantState[]>;
  createCallEvent(input: CallEventInput): Promise<CallEvent>;
  listCallEvents(input: {
    tenantId: TenantId;
    roomId: string;
    limit: number;
  }): Promise<CallEvent[]>;
  createCallRecording(input: CallRecordingInput): Promise<CallRecording>;
  listCallRecordings(input: {
    tenantId: TenantId;
    roomId: string;
  }): Promise<CallRecording[]>;
  findCallRecordingByEgressId(input: {
    tenantId: TenantId;
    egressId: string;
  }): Promise<CallRecording | undefined>;
  listCallRecordingsByGroup(input: {
    tenantId: TenantId;
    recordingGroupId: string;
  }): Promise<CallRecording[]>;
  updateCallRecordingByEgress(input: {
    tenantId: TenantId;
    egressId: string;
    status: CallRecording["status"];
    attachmentId?: string | null;
    durationSeconds?: number | null;
    endedAt?: Date | null;
  }): Promise<CallRecording | undefined>;
  failStaleInProgressRecordings(input: {
    tenantId: TenantId;
    olderThan: Date;
  }): Promise<CallRecording[]>;
};

export function createCollaborationRepository(db: KissPmDatabase): CollaborationRepository {
  async function findActiveMessageReaction(
    input: Pick<MessageReaction, "tenantId" | "messageId" | "userId" | "emoji">
  ): Promise<MessageReaction | undefined> {
    const [row] = await db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.tenantId, input.tenantId),
          eq(messageReactions.messageId, input.messageId),
          eq(messageReactions.userId, input.userId),
          eq(messageReactions.emoji, input.emoji),
          isNull(messageReactions.archivedAt)
        )
      )
      .limit(1);
    return row ? mapMessageReaction(row) : undefined;
  }

  return {
    async ensureWorkspaceGeneralChannel(input) {
      const now = new Date();
      await db
        .insert(communicationChannels)
        .values({
          id: "channel-workspace-general",
          tenantId: input.tenantId,
          channelType: "workspace_general",
          title: input.title ?? "Общий чат",
          description: "",
          scopeEntityType: null,
          scopeEntityId: null,
          createdByUserId: input.createdByUserId,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoNothing({
          target: [communicationChannels.tenantId, communicationChannels.channelType],
          where: sql`${communicationChannels.channelType} = 'workspace_general' and ${communicationChannels.archivedAt} is null`
        });

      const [row] = await db
        .select()
        .from(communicationChannels)
        .where(
          and(
            eq(communicationChannels.tenantId, input.tenantId),
            eq(communicationChannels.channelType, "workspace_general"),
            isNull(communicationChannels.archivedAt)
          )
        )
        .limit(1);
      if (!row) throw new Error("Workspace general channel upsert returned no row");
      return mapCommunicationChannel(row);
    },
    async createCommunicationChannel(input) {
      const now = new Date();
      const [row] = await db
        .insert(communicationChannels)
        .values({
          ...input,
          createdAt: now,
          updatedAt: now
        })
        .returning();
      if (!row) throw new Error("Communication channel insert returned no row");
      return mapCommunicationChannel(row);
    },
    async updateCommunicationChannel(input) {
      const updates: Partial<typeof communicationChannels.$inferInsert> = {
        updatedAt: new Date()
      };
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      const [row] = await db
        .update(communicationChannels)
        .set(updates)
        .where(
          and(
            eq(communicationChannels.tenantId, input.tenantId),
            eq(communicationChannels.id, input.channelId),
            isNull(communicationChannels.archivedAt)
          )
        )
        .returning();
      return row ? mapCommunicationChannel(row) : undefined;
    },
    async archiveCommunicationChannel(input) {
      // Мягкое удаление: archivedAt скрывает канал из listCommunicationChannels.
      // Системный workspace_general не архивируется (guard на уровне роута и здесь).
      const [row] = await db
        .update(communicationChannels)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(communicationChannels.tenantId, input.tenantId),
            eq(communicationChannels.id, input.channelId),
            isNull(communicationChannels.archivedAt),
            sql`${communicationChannels.channelType} <> 'workspace_general'`
          )
        )
        .returning();
      return row ? mapCommunicationChannel(row) : undefined;
    },
    async findCommunicationChannel(tenantId, channelId) {
      const [row] = await db
        .select()
        .from(communicationChannels)
        .where(
          and(
            eq(communicationChannels.tenantId, tenantId),
            eq(communicationChannels.id, channelId),
            isNull(communicationChannels.archivedAt)
          )
        )
        .limit(1);
      return row ? mapCommunicationChannel(row) : undefined;
    },
    async listCommunicationChannels(input) {
      const rows = await db
        .select()
        .from(communicationChannels)
        .where(
          and(
            eq(communicationChannels.tenantId, input.tenantId),
            input.channelType ? eq(communicationChannels.channelType, input.channelType) : sql`true`,
            isNull(communicationChannels.archivedAt)
          )
        )
        .orderBy(asc(communicationChannels.channelType), asc(communicationChannels.createdAt));
      return rows.map(mapCommunicationChannel);
    },
    async upsertCommunicationChannelMember(input) {
      const [row] = await db
        .insert(communicationChannelMembers)
        .values({
          ...input,
          createdAt: new Date(),
          archivedAt: null
        })
        .onConflictDoUpdate({
          target: [
            communicationChannelMembers.tenantId,
            communicationChannelMembers.channelId,
            communicationChannelMembers.userId
          ],
          set: {
            role: input.role,
            createdByUserId: input.createdByUserId,
            archivedAt: null
          }
        })
        .returning();
      if (!row) throw new Error("Communication channel member upsert returned no row");
      return mapCommunicationChannelMember(row);
    },
    async archiveCommunicationChannelMember(input) {
      const [row] = await db
        .update(communicationChannelMembers)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(communicationChannelMembers.tenantId, input.tenantId),
            eq(communicationChannelMembers.channelId, input.channelId),
            eq(communicationChannelMembers.userId, input.userId),
            isNull(communicationChannelMembers.archivedAt)
          )
        )
        .returning();
      return row ? mapCommunicationChannelMember(row) : undefined;
    },
    async listCommunicationChannelMembers(input) {
      const rows = await db
        .select()
        .from(communicationChannelMembers)
        .where(
          and(
            eq(communicationChannelMembers.tenantId, input.tenantId),
            eq(communicationChannelMembers.channelId, input.channelId),
            isNull(communicationChannelMembers.archivedAt)
          )
        )
        .orderBy(asc(communicationChannelMembers.role), asc(communicationChannelMembers.userId));
      return rows.map(mapCommunicationChannelMember);
    },
    async ensureConversation(input) {
      const now = new Date();
      await db
        .insert(conversations)
        .values({
          ...input,
          createdAt: now
        })
        .onConflictDoNothing({
          target: [
            conversations.tenantId,
            conversations.entityType,
            conversations.entityId,
            conversations.conversationType
          ]
        });

      const rows = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, input.tenantId),
            eq(conversations.entityType, input.entityType),
            eq(conversations.entityId, input.entityId),
            eq(conversations.conversationType, input.conversationType)
          )
        )
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("Conversation upsert returned no row");
      return mapConversation(row);
    },
    async findConversation(tenantId, conversationId) {
      const [row] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            eq(conversations.id, conversationId),
            isNull(conversations.archivedAt)
          )
        )
        .limit(1);
      return row ? mapConversation(row) : undefined;
    },
    async listConversationsByEntity(input) {
      const rows = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, input.tenantId),
            eq(conversations.entityType, input.entityType),
            eq(conversations.entityId, input.entityId),
            isNull(conversations.archivedAt)
          )
        )
        .orderBy(asc(conversations.conversationType), asc(conversations.createdAt));
      return rows.map(mapConversation);
    },
    async addConversationMembers(input) {
      if (input.userIds.length === 0) return;
      const now = new Date();
      await db
        .insert(conversationMembers)
        .values(
          input.userIds.map((userId) => ({
            tenantId: input.tenantId,
            conversationId: input.conversationId,
            userId,
            createdAt: now
          }))
        )
        .onConflictDoNothing();
    },
    async isConversationMember(tenantId, conversationId, userId) {
      const [row] = await db
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.tenantId, tenantId),
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, userId)
          )
        )
        .limit(1);
      return Boolean(row);
    },
    async listConversationMemberIds(tenantId, conversationId) {
      const rows = await db
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.tenantId, tenantId),
            eq(conversationMembers.conversationId, conversationId)
          )
        )
        .orderBy(asc(conversationMembers.userId));
      return rows.map((row) => row.userId);
    },
    async listDirectConversationsForUser(tenantId, userId) {
      const rows = await db
        .select()
        .from(conversations)
        .innerJoin(
          conversationMembers,
          and(
            eq(conversationMembers.tenantId, conversations.tenantId),
            eq(conversationMembers.conversationId, conversations.id)
          )
        )
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            eq(conversationMembers.userId, userId),
            eq(conversations.conversationType, "direct"),
            isNull(conversations.archivedAt)
          )
        )
        .orderBy(desc(conversations.createdAt));
      return rows.map((row) => mapConversation(row.conversations));
    },
    async createDiscussionMessage(input) {
      const [row] = await db
        .insert(discussionMessages)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Discussion message insert returned no row");
      return mapDiscussionMessage(row);
    },
    async listDiscussionMessages(input) {
      const cursorRow = input.cursor
        ? (await db
            .select({ createdAt: discussionMessages.createdAt, id: discussionMessages.id })
            .from(discussionMessages)
            .where(
              and(
                eq(discussionMessages.tenantId, input.tenantId),
                eq(discussionMessages.conversationId, input.conversationId),
                eq(discussionMessages.id, input.cursor),
                isNull(discussionMessages.archivedAt)
              )
            )
            .limit(1))[0]
        : undefined;
      if (input.cursor && !cursorRow) return [];
      const cursorCondition = cursorRow
        ? or(
            lt(discussionMessages.createdAt, cursorRow.createdAt),
            and(
              eq(discussionMessages.createdAt, cursorRow.createdAt),
              lt(discussionMessages.id, cursorRow.id)
            )
          )
        : undefined;
      const rows = await db
        .select()
        .from(discussionMessages)
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            eq(discussionMessages.conversationId, input.conversationId),
            isNull(discussionMessages.archivedAt),
            cursorCondition
          )
        )
        .orderBy(desc(discussionMessages.createdAt), desc(discussionMessages.id))
        .limit(input.limit);
      return rows.reverse().map(mapDiscussionMessage);
    },
    async findDiscussionMessage(tenantId, messageId) {
      const [row] = await db
        .select()
        .from(discussionMessages)
        .where(
          and(
            eq(discussionMessages.tenantId, tenantId),
            eq(discussionMessages.id, messageId)
          )
        )
        .limit(1);
      return row ? mapDiscussionMessage(row) : undefined;
    },
    async updateDiscussionMessage(input) {
      const [row] = await db
        .update(discussionMessages)
        .set({
          body: input.body,
          metadata: input.metadata,
          editedAt: new Date()
        })
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            eq(discussionMessages.id, input.messageId),
            isNull(discussionMessages.archivedAt)
          )
        )
        .returning();
      return row ? mapDiscussionMessage(row) : undefined;
    },
    async archiveDiscussionMessage(input) {
      const [row] = await db
        .update(discussionMessages)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            eq(discussionMessages.id, input.messageId),
            isNull(discussionMessages.archivedAt)
          )
        )
        .returning();
      return row ? mapDiscussionMessage(row) : undefined;
    },
    async pinDiscussionMessage(input) {
      const [row] = await db
        .update(discussionMessages)
        .set({
          pinnedAt: new Date(),
          pinnedByUserId: input.pinnedByUserId
        })
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            eq(discussionMessages.id, input.messageId),
            isNull(discussionMessages.archivedAt)
          )
        )
        .returning();
      return row ? mapDiscussionMessage(row) : undefined;
    },
    // COMM-06: снятие закрепления (зеркало pin) — раньше закрепление было необратимо.
    async unpinDiscussionMessage(input) {
      const [row] = await db
        .update(discussionMessages)
        .set({
          pinnedAt: null,
          pinnedByUserId: null
        })
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            eq(discussionMessages.id, input.messageId),
            isNull(discussionMessages.archivedAt)
          )
        )
        .returning();
      return row ? mapDiscussionMessage(row) : undefined;
    },
    async replaceMessageMentions(input) {
      await db
        .delete(messageMentions)
        .where(
          and(
            eq(messageMentions.tenantId, input.tenantId),
            eq(messageMentions.messageId, input.messageId)
          )
        );
      if (input.mentionedUserIds.length === 0) return [];
      const rows = await db
        .insert(messageMentions)
        .values(
          input.mentionedUserIds.map((mentionedUserId) => ({
            tenantId: input.tenantId,
            messageId: input.messageId,
            mentionedUserId,
            createdAt: new Date()
          }))
        )
        .returning();
      return rows.map(mapMessageMention);
    },
    async listMessageMentions(tenantId, messageId) {
      const rows = await db
        .select()
        .from(messageMentions)
        .where(
          and(
            eq(messageMentions.tenantId, tenantId),
            eq(messageMentions.messageId, messageId)
          )
        )
        .orderBy(asc(messageMentions.mentionedUserId));
      return rows.map(mapMessageMention);
    },
    async upsertMessageReaction(input) {
      const existing = await findActiveMessageReaction(input);
      if (existing) return existing;
      const [row] = await db
        .insert(messageReactions)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning()
        .catch(async (error: unknown) => {
          if (!isConstraintError(error, "message_reactions_active_uidx")) throw error;
          const duplicate = await findActiveMessageReaction(input);
          if (!duplicate) throw error;
          return [messageReactionRow(duplicate)];
        });
      if (!row) throw new Error("Message reaction insert returned no row");
      return mapMessageReaction(row);
    },
    async archiveMessageReaction(input) {
      const [row] = await db
        .update(messageReactions)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(messageReactions.tenantId, input.tenantId),
            eq(messageReactions.messageId, input.messageId),
            eq(messageReactions.id, input.reactionId),
            eq(messageReactions.userId, input.userId),
            isNull(messageReactions.archivedAt)
          )
        )
        .returning();
      return row ? mapMessageReaction(row) : undefined;
    },
    async listMessageReactionsByMessageIds(input) {
      if (input.messageIds.length === 0) return [];
      const rows = await db
        .select()
        .from(messageReactions)
        .where(
          and(
            eq(messageReactions.tenantId, input.tenantId),
            inArray(messageReactions.messageId, input.messageIds),
            isNull(messageReactions.archivedAt)
          )
        )
        .orderBy(asc(messageReactions.messageId), asc(messageReactions.createdAt));
      return rows.map(mapMessageReaction);
    },
    async createStickerPack(input) {
      const [row] = await db
        .insert(stickerPacks)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Sticker pack insert returned no row");
      return mapStickerPack(row);
    },
    async archiveStickerPack(input) {
      const now = new Date();
      const [row] = await db
        .update(stickerPacks)
        .set({ status: "archived", archivedAt: now })
        .where(
          and(
            eq(stickerPacks.tenantId, input.tenantId),
            eq(stickerPacks.id, input.packId),
            isNull(stickerPacks.archivedAt)
          )
        )
        .returning();
      if (!row) return undefined;
      await db
        .update(stickerAssets)
        .set({ status: "archived", archivedAt: now })
        .where(
          and(
            eq(stickerAssets.tenantId, input.tenantId),
            eq(stickerAssets.packId, input.packId),
            isNull(stickerAssets.archivedAt)
          )
        );
      return mapStickerPack(row);
    },
    async listStickerPacks(tenantId) {
      const rows = await db
        .select()
        .from(stickerPacks)
        .where(
          and(
            eq(stickerPacks.tenantId, tenantId),
            eq(stickerPacks.status, "ready"),
            isNull(stickerPacks.archivedAt)
          )
        )
        .orderBy(asc(stickerPacks.createdAt), asc(stickerPacks.id));
      return rows.map(mapStickerPack);
    },
    async createStickerAsset(input) {
      const [row] = await db
        .insert(stickerAssets)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Sticker asset insert returned no row");
      return mapStickerAsset(row);
    },
    async findStickerAsset(tenantId, stickerAssetId) {
      const [row] = await db
        .select({ stickerAsset: stickerAssets })
        .from(stickerAssets)
        .innerJoin(
          stickerPacks,
          and(
            eq(stickerPacks.tenantId, stickerAssets.tenantId),
            eq(stickerPacks.id, stickerAssets.packId)
          )
        )
        .where(
          and(
            eq(stickerAssets.tenantId, tenantId),
            eq(stickerAssets.id, stickerAssetId),
            eq(stickerAssets.status, "ready"),
            isNull(stickerAssets.archivedAt),
            eq(stickerPacks.status, "ready"),
            isNull(stickerPacks.archivedAt)
          )
        )
        .limit(1);
      return row ? mapStickerAsset(row.stickerAsset) : undefined;
    },
    async archiveStickerAsset(input) {
      const [row] = await db
        .update(stickerAssets)
        .set({ status: "archived", archivedAt: new Date() })
        .where(
          and(
            eq(stickerAssets.tenantId, input.tenantId),
            eq(stickerAssets.id, input.stickerAssetId),
            isNull(stickerAssets.archivedAt)
          )
        )
        .returning();
      return row ? mapStickerAsset(row) : undefined;
    },
    async listStickerAssets(input) {
      const rows = await db
        .select({ stickerAsset: stickerAssets })
        .from(stickerAssets)
        .innerJoin(
          stickerPacks,
          and(
            eq(stickerPacks.tenantId, stickerAssets.tenantId),
            eq(stickerPacks.id, stickerAssets.packId)
          )
        )
        .where(
          and(
            eq(stickerAssets.tenantId, input.tenantId),
            eq(stickerAssets.packId, input.packId),
            eq(stickerAssets.status, "ready"),
            isNull(stickerAssets.archivedAt),
            eq(stickerPacks.status, "ready"),
            isNull(stickerPacks.archivedAt)
          )
        )
        .orderBy(asc(stickerAssets.createdAt), asc(stickerAssets.id));
      return rows.map((row) => mapStickerAsset(row.stickerAsset));
    },
    async createMessageSticker(input) {
      const [row] = await db
        .insert(messageStickers)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Message sticker insert returned no row");
      return mapMessageSticker(row);
    },
    async listMessageStickersByMessageIds(input) {
      if (input.messageIds.length === 0) return [];
      const rows = await db
        .select()
        .from(messageStickers)
        .where(
          and(
            eq(messageStickers.tenantId, input.tenantId),
            inArray(messageStickers.messageId, input.messageIds)
          )
        )
        .orderBy(asc(messageStickers.createdAt));
      return rows.map(mapMessageSticker);
    },
    async getConversationReadState(input) {
      const [state] = await db
        .select()
        .from(conversationReadStates)
        .where(
          and(
            eq(conversationReadStates.tenantId, input.tenantId),
            eq(conversationReadStates.conversationId, input.conversationId),
            eq(conversationReadStates.userId, input.userId)
          )
        )
        .limit(1);
      const lastReadAt = state?.lastReadAt ?? null;
      const [unread] = await db
        .select({ count: count() })
        .from(discussionMessages)
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            eq(discussionMessages.conversationId, input.conversationId),
            ne(discussionMessages.authorUserId, input.userId),
            isNull(discussionMessages.archivedAt),
            lastReadAt ? gt(discussionMessages.createdAt, lastReadAt) : sql`true`
          )
        );
      return {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        userId: input.userId,
        lastReadMessageId: state?.lastReadMessageId ?? null,
        lastReadAt,
        unreadCount: unread?.count ?? 0
      };
    },
    async countUnreadConversationMessagesForUser(input) {
      // Непрочитанные = сообщения других авторов после lastReadAt по всем беседам пользователя
      // (зеркало логики getConversationReadState, агрегировано через read-states пользователя).
      const [row] = await db
        .select({ total: count() })
        .from(discussionMessages)
        .innerJoin(
          conversationReadStates,
          and(
            eq(conversationReadStates.tenantId, discussionMessages.tenantId),
            eq(conversationReadStates.conversationId, discussionMessages.conversationId),
            eq(conversationReadStates.userId, input.userId)
          )
        )
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            ne(discussionMessages.authorUserId, input.userId),
            isNull(discussionMessages.archivedAt),
            or(
              isNull(conversationReadStates.lastReadAt),
              gt(discussionMessages.createdAt, conversationReadStates.lastReadAt)
            )
          )
        );
      return row?.total ?? 0;
    },
    async markConversationRead(input) {
      const [latestMessage] = await db
        .select({ id: discussionMessages.id })
        .from(discussionMessages)
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            eq(discussionMessages.conversationId, input.conversationId),
            isNull(discussionMessages.archivedAt)
          )
        )
        .orderBy(desc(discussionMessages.createdAt), desc(discussionMessages.id))
        .limit(1);
      const now = new Date();
      const [row] = await db
        .insert(conversationReadStates)
        .values({
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          userId: input.userId,
          lastReadMessageId: latestMessage?.id ?? null,
          lastReadAt: now,
          unreadCount: 0
        })
        .onConflictDoUpdate({
          target: [
            conversationReadStates.tenantId,
            conversationReadStates.conversationId,
            conversationReadStates.userId
          ],
          set: {
            lastReadMessageId: latestMessage?.id ?? null,
            lastReadAt: now,
            unreadCount: 0
          }
        })
        .returning();
      if (!row) throw new Error("Conversation read state upsert returned no row");
      return mapConversationReadState(row);
    },
    async createUserNotification(input) {
      const [row] = await db
        .insert(userNotifications)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Notification insert returned no row");
      return mapUserNotification(row);
    },
    async listUserNotifications(input) {
      const rows = await db
        .select()
        .from(userNotifications)
        .where(
          and(
            eq(userNotifications.tenantId, input.tenantId),
            eq(userNotifications.userId, input.userId),
            isNull(userNotifications.archivedAt),
            input.status === "unread"
              ? isNull(userNotifications.readAt)
              : input.status === "read"
                ? sql`${userNotifications.readAt} is not null`
                : sql`true`
          )
        )
        .orderBy(desc(userNotifications.createdAt), desc(userNotifications.id))
        .limit(input.limit);
      return rows.map(mapUserNotification);
    },
    async markUserNotificationRead(input) {
      const [updated] = await db
        .update(userNotifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(userNotifications.tenantId, input.tenantId),
            eq(userNotifications.id, input.notificationId),
            eq(userNotifications.userId, input.userId),
            isNull(userNotifications.archivedAt),
            isNull(userNotifications.readAt)
          )
        )
        .returning();
      if (updated) return mapUserNotification(updated);

      const [existing] = await db
        .select()
        .from(userNotifications)
        .where(
          and(
            eq(userNotifications.tenantId, input.tenantId),
            eq(userNotifications.id, input.notificationId),
            eq(userNotifications.userId, input.userId),
            isNull(userNotifications.archivedAt)
          )
        )
        .limit(1);
      return existing ? mapUserNotification(existing) : undefined;
    },
    async listNotificationPreferences(tenantId, userId) {
      const rows = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.tenantId, tenantId),
            eq(notificationPreferences.userId, userId)
          )
        )
        .orderBy(asc(notificationPreferences.channel), asc(notificationPreferences.notificationType));
      return rows.map(mapNotificationPreference);
    },
    async upsertNotificationPreferences(input) {
      if (input.length === 0) return [];
      const first = input[0];
      if (!first) return [];
      await db
        .insert(notificationPreferences)
        .values(input)
        .onConflictDoUpdate({
          target: [
            notificationPreferences.tenantId,
            notificationPreferences.userId,
            notificationPreferences.channel,
            notificationPreferences.notificationType
          ],
          set: {
            enabled: sql`excluded.enabled`,
            digestFrequency: sql`excluded.digest_frequency`
          }
        });
      return this.listNotificationPreferences(first.tenantId, first.userId);
    },
    async createMeeting(input) {
      const [row] = await db
        .insert(meetings)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Meeting insert returned no row");
      return mapMeeting(row);
    },
    async updateMeeting(input) {
      const [row] = await db
        .update(meetings)
        .set({
          title: input.title,
          agenda: input.agenda,
          scheduledStart: input.scheduledStart,
          scheduledFinish: input.scheduledFinish,
          status: input.status
        })
        .where(
          and(
            eq(meetings.tenantId, input.tenantId),
            eq(meetings.id, input.meetingId),
            isNull(meetings.archivedAt)
          )
        )
        .returning();
      return row ? mapMeeting(row) : undefined;
    },
    async findMeeting(tenantId, meetingId) {
      const [row] = await db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.tenantId, tenantId),
            eq(meetings.id, meetingId),
            isNull(meetings.archivedAt)
          )
        )
        .limit(1);
      return row ? mapMeeting(row) : undefined;
    },
    async listMeetingsByEntity(input) {
      const rows = await db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.tenantId, input.tenantId),
            eq(meetings.entityType, input.entityType),
            eq(meetings.entityId, input.entityId),
            isNull(meetings.archivedAt)
          )
        )
        .orderBy(asc(meetings.scheduledStart), asc(meetings.id));
      return rows.map(mapMeeting);
    },
    async replaceMeetingParticipants(input) {
      await db
        .delete(meetingParticipants)
        .where(
          and(
            eq(meetingParticipants.tenantId, input.tenantId),
            eq(meetingParticipants.meetingId, input.meetingId)
          )
        );
      if (input.participants.length === 0) return [];
      const rows = await db
        .insert(meetingParticipants)
        .values(
          input.participants.map((participant) => ({
            tenantId: input.tenantId,
            meetingId: input.meetingId,
            userId: participant.userId,
            role: participant.role,
            response: participant.response,
            createdAt: new Date()
          }))
        )
        .returning();
      return rows.map(mapMeetingParticipant);
    },
    async listMeetingParticipants(tenantId, meetingId) {
      const rows = await db
        .select()
        .from(meetingParticipants)
        .where(
          and(
            eq(meetingParticipants.tenantId, tenantId),
            eq(meetingParticipants.meetingId, meetingId)
          )
        )
        .orderBy(asc(meetingParticipants.role), asc(meetingParticipants.userId));
      return rows.map(mapMeetingParticipant);
    },
    async createMeetingExternalLink(input) {
      const [row] = await db
        .insert(meetingExternalLinks)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Meeting link insert returned no row");
      return mapMeetingExternalLink(row);
    },
    async listMeetingExternalLinks(tenantId, meetingId) {
      const rows = await db
        .select()
        .from(meetingExternalLinks)
        .where(
          and(
            eq(meetingExternalLinks.tenantId, tenantId),
            eq(meetingExternalLinks.meetingId, meetingId),
            isNull(meetingExternalLinks.archivedAt)
          )
        )
        .orderBy(asc(meetingExternalLinks.createdAt));
      return rows.map(mapMeetingExternalLink);
    },
    async createMeetingNote(input) {
      const [row] = await db
        .insert(meetingNotes)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Meeting note insert returned no row");
      return mapMeetingNote(row);
    },
    async listMeetingNotes(tenantId, meetingId) {
      const rows = await db
        .select()
        .from(meetingNotes)
        .where(
          and(
            eq(meetingNotes.tenantId, tenantId),
            eq(meetingNotes.meetingId, meetingId),
            isNull(meetingNotes.archivedAt)
          )
        )
        .orderBy(asc(meetingNotes.createdAt));
      return rows.map(mapMeetingNote);
    },
    async createMeetingActionItem(input) {
      const [row] = await db
        .insert(meetingActionItems)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();
      if (!row) throw new Error("Meeting action item insert returned no row");
      return mapMeetingActionItem(row);
    },
    async listMeetingActionItems(tenantId, meetingId) {
      const rows = await db
        .select()
        .from(meetingActionItems)
        .where(
          and(
            eq(meetingActionItems.tenantId, tenantId),
            eq(meetingActionItems.meetingId, meetingId),
            isNull(meetingActionItems.archivedAt)
          )
        )
        .orderBy(asc(meetingActionItems.createdAt));
      return rows.map(mapMeetingActionItem);
    },
    async updateMeetingActionItem(input) {
      const [row] = await db
        .update(meetingActionItems)
        .set({ status: input.status })
        .where(
          and(
            eq(meetingActionItems.tenantId, input.tenantId),
            eq(meetingActionItems.meetingId, input.meetingId),
            eq(meetingActionItems.id, input.actionItemId),
            isNull(meetingActionItems.archivedAt)
          )
        )
        .returning();
      return row ? mapMeetingActionItem(row) : undefined;
    },
    async createCallRoom(input) {
      const now = new Date();
      const [row] = await db
        .insert(callRooms)
        .values({
          ...input,
          createdAt: now,
          updatedAt: now
        })
        .returning()
        .catch((error: unknown) => {
          if (isConstraintError(error, "call_rooms_tenant_provider_room_uidx")) {
            throw new Error("call_room_provider_room_conflict");
          }
          throw error;
        });
      if (!row) throw new Error("Call room insert returned no row");
      return mapCallRoom(row);
    },
    async findCallRoom(tenantId, roomId) {
      const [row] = await db
        .select()
        .from(callRooms)
        .where(
          and(
            eq(callRooms.tenantId, tenantId),
            eq(callRooms.id, roomId),
            isNull(callRooms.archivedAt)
          )
        )
        .limit(1);
      return row ? mapCallRoom(row) : undefined;
    },
    async listCallRoomsByEntity(input) {
      const rows = await db
        .select()
        .from(callRooms)
        .where(
          and(
            eq(callRooms.tenantId, input.tenantId),
            eq(callRooms.entityType, input.entityType),
            eq(callRooms.entityId, input.entityId),
            isNull(callRooms.archivedAt)
          )
        )
        .orderBy(desc(callRooms.createdAt), desc(callRooms.id));
      return rows.map(mapCallRoom);
    },
    async updateCallRoomStatus(input) {
      const [row] = await db
        .update(callRooms)
        .set({ status: input.status, updatedAt: new Date() })
        .where(
          and(
            eq(callRooms.tenantId, input.tenantId),
            eq(callRooms.id, input.roomId),
            isNull(callRooms.archivedAt)
          )
        )
        .returning();
      return row ? mapCallRoom(row) : undefined;
    },
    async createCallSession(input) {
      const [row] = await db
        .insert(callSessions)
        .values({
          ...input,
          endedByUserId: null,
          endedAt: null,
          failureReason: null,
          startedAt: new Date()
        })
        .returning()
        .catch((error: unknown) => {
          if (isConstraintError(error, "call_sessions_one_active_per_room_uidx")) {
            throw new Error("call_room_already_active");
          }
          throw error;
        });
      if (!row) throw new Error("Call session insert returned no row");
      return mapCallSession(row);
    },
    async findCallSession(tenantId, sessionId) {
      const [row] = await db
        .select()
        .from(callSessions)
        .where(and(eq(callSessions.tenantId, tenantId), eq(callSessions.id, sessionId)))
        .limit(1);
      return row ? mapCallSession(row) : undefined;
    },
    async findActiveCallSessionForUpdate(input) {
      const [row] = await db
        .select()
        .from(callSessions)
        .where(
          and(
            eq(callSessions.tenantId, input.tenantId),
            eq(callSessions.roomId, input.roomId),
            eq(callSessions.id, input.sessionId),
            eq(callSessions.status, "active")
          )
        )
        .for("update")
        .limit(1);
      return row ? mapCallSession(row) : undefined;
    },
    async findActiveCallSessionByRoom(input) {
      // At most one active session per room (call_sessions_one_active_per_room_uidx), so this
      // is the session a second participant joins instead of starting a new one.
      const [row] = await db
        .select()
        .from(callSessions)
        .where(
          and(
            eq(callSessions.tenantId, input.tenantId),
            eq(callSessions.roomId, input.roomId),
            eq(callSessions.status, "active")
          )
        )
        .limit(1);
      return row ? mapCallSession(row) : undefined;
    },
    async endCallSession(input) {
      const [row] = await db
        .update(callSessions)
        .set({
          endedAt: new Date(),
          endedByUserId: input.endedByUserId,
          failureReason: input.failureReason ?? null,
          status: input.status
        })
        .where(
          and(
            eq(callSessions.tenantId, input.tenantId),
            eq(callSessions.id, input.sessionId),
            eq(callSessions.status, "active")
          )
        )
        .returning();
      return row ? mapCallSession(row) : undefined;
    },
    async upsertCallParticipantState(input) {
      const now = new Date();
      const joinedAt = input.state === "joined" ? now : null;
      const leftAt = input.state === "left" || input.state === "removed" ? now : null;
      const [row] = await db
        .insert(callParticipantStates)
        .values({
          ...input,
          joinedAt,
          leftAt,
          lastSeenAt: now
        })
        .onConflictDoUpdate({
          target: [
            callParticipantStates.tenantId,
            callParticipantStates.roomId,
            callParticipantStates.sessionId,
            callParticipantStates.userId
          ],
          set: {
            state: input.state,
            joinedAt: sql`coalesce(${callParticipantStates.joinedAt}, excluded.joined_at)`,
            leftAt,
            lastSeenAt: now
          }
        })
        .returning();
      if (!row) throw new Error("Call participant state upsert returned no row");
      return mapCallParticipantState(row);
    },
    async listCallParticipantStates(input) {
      const rows = await db
        .select()
        .from(callParticipantStates)
        .where(
          and(
            eq(callParticipantStates.tenantId, input.tenantId),
            eq(callParticipantStates.roomId, input.roomId),
            eq(callParticipantStates.sessionId, input.sessionId)
          )
        )
        .orderBy(asc(callParticipantStates.userId));
      return rows.map(mapCallParticipantState);
    },
    async createCallEvent(input) {
      const [row] = await db
        .insert(callEvents)
        .values({ ...input, createdAt: new Date() })
        .returning();
      if (!row) throw new Error("Call event insert returned no row");
      return mapCallEvent(row);
    },
    async listCallEvents(input) {
      const rows = await db
        .select()
        .from(callEvents)
        .where(and(eq(callEvents.tenantId, input.tenantId), eq(callEvents.roomId, input.roomId)))
        .orderBy(desc(callEvents.createdAt), desc(callEvents.id))
        .limit(input.limit);
      return rows.map(mapCallEvent);
    },
    async createCallRecording(input) {
      const [row] = await db
        .insert(callRecordings)
        .values({ ...input, createdAt: new Date() })
        .returning();
      if (!row) throw new Error("Call recording insert returned no row");
      return mapCallRecording(row);
    },
    async listCallRecordings(input) {
      const rows = await db
        .select()
        .from(callRecordings)
        .where(
          and(
            eq(callRecordings.tenantId, input.tenantId),
            eq(callRecordings.roomId, input.roomId),
            isNull(callRecordings.archivedAt)
          )
        )
        .orderBy(desc(callRecordings.createdAt), desc(callRecordings.id));
      return rows.map(mapCallRecording);
    },
    async findCallRecordingByEgressId(input) {
      const [row] = await db
        .select()
        .from(callRecordings)
        .where(
          and(
            eq(callRecordings.tenantId, input.tenantId),
            eq(callRecordings.egressId, input.egressId)
          )
        )
        .limit(1);
      return row ? mapCallRecording(row) : undefined;
    },
    async listCallRecordingsByGroup(input) {
      const rows = await db
        .select()
        .from(callRecordings)
        .where(
          and(
            eq(callRecordings.tenantId, input.tenantId),
            eq(callRecordings.recordingGroupId, input.recordingGroupId)
          )
        )
        .orderBy(desc(callRecordings.createdAt), desc(callRecordings.id));
      return rows.map(mapCallRecording);
    },
    async updateCallRecordingByEgress(input) {
      const patch: Partial<typeof callRecordings.$inferInsert> = { status: input.status };
      if (input.attachmentId !== undefined) patch.attachmentId = input.attachmentId;
      if (input.durationSeconds !== undefined) patch.durationSeconds = input.durationSeconds;
      if (input.endedAt !== undefined) patch.endedAt = input.endedAt;
      const [row] = await db
        .update(callRecordings)
        .set(patch)
        .where(
          and(
            eq(callRecordings.tenantId, input.tenantId),
            eq(callRecordings.egressId, input.egressId),
            // Claim-once: a concurrent/retried reconcile that already attached matches 0 rows.
            isNull(callRecordings.attachmentId)
          )
        )
        .returning();
      return row ? mapCallRecording(row) : undefined;
    },
    async failStaleInProgressRecordings(input) {
      const rows = await db
        .update(callRecordings)
        .set({ status: "failed", endedAt: new Date() })
        .where(
          and(
            eq(callRecordings.tenantId, input.tenantId),
            eq(callRecordings.status, "recording"),
            lt(callRecordings.createdAt, input.olderThan)
          )
        )
        .returning();
      return rows.map(mapCallRecording);
    }
  };
}

function mapCommunicationChannel(row: typeof communicationChannels.$inferSelect): CommunicationChannel {
  return {
    id: row.id,
    tenantId: row.tenantId,
    channelType: row.channelType as CommunicationChannelType,
    title: row.title,
    description: row.description,
    scopeEntityType: row.scopeEntityType as "project" | "org_unit" | null,
    scopeEntityId: row.scopeEntityId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}

function mapCommunicationChannelMember(
  row: typeof communicationChannelMembers.$inferSelect
): CommunicationChannelMember {
  return {
    tenantId: row.tenantId,
    channelId: row.channelId,
    userId: row.userId,
    role: row.role as CommunicationChannelRole,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function mapConversation(row: typeof conversations.$inferSelect): Conversation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entityType: row.entityType as CollaborationEntityType,
    entityId: row.entityId,
    conversationType: row.conversationType as ConversationType,
    title: row.title,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function mapDiscussionMessage(row: typeof discussionMessages.$inferSelect): DiscussionMessage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    conversationId: row.conversationId,
    authorUserId: row.authorUserId,
    body: row.body,
    metadata: row.metadata,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    archivedAt: row.archivedAt,
    pinnedAt: row.pinnedAt,
    pinnedByUserId: row.pinnedByUserId
  };
}

function mapMessageMention(row: typeof messageMentions.$inferSelect): MessageMention {
  return {
    tenantId: row.tenantId,
    messageId: row.messageId,
    mentionedUserId: row.mentionedUserId,
    createdAt: row.createdAt
  };
}

function mapMessageReaction(row: typeof messageReactions.$inferSelect): MessageReaction {
  return {
    id: row.id,
    tenantId: row.tenantId,
    messageId: row.messageId,
    userId: row.userId,
    emoji: row.emoji,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function messageReactionRow(
  reaction: MessageReaction
): typeof messageReactions.$inferSelect {
  return {
    id: reaction.id,
    tenantId: reaction.tenantId,
    messageId: reaction.messageId,
    userId: reaction.userId,
    emoji: reaction.emoji,
    createdAt: reaction.createdAt,
    archivedAt: reaction.archivedAt
  };
}

function mapStickerPack(row: typeof stickerPacks.$inferSelect): StickerPack {
  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    description: row.description,
    source: row.source as StickerPackSource,
    status: row.status as "ready" | "archived",
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function mapStickerAsset(row: typeof stickerAssets.$inferSelect): StickerAsset {
  return {
    id: row.id,
    tenantId: row.tenantId,
    packId: row.packId,
    fileAssetId: row.fileAssetId,
    emoji: row.emoji,
    title: row.title,
    tags: row.tags,
    mimeType: row.mimeType as StickerMimeType,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    checksumSha256: row.checksumSha256,
    status: row.status as StickerStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function mapMessageSticker(row: typeof messageStickers.$inferSelect): MessageSticker {
  return {
    tenantId: row.tenantId,
    messageId: row.messageId,
    stickerAssetId: row.stickerAssetId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt
  };
}

function mapConversationReadState(
  row: typeof conversationReadStates.$inferSelect
): ConversationReadState {
  return {
    tenantId: row.tenantId,
    conversationId: row.conversationId,
    userId: row.userId,
    lastReadMessageId: row.lastReadMessageId,
    lastReadAt: row.lastReadAt,
    unreadCount: row.unreadCount
  };
}

function mapUserNotification(row: typeof userNotifications.$inferSelect): UserNotification {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    notificationType: row.notificationType as NotificationType,
    sourceEntityType: row.sourceEntityType,
    sourceEntityId: row.sourceEntityId,
    title: row.title,
    body: row.body,
    route: row.route,
    createdAt: row.createdAt,
    readAt: row.readAt,
    archivedAt: row.archivedAt
  };
}

function mapNotificationPreference(
  row: typeof notificationPreferences.$inferSelect
): NotificationPreference {
  return {
    tenantId: row.tenantId,
    userId: row.userId,
    channel: row.channel as NotificationChannel,
    notificationType: row.notificationType as NotificationType,
    enabled: row.enabled,
    digestFrequency: row.digestFrequency as DigestFrequency
  };
}

function mapMeeting(row: typeof meetings.$inferSelect): Meeting {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entityType: row.entityType as CollaborationEntityType,
    entityId: row.entityId,
    title: row.title,
    agenda: row.agenda,
    scheduledStart: row.scheduledStart,
    scheduledFinish: row.scheduledFinish,
    status: row.status as MeetingStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function mapMeetingParticipant(row: typeof meetingParticipants.$inferSelect): MeetingParticipant {
  return {
    tenantId: row.tenantId,
    meetingId: row.meetingId,
    userId: row.userId,
    role: row.role as MeetingParticipantRole,
    response: row.response as MeetingParticipantResponse,
    createdAt: row.createdAt
  };
}

function mapMeetingExternalLink(row: typeof meetingExternalLinks.$inferSelect): MeetingExternalLink {
  return {
    id: row.id,
    tenantId: row.tenantId,
    meetingId: row.meetingId,
    provider: row.provider as MeetingExternalLinkProvider,
    url: row.url,
    title: row.title,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function mapMeetingNote(row: typeof meetingNotes.$inferSelect): MeetingNote {
  return {
    id: row.id,
    tenantId: row.tenantId,
    meetingId: row.meetingId,
    authorUserId: row.authorUserId,
    body: row.body,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    archivedAt: row.archivedAt
  };
}

function mapMeetingActionItem(row: typeof meetingActionItems.$inferSelect): MeetingActionItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    meetingId: row.meetingId,
    title: row.title,
    ownerUserId: row.ownerUserId,
    dueDate: row.dueDate,
    targetEntityType: row.targetEntityType as MeetingActionTargetType,
    targetEntityId: row.targetEntityId,
    status: row.status as MeetingActionItemStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function mapCallRoom(row: typeof callRooms.$inferSelect): CallRoom {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entityType: row.entityType as CollaborationEntityType,
    entityId: row.entityId,
    meetingId: row.meetingId,
    title: row.title,
    mediaKind: row.mediaKind as CallMediaKind,
    provider: row.provider as CallRoomProvider,
    providerRoomId: row.providerRoomId,
    status: row.status as CallRoomStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}

function mapCallSession(row: typeof callSessions.$inferSelect): CallSession {
  return {
    id: row.id,
    tenantId: row.tenantId,
    roomId: row.roomId,
    providerSessionId: row.providerSessionId,
    status: row.status as CallSessionStatus,
    startedByUserId: row.startedByUserId,
    startedAt: row.startedAt,
    endedByUserId: row.endedByUserId,
    endedAt: row.endedAt,
    failureReason: row.failureReason
  };
}

function mapCallParticipantState(
  row: typeof callParticipantStates.$inferSelect
): CallParticipantState {
  return {
    tenantId: row.tenantId,
    roomId: row.roomId,
    sessionId: row.sessionId,
    userId: row.userId,
    state: row.state as CallParticipantStateValue,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
    lastSeenAt: row.lastSeenAt
  };
}

function mapCallEvent(row: typeof callEvents.$inferSelect): CallEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    roomId: row.roomId,
    sessionId: row.sessionId,
    eventType: row.eventType as CallEventType,
    actorUserId: row.actorUserId,
    payload: row.payload,
    createdAt: row.createdAt
  };
}

function mapCallRecording(row: typeof callRecordings.$inferSelect): CallRecording {
  return {
    id: row.id,
    tenantId: row.tenantId,
    roomId: row.roomId,
    sessionId: row.sessionId,
    recordingGroupId: row.recordingGroupId,
    attachmentId: row.attachmentId,
    egressId: row.egressId,
    participantId: row.participantId,
    trackId: row.trackId,
    kind: row.kind as CallRecording["kind"],
    status: row.status as CallRecording["status"],
    durationSeconds: row.durationSeconds,
    title: row.title,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    endedAt: row.endedAt,
    archivedAt: row.archivedAt
  };
}

function isConstraintError(error: unknown, constraintName: string): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" &&
    (
      record.constraint_name === constraintName ||
      record.constraint === constraintName ||
      String(record.message ?? "").includes(constraintName)
    )
  ) || isConstraintError(record.cause, constraintName);
}
