import {
  callEventTypeSchema,
  callMediaKindSchema,
  callParticipantStateSchema,
  callRoomProviderSchema,
  callRoomStatusSchema,
  callSessionStatusSchema,
  collaborationEntityTypeSchema,
  communicationChannelRoleSchema,
  communicationChannelTypeSchema,
  conversationTypeSchema,
  dateTimeSchema,
  digestFrequencySchema,
  meetingActionStatusSchema,
  meetingActionTargetTypeSchema,
  meetingExternalLinkProviderSchema,
  meetingParticipantResponseSchema,
  meetingParticipantRoleSchema,
  meetingStatusSchema,
  notificationChannelSchema,
  notificationTypeSchema,
  nullableStringSchema,
  openApiSchemaFragment,
  planDateOrNullSchema,
  schemaRef,
  stickerPackSourceSchema,
  stringIdSchema
} from "./schemaPrimitives";

export const collaborationSchemas = openApiSchemaFragment({
  CollaborationEntityType: collaborationEntityTypeSchema,
  ConversationType: conversationTypeSchema,
  ConversationReadState: {
    type: "object",
    required: ["tenantId", "conversationId", "userId", "lastReadMessageId", "lastReadAt"],
    properties: {
      tenantId: stringIdSchema,
      conversationId: stringIdSchema,
      userId: stringIdSchema,
      lastReadMessageId: nullableStringSchema,
      lastReadAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  Conversation: {
    type: "object",
    required: ["id", "tenantId", "entityType", "entityId", "conversationType", "title", "createdByUserId", "createdAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      entityType: schemaRef("CollaborationEntityType"),
      entityId: stringIdSchema,
      conversationType: schemaRef("ConversationType"),
      title: { type: "string", minLength: 1 },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  ConversationWithReadState: {
    allOf: [
      schemaRef("Conversation"),
      {
        type: "object",
        required: ["readState"],
        properties: { readState: { oneOf: [schemaRef("ConversationReadState"), { type: "null" }] } },
        additionalProperties: false
      }
    ]
  },
  MessageReaction: {
    type: "object",
    required: ["id", "tenantId", "messageId", "userId", "emoji", "createdAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      messageId: stringIdSchema,
      userId: stringIdSchema,
      emoji: { type: "string", minLength: 1, maxLength: 16 },
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  MessageSticker: {
    type: "object",
    required: ["tenantId", "messageId", "stickerAssetId", "createdByUserId", "createdAt"],
    properties: {
      tenantId: stringIdSchema,
      messageId: stringIdSchema,
      stickerAssetId: stringIdSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  DiscussionMessage: {
    type: "object",
    required: ["id", "tenantId", "conversationId", "authorUserId", "body", "metadata", "createdAt", "editedAt", "archivedAt", "pinnedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      conversationId: stringIdSchema,
      authorUserId: stringIdSchema,
      body: { type: "string", minLength: 1, maxLength: 8000 },
      metadata: schemaRef("AnyJsonObject"),
      createdAt: dateTimeSchema,
      editedAt: { type: ["string", "null"], format: "date-time" },
      archivedAt: { type: ["string", "null"], format: "date-time" },
      pinnedAt: { type: ["string", "null"], format: "date-time" },
      reactions: { type: "array", items: schemaRef("MessageReaction") },
      stickers: { type: "array", items: schemaRef("MessageSticker") }
    },
    additionalProperties: false
  },
  MessageMention: {
    type: "object",
    required: ["tenantId", "messageId", "mentionedUserId"],
    properties: {
      tenantId: stringIdSchema,
      messageId: stringIdSchema,
      mentionedUserId: stringIdSchema
    },
    additionalProperties: true
  },
  ConversationMessageCreateRequest: {
    type: "object",
    properties: {
      body: { type: "string", minLength: 1, maxLength: 8000 },
      stickerAssetId: stringIdSchema,
      metadata: {
        type: "object",
        properties: {
          links: { type: "array", items: schemaRef("MessageLink") },
          attachmentIds: { type: "array", items: stringIdSchema }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  MessageLink: {
    type: "object",
    required: ["entityType", "entityId"],
    properties: {
      entityType: { type: "string", enum: ["project", "task", "opportunity", "kpi_signal", "corrective_action", "control_action"] },
      entityId: stringIdSchema
    },
    additionalProperties: false
  },
  ConversationMessagePatchRequest: {
    type: "object",
    required: ["body"],
    properties: {
      body: { type: "string", minLength: 1, maxLength: 8000 },
      metadata: {
        type: "object",
        properties: {
          links: { type: "array", items: schemaRef("MessageLink") },
          attachmentIds: { type: "array", items: stringIdSchema }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  MessageReactionCreateRequest: {
    type: "object",
    required: ["emoji"],
    properties: { emoji: { type: "string", minLength: 1, maxLength: 16 } },
    additionalProperties: false
  },
  ConversationsResponse: {
    type: "object",
    required: ["conversations"],
    properties: { conversations: { type: "array", items: schemaRef("ConversationWithReadState") } },
    additionalProperties: false
  },
  ConversationMessagesResponse: {
    type: "object",
    required: ["messages", "nextCursor"],
    properties: {
      messages: { type: "array", items: schemaRef("DiscussionMessage") },
      nextCursor: nullableStringSchema
    },
    additionalProperties: false
  },
  ConversationMessageResponse: {
    type: "object",
    required: ["message"],
    properties: { message: schemaRef("DiscussionMessage") },
    additionalProperties: false
  },
  ConversationMessageCreateResponse: {
    type: "object",
    required: ["message", "mentions"],
    properties: {
      message: schemaRef("DiscussionMessage"),
      mentions: { type: "array", items: schemaRef("MessageMention") }
    },
    additionalProperties: false
  },
  MessageReactionResponse: {
    type: "object",
    required: ["reaction"],
    properties: { reaction: schemaRef("MessageReaction") },
    additionalProperties: false
  },
  ConversationReadStateResponse: {
    type: "object",
    required: ["readState"],
    properties: { readState: schemaRef("ConversationReadState") },
    additionalProperties: false
  },
  UserNotification: {
    type: "object",
    required: ["id", "tenantId", "userId", "notificationType", "sourceEntityType", "sourceEntityId", "title", "body", "route", "createdAt", "readAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      userId: stringIdSchema,
      notificationType: notificationTypeSchema,
      sourceEntityType: schemaRef("CollaborationEntityType"),
      sourceEntityId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      body: { type: "string" },
      route: { type: "string", minLength: 1 },
      createdAt: dateTimeSchema,
      readAt: { type: ["string", "null"], format: "date-time" },
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  NotificationPreference: {
    type: "object",
    required: ["tenantId", "userId", "channel", "notificationType", "enabled", "digestFrequency"],
    properties: {
      tenantId: stringIdSchema,
      userId: stringIdSchema,
      channel: notificationChannelSchema,
      notificationType: notificationTypeSchema,
      enabled: { type: "boolean" },
      digestFrequency: digestFrequencySchema
    },
    additionalProperties: true
  },
  NotificationPreferenceInput: {
    type: "object",
    required: ["channel", "notificationType"],
    properties: {
      channel: notificationChannelSchema,
      notificationType: notificationTypeSchema,
      enabled: { type: "boolean", default: true },
      digestFrequency: digestFrequencySchema
    },
    additionalProperties: false
  },
  NotificationsResponse: {
    type: "object",
    required: ["notifications"],
    properties: { notifications: { type: "array", items: schemaRef("UserNotification") } },
    additionalProperties: false
  },
  NotificationResponse: {
    type: "object",
    required: ["notification"],
    properties: { notification: schemaRef("UserNotification") },
    additionalProperties: false
  },
  NotificationPreferencesResponse: {
    type: "object",
    required: ["preferences"],
    properties: { preferences: { type: "array", items: schemaRef("NotificationPreference") } },
    additionalProperties: false
  },
  NotificationPreferencesReplaceRequest: {
    type: "object",
    required: ["preferences"],
    properties: { preferences: { type: "array", maxItems: 100, items: schemaRef("NotificationPreferenceInput") } },
    additionalProperties: false
  },
  MeetingParticipant: {
    type: "object",
    required: ["tenantId", "meetingId", "userId", "role", "response"],
    properties: {
      tenantId: stringIdSchema,
      meetingId: stringIdSchema,
      userId: stringIdSchema,
      role: meetingParticipantRoleSchema,
      response: meetingParticipantResponseSchema
    },
    additionalProperties: true
  },
  MeetingParticipantInput: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: stringIdSchema,
      role: meetingParticipantRoleSchema
    },
    additionalProperties: false
  },
  Meeting: {
    type: "object",
    required: ["id", "tenantId", "entityType", "entityId", "title", "agenda", "scheduledStart", "scheduledFinish", "status", "createdByUserId", "createdAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      entityType: schemaRef("CollaborationEntityType"),
      entityId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      agenda: nullableStringSchema,
      scheduledStart: dateTimeSchema,
      scheduledFinish: dateTimeSchema,
      status: meetingStatusSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  MeetingCreateRequest: {
    type: "object",
    required: ["entityType", "entityId", "title", "scheduledStart", "scheduledFinish"],
    properties: {
      entityType: schemaRef("CollaborationEntityType"),
      entityId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      agenda: nullableStringSchema,
      scheduledStart: dateTimeSchema,
      scheduledFinish: dateTimeSchema,
      participants: { type: "array", maxItems: 50, items: schemaRef("MeetingParticipantInput") }
    },
    additionalProperties: false
  },
  MeetingPatchRequest: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1 },
      agenda: nullableStringSchema,
      scheduledStart: dateTimeSchema,
      scheduledFinish: dateTimeSchema,
      status: meetingStatusSchema
    },
    additionalProperties: false
  },
  MeetingExternalLink: {
    type: "object",
    required: ["id", "tenantId", "meetingId", "provider", "url", "title", "createdByUserId", "createdAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      meetingId: stringIdSchema,
      provider: meetingExternalLinkProviderSchema,
      url: { type: "string", format: "uri" },
      title: { type: "string", minLength: 1 },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  MeetingExternalLinkCreateRequest: {
    type: "object",
    required: ["provider", "url", "title"],
    properties: {
      provider: meetingExternalLinkProviderSchema,
      url: { type: "string", format: "uri" },
      title: { type: "string", minLength: 1 }
    },
    additionalProperties: false
  },
  MeetingNote: {
    type: "object",
    required: ["id", "tenantId", "meetingId", "authorUserId", "body", "createdAt", "editedAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      meetingId: stringIdSchema,
      authorUserId: stringIdSchema,
      body: { type: "string", minLength: 1 },
      createdAt: dateTimeSchema,
      editedAt: { type: ["string", "null"], format: "date-time" },
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  MeetingActionItem: {
    type: "object",
    required: ["id", "tenantId", "meetingId", "title", "ownerUserId", "dueDate", "targetEntityType", "targetEntityId", "status", "createdByUserId", "createdAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      meetingId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      ownerUserId: stringIdSchema,
      dueDate: planDateOrNullSchema,
      targetEntityType: meetingActionTargetTypeSchema,
      targetEntityId: stringIdSchema,
      status: meetingActionStatusSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  MeetingActionItemCreateRequest: {
    type: "object",
    required: ["title", "ownerUserId"],
    properties: {
      title: { type: "string", minLength: 1 },
      ownerUserId: stringIdSchema,
      dueDate: planDateOrNullSchema,
      targetEntityType: meetingActionTargetTypeSchema,
      targetEntityId: stringIdSchema
    },
    additionalProperties: false
  },
  MeetingNoteCreateRequest: {
    type: "object",
    required: ["body"],
    properties: { body: { type: "string", minLength: 1 } },
    additionalProperties: false
  },
  MeetingsResponse: {
    type: "object",
    required: ["meetings"],
    properties: { meetings: { type: "array", items: schemaRef("Meeting") } },
    additionalProperties: false
  },
  MeetingResponse: {
    type: "object",
    required: ["meeting"],
    properties: { meeting: schemaRef("Meeting") },
    additionalProperties: false
  },
  MeetingCreateResponse: {
    type: "object",
    required: ["meeting", "participants"],
    properties: {
      meeting: schemaRef("Meeting"),
      participants: { type: "array", items: schemaRef("MeetingParticipant") }
    },
    additionalProperties: false
  },
  MeetingExternalLinkResponse: {
    type: "object",
    required: ["externalLink"],
    properties: { externalLink: schemaRef("MeetingExternalLink") },
    additionalProperties: false
  },
  MeetingNoteResponse: {
    type: "object",
    required: ["note"],
    properties: { note: schemaRef("MeetingNote") },
    additionalProperties: false
  },
  MeetingActionItemResponse: {
    type: "object",
    required: ["actionItem"],
    properties: { actionItem: schemaRef("MeetingActionItem") },
    additionalProperties: false
  },
  CommunicationChannelType: communicationChannelTypeSchema,
  CommunicationChannel: {
    type: "object",
    required: ["id", "tenantId", "channelType", "title", "description", "scopeEntityType", "scopeEntityId", "createdByUserId", "createdAt", "updatedAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      channelType: schemaRef("CommunicationChannelType"),
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      scopeEntityType: { type: ["string", "null"], enum: ["project", null] },
      scopeEntityId: nullableStringSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" },
      canManage: { type: "boolean" }
    },
    additionalProperties: false
  },
  CommunicationChannelMember: {
    type: "object",
    required: ["tenantId", "channelId", "userId", "role", "createdByUserId", "createdAt", "archivedAt"],
    properties: {
      tenantId: stringIdSchema,
      channelId: stringIdSchema,
      userId: stringIdSchema,
      role: communicationChannelRoleSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  CommunicationChannelCreateRequest: {
    type: "object",
    required: ["channelType", "title"],
    properties: {
      channelType: schemaRef("CommunicationChannelType"),
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      scopeEntityId: stringIdSchema
    },
    additionalProperties: false
  },
  CommunicationChannelPatchRequest: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      clientUpdatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CommunicationChannelMemberUpsertRequest: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: stringIdSchema,
      role: communicationChannelRoleSchema
    },
    additionalProperties: false
  },
  CommunicationChannelsResponse: {
    type: "object",
    required: ["channels"],
    properties: { channels: { type: "array", items: schemaRef("CommunicationChannel") } },
    additionalProperties: false
  },
  CommunicationChannelResponse: {
    type: "object",
    required: ["channel"],
    properties: { channel: schemaRef("CommunicationChannel") },
    additionalProperties: false
  },
  CommunicationChannelDetailResponse: {
    type: "object",
    required: ["channel", "members"],
    properties: {
      channel: schemaRef("CommunicationChannel"),
      members: { type: "array", items: schemaRef("CommunicationChannelMember") }
    },
    additionalProperties: false
  },
  CommunicationChannelConversationResponse: {
    type: "object",
    required: ["channel", "conversation"],
    properties: {
      channel: schemaRef("CommunicationChannel"),
      conversation: {
        allOf: [
          schemaRef("Conversation"),
          {
            type: "object",
            required: ["readState"],
            properties: { readState: schemaRef("ConversationReadState") },
            additionalProperties: false
          }
        ]
      }
    },
    additionalProperties: false
  },
  CommunicationChannelMemberResponse: {
    type: "object",
    required: ["member"],
    properties: { member: schemaRef("CommunicationChannelMember") },
    additionalProperties: false
  },
  StickerPack: {
    type: "object",
    required: ["id", "tenantId", "title", "description", "source", "status", "createdByUserId", "createdAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      source: stickerPackSourceSchema,
      status: { type: "string", enum: ["ready", "archived"] },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  StickerAsset: {
    type: "object",
    required: ["id", "tenantId", "packId", "fileAssetId", "emoji", "tags", "mimeType", "sizeBytes", "width", "height", "downloadUrl", "createdByUserId", "createdAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      packId: stringIdSchema,
      fileAssetId: stringIdSchema,
      emoji: { type: ["string", "null"], maxLength: 16 },
      tags: { type: "array", items: { type: "string", minLength: 1 } },
      mimeType: { type: "string", enum: ["image/png", "image/webp"] },
      sizeBytes: { type: "integer", minimum: 1, maximum: 2097152 },
      width: { type: "integer", minimum: 1, maximum: 512 },
      height: { type: "integer", minimum: 1, maximum: 512 },
      downloadUrl: { type: "string", minLength: 1 },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  StickerPackWithAssets: {
    allOf: [
      schemaRef("StickerPack"),
      {
        type: "object",
        required: ["stickers"],
        properties: { stickers: { type: "array", items: schemaRef("StickerAsset") } },
        additionalProperties: false
      }
    ]
  },
  StickerPackCreateRequest: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      source: stickerPackSourceSchema
    },
    additionalProperties: false
  },
  StickerImportMultipartRequest: {
    type: "object",
    required: ["file"],
    properties: {
      file: { type: "string", format: "binary" },
      emoji: { type: "string", maxLength: 16 },
      tags: { type: "string", description: "Comma-separated sticker tags." },
      width: { type: "integer", minimum: 1, maximum: 512 },
      height: { type: "integer", minimum: 1, maximum: 512 }
    },
    additionalProperties: false
  },
  StickerPacksResponse: {
    type: "object",
    required: ["stickerPacks"],
    properties: { stickerPacks: { type: "array", items: schemaRef("StickerPackWithAssets") } },
    additionalProperties: false
  },
  StickerPackStickersResponse: {
    type: "object",
    required: ["stickerPack", "stickers"],
    properties: {
      stickerPack: schemaRef("StickerPack"),
      stickers: { type: "array", items: schemaRef("StickerAsset") }
    },
    additionalProperties: false
  },
  StickerPackResponse: {
    type: "object",
    required: ["stickerPack"],
    properties: { stickerPack: schemaRef("StickerPack") },
    additionalProperties: false
  },
  StickerResponse: {
    type: "object",
    required: ["sticker"],
    properties: { sticker: schemaRef("StickerAsset") },
    additionalProperties: false
  },
  CallRoom: {
    type: "object",
    required: ["id", "tenantId", "entityType", "entityId", "meetingId", "title", "mediaKind", "provider", "providerRoomId", "status", "createdByUserId", "createdAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      entityType: schemaRef("CollaborationEntityType"),
      entityId: stringIdSchema,
      meetingId: nullableStringSchema,
      title: { type: "string", minLength: 1 },
      mediaKind: callMediaKindSchema,
      provider: callRoomProviderSchema,
      providerRoomId: nullableStringSchema,
      status: callRoomStatusSchema,
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  CallSession: {
    type: "object",
    required: ["id", "tenantId", "roomId", "status", "startedByUserId", "startedAt", "endedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      roomId: stringIdSchema,
      status: callSessionStatusSchema,
      startedByUserId: stringIdSchema,
      startedAt: dateTimeSchema,
      endedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  CallParticipantState: {
    type: "object",
    required: ["tenantId", "sessionId", "userId", "state", "updatedAt"],
    properties: {
      tenantId: stringIdSchema,
      sessionId: stringIdSchema,
      userId: stringIdSchema,
      state: callParticipantStateSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CallEvent: {
    type: "object",
    required: ["id", "tenantId", "roomId", "sessionId", "eventType", "actorUserId", "payload", "createdAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      roomId: stringIdSchema,
      sessionId: nullableStringSchema,
      eventType: callEventTypeSchema,
      actorUserId: nullableStringSchema,
      payload: schemaRef("AnyJsonObject"),
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CallRecording: {
    type: "object",
    required: [
      "id",
      "roomId",
      "sessionId",
      "recordingGroupId",
      "attachmentId",
      "egressId",
      "participantId",
      "trackId",
      "kind",
      "status",
      "durationSeconds",
      "endedAt",
      "title",
      "createdByUserId",
      "createdAt"
    ],
    properties: {
      id: stringIdSchema,
      roomId: stringIdSchema,
      sessionId: nullableStringSchema,
      recordingGroupId: stringIdSchema,
      // null until the per-track Egress file is reconciled (the recording is in progress).
      attachmentId: nullableStringSchema,
      egressId: nullableStringSchema,
      participantId: nullableStringSchema,
      trackId: nullableStringSchema,
      kind: { type: "string" },
      status: { type: "string" },
      durationSeconds: { type: ["integer", "null"] },
      endedAt: { type: ["string", "null"], format: "date-time" },
      title: { type: "string", minLength: 1 },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CallRoomCreateRequest: {
    type: "object",
    required: ["entityType", "entityId", "title", "provider"],
    properties: {
      entityType: schemaRef("CollaborationEntityType"),
      entityId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      mediaKind: callMediaKindSchema,
      provider: callRoomProviderSchema,
      meetingId: nullableStringSchema,
      providerRoomId: nullableStringSchema
    },
    additionalProperties: false
  },
  CallParticipantStateRequest: {
    type: "object",
    required: ["state"],
    properties: {
      state: callParticipantStateSchema,
      userId: stringIdSchema
    },
    additionalProperties: false
  },
  CallRecordingCreateRequest: {
    type: "object",
    required: ["attachmentId"],
    properties: {
      attachmentId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      sessionId: nullableStringSchema
    },
    additionalProperties: false
  },
  CallRoomsResponse: {
    type: "object",
    required: ["callRooms"],
    properties: { callRooms: { type: "array", items: schemaRef("CallRoom") } },
    additionalProperties: false
  },
  CallRoomCreateResponse: {
    type: "object",
    required: ["callRoom", "event"],
    properties: {
      callRoom: schemaRef("CallRoom"),
      event: schemaRef("CallEvent")
    },
    additionalProperties: false
  },
  CallRoomDetailResponse: {
    type: "object",
    required: ["callRoom", "activeSession", "events", "recordings"],
    properties: {
      callRoom: schemaRef("CallRoom"),
      // The active session a second participant joins; null when the room has none.
      activeSession: { anyOf: [schemaRef("CallSession"), { type: "null" }] },
      events: { type: "array", items: schemaRef("CallEvent") },
      recordings: { type: "array", items: schemaRef("CallRecording") }
    },
    additionalProperties: false
  },
  CallSessionStartResponse: {
    type: "object",
    required: ["callRoom", "session", "event"],
    properties: {
      callRoom: schemaRef("CallRoom"),
      session: schemaRef("CallSession"),
      event: schemaRef("CallEvent")
    },
    additionalProperties: false
  },
  CallJoinTokenResponse: {
    type: "object",
    required: ["join", "event"],
    properties: {
      join: {
        type: "object",
        required: ["provider", "joinUrl", "token", "expiresAt"],
        properties: {
          provider: callRoomProviderSchema,
          joinUrl: { type: "string", format: "uri" },
          token: { type: "string", minLength: 1 },
          expiresAt: dateTimeSchema
        },
        additionalProperties: false
      },
      event: schemaRef("CallEvent")
    },
    additionalProperties: false
  },
  CallParticipantStateResponse: {
    type: "object",
    required: ["participantState", "event"],
    properties: {
      participantState: schemaRef("CallParticipantState"),
      event: { oneOf: [schemaRef("CallEvent"), { type: "null" }] }
    },
    additionalProperties: false
  },
  CallSessionEndResponse: {
    type: "object",
    required: ["callRoom", "session", "event"],
    properties: {
      callRoom: schemaRef("CallRoom"),
      session: schemaRef("CallSession"),
      event: schemaRef("CallEvent")
    },
    additionalProperties: false
  },
  CallRecordingResponse: {
    type: "object",
    required: ["event", "recording"],
    properties: {
      event: schemaRef("CallEvent"),
      recording: schemaRef("CallRecording")
    },
    additionalProperties: false
  },
  CallEventsResponse: {
    type: "object",
    required: ["events"],
    properties: { events: { type: "array", items: schemaRef("CallEvent") } },
    additionalProperties: false
  }
});
