import { and, asc, count, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";

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
  NotificationChannel,
  NotificationPreference,
  NotificationType,
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
  conversationReadStates,
  conversations,
  discussionMessages,
  meetingActionItems,
  meetingExternalLinks,
  meetingNotes,
  meetingParticipants,
  meetings,
  messageMentions,
  notificationPreferences,
  userNotifications
} from "./schema";

export type ConversationInput = Omit<Conversation, "createdAt" | "archivedAt">;
export type DiscussionMessageInput = Omit<
  DiscussionMessage,
  "createdAt" | "editedAt" | "archivedAt" | "pinnedAt" | "pinnedByUserId"
>;
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
  ensureConversation(input: ConversationInput): Promise<Conversation>;
  findConversation(tenantId: TenantId, conversationId: string): Promise<Conversation | undefined>;
  listConversationsByEntity(input: {
    tenantId: TenantId;
    entityType: CollaborationEntityType;
    entityId: string;
  }): Promise<Conversation[]>;
  createDiscussionMessage(input: DiscussionMessageInput): Promise<DiscussionMessage>;
  listDiscussionMessages(input: {
    tenantId: TenantId;
    conversationId: string;
    limit: number;
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
  replaceMessageMentions(input: {
    tenantId: TenantId;
    messageId: string;
    mentionedUserIds: UserId[];
  }): Promise<MessageMention[]>;
  listMessageMentions(tenantId: TenantId, messageId: string): Promise<MessageMention[]>;
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
};

export function createCollaborationRepository(db: KissPmDatabase): CollaborationRepository {
  return {
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
      const rows = await db
        .select()
        .from(discussionMessages)
        .where(
          and(
            eq(discussionMessages.tenantId, input.tenantId),
            eq(discussionMessages.conversationId, input.conversationId),
            isNull(discussionMessages.archivedAt)
          )
        )
        .orderBy(asc(discussionMessages.createdAt), asc(discussionMessages.id))
        .limit(input.limit);
      return rows.map(mapDiscussionMessage);
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
      const [row] = await db
        .update(userNotifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(userNotifications.tenantId, input.tenantId),
            eq(userNotifications.id, input.notificationId),
            eq(userNotifications.userId, input.userId),
            isNull(userNotifications.archivedAt)
          )
        )
        .returning();
      return row ? mapUserNotification(row) : undefined;
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
    async createCallRoom(input) {
      const now = new Date();
      const [row] = await db
        .insert(callRooms)
        .values({
          ...input,
          createdAt: now,
          updatedAt: now
        })
        .returning();
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
        .returning();
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
    }
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
    attachmentId: row.attachmentId,
    title: row.title,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}
