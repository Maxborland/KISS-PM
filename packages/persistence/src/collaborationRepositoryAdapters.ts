import type { CollaborationRepository } from "./collaborationRepository";

export type CommunicationChannelPersistenceAdapter = Pick<
  CollaborationRepository,
  | "archiveCommunicationChannelMember"
  | "createCommunicationChannel"
  | "ensureWorkspaceGeneralChannel"
  | "findCommunicationChannel"
  | "listCommunicationChannelMembers"
  | "listCommunicationChannels"
  | "updateCommunicationChannel"
  | "upsertCommunicationChannelMember"
>;

export type ConversationPersistenceAdapter = Pick<
  CollaborationRepository,
  | "ensureConversation"
  | "findConversation"
  | "getConversationReadState"
  | "listConversationsByEntity"
  | "markConversationRead"
>;

export type DiscussionMessagePersistenceAdapter = Pick<
  CollaborationRepository,
  | "archiveDiscussionMessage"
  | "archiveMessageReaction"
  | "createDiscussionMessage"
  | "createMessageSticker"
  | "findDiscussionMessage"
  | "listDiscussionMessages"
  | "listMessageMentions"
  | "listMessageReactionsByMessageIds"
  | "listMessageStickersByMessageIds"
  | "pinDiscussionMessage"
  | "replaceMessageMentions"
  | "updateDiscussionMessage"
  | "upsertMessageReaction"
>;

export type StickerPersistenceAdapter = Pick<
  CollaborationRepository,
  | "archiveStickerAsset"
  | "archiveStickerPack"
  | "createStickerAsset"
  | "createStickerPack"
  | "findStickerAsset"
  | "listStickerAssets"
  | "listStickerPacks"
>;

export type NotificationPersistenceAdapter = Pick<
  CollaborationRepository,
  | "createUserNotification"
  | "listNotificationPreferences"
  | "listUserNotifications"
  | "markUserNotificationRead"
  | "upsertNotificationPreferences"
>;

export type MeetingPersistenceAdapter = Pick<
  CollaborationRepository,
  | "createMeeting"
  | "createMeetingActionItem"
  | "createMeetingExternalLink"
  | "createMeetingNote"
  | "findMeeting"
  | "listMeetingActionItems"
  | "listMeetingExternalLinks"
  | "listMeetingNotes"
  | "listMeetingParticipants"
  | "listMeetingsByEntity"
  | "replaceMeetingParticipants"
  | "updateMeeting"
>;

export type CallPersistenceAdapter = Pick<
  CollaborationRepository,
  | "createCallEvent"
  | "createCallRecording"
  | "createCallRoom"
  | "createCallSession"
  | "endCallSession"
  | "findActiveCallSessionForUpdate"
  | "findCallRoom"
  | "findCallSession"
  | "listCallEvents"
  | "listCallParticipantStates"
  | "listCallRecordings"
  | "findCallRecordingByEgressId"
  | "listCallRecordingsByGroup"
  | "updateCallRecordingByEgress"
  | "listCallRoomsByEntity"
  | "updateCallRoomStatus"
  | "upsertCallParticipantState"
>;

export type FocusedCollaborationPersistenceAdapters = {
  calls: CallPersistenceAdapter;
  channels: CommunicationChannelPersistenceAdapter;
  conversations: ConversationPersistenceAdapter;
  messages: DiscussionMessagePersistenceAdapter;
  meetings: MeetingPersistenceAdapter;
  notifications: NotificationPersistenceAdapter;
  stickers: StickerPersistenceAdapter;
};

export function createFocusedCollaborationPersistenceAdapters(
  repository: CollaborationRepository
): FocusedCollaborationPersistenceAdapters {
  return {
    calls: {
      createCallEvent: repository.createCallEvent.bind(repository),
      createCallRecording: repository.createCallRecording.bind(repository),
      createCallRoom: repository.createCallRoom.bind(repository),
      createCallSession: repository.createCallSession.bind(repository),
      endCallSession: repository.endCallSession.bind(repository),
      findActiveCallSessionForUpdate: repository.findActiveCallSessionForUpdate.bind(repository),
      findCallRoom: repository.findCallRoom.bind(repository),
      findCallSession: repository.findCallSession.bind(repository),
      listCallEvents: repository.listCallEvents.bind(repository),
      listCallParticipantStates: repository.listCallParticipantStates.bind(repository),
      listCallRecordings: repository.listCallRecordings.bind(repository),
      findCallRecordingByEgressId: repository.findCallRecordingByEgressId.bind(repository),
      listCallRecordingsByGroup: repository.listCallRecordingsByGroup.bind(repository),
      updateCallRecordingByEgress: repository.updateCallRecordingByEgress.bind(repository),
      listCallRoomsByEntity: repository.listCallRoomsByEntity.bind(repository),
      updateCallRoomStatus: repository.updateCallRoomStatus.bind(repository),
      upsertCallParticipantState: repository.upsertCallParticipantState.bind(repository)
    },
    channels: {
      archiveCommunicationChannelMember: repository.archiveCommunicationChannelMember.bind(repository),
      createCommunicationChannel: repository.createCommunicationChannel.bind(repository),
      ensureWorkspaceGeneralChannel: repository.ensureWorkspaceGeneralChannel.bind(repository),
      findCommunicationChannel: repository.findCommunicationChannel.bind(repository),
      listCommunicationChannelMembers: repository.listCommunicationChannelMembers.bind(repository),
      listCommunicationChannels: repository.listCommunicationChannels.bind(repository),
      updateCommunicationChannel: repository.updateCommunicationChannel.bind(repository),
      upsertCommunicationChannelMember: repository.upsertCommunicationChannelMember.bind(repository)
    },
    conversations: {
      ensureConversation: repository.ensureConversation.bind(repository),
      findConversation: repository.findConversation.bind(repository),
      getConversationReadState: repository.getConversationReadState.bind(repository),
      listConversationsByEntity: repository.listConversationsByEntity.bind(repository),
      markConversationRead: repository.markConversationRead.bind(repository)
    },
    messages: {
      archiveDiscussionMessage: repository.archiveDiscussionMessage.bind(repository),
      archiveMessageReaction: repository.archiveMessageReaction.bind(repository),
      createDiscussionMessage: repository.createDiscussionMessage.bind(repository),
      createMessageSticker: repository.createMessageSticker.bind(repository),
      findDiscussionMessage: repository.findDiscussionMessage.bind(repository),
      listDiscussionMessages: repository.listDiscussionMessages.bind(repository),
      listMessageMentions: repository.listMessageMentions.bind(repository),
      listMessageReactionsByMessageIds: repository.listMessageReactionsByMessageIds.bind(repository),
      listMessageStickersByMessageIds: repository.listMessageStickersByMessageIds.bind(repository),
      pinDiscussionMessage: repository.pinDiscussionMessage.bind(repository),
      replaceMessageMentions: repository.replaceMessageMentions.bind(repository),
      updateDiscussionMessage: repository.updateDiscussionMessage.bind(repository),
      upsertMessageReaction: repository.upsertMessageReaction.bind(repository)
    },
    meetings: {
      createMeeting: repository.createMeeting.bind(repository),
      createMeetingActionItem: repository.createMeetingActionItem.bind(repository),
      createMeetingExternalLink: repository.createMeetingExternalLink.bind(repository),
      createMeetingNote: repository.createMeetingNote.bind(repository),
      findMeeting: repository.findMeeting.bind(repository),
      listMeetingActionItems: repository.listMeetingActionItems.bind(repository),
      listMeetingExternalLinks: repository.listMeetingExternalLinks.bind(repository),
      listMeetingNotes: repository.listMeetingNotes.bind(repository),
      listMeetingParticipants: repository.listMeetingParticipants.bind(repository),
      listMeetingsByEntity: repository.listMeetingsByEntity.bind(repository),
      replaceMeetingParticipants: repository.replaceMeetingParticipants.bind(repository),
      updateMeeting: repository.updateMeeting.bind(repository)
    },
    notifications: {
      createUserNotification: repository.createUserNotification.bind(repository),
      listNotificationPreferences: repository.listNotificationPreferences.bind(repository),
      listUserNotifications: repository.listUserNotifications.bind(repository),
      markUserNotificationRead: repository.markUserNotificationRead.bind(repository),
      upsertNotificationPreferences: repository.upsertNotificationPreferences.bind(repository)
    },
    stickers: {
      archiveStickerAsset: repository.archiveStickerAsset.bind(repository),
      archiveStickerPack: repository.archiveStickerPack.bind(repository),
      createStickerAsset: repository.createStickerAsset.bind(repository),
      createStickerPack: repository.createStickerPack.bind(repository),
      findStickerAsset: repository.findStickerAsset.bind(repository),
      listStickerAssets: repository.listStickerAssets.bind(repository),
      listStickerPacks: repository.listStickerPacks.bind(repository)
    }
  };
}
