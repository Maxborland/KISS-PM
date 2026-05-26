import type { TenantId, UserId } from "./index";
import type { ControlSignal } from "./control/types";
import type { PlanningCommand } from "./planning/planningCommands";
import type { PlanAssignment, PlanSnapshot, PlanTask } from "./planning/types";

export const collaborationEntityTypes = ["project", "task", "opportunity"] as const;
export type CollaborationEntityType = (typeof collaborationEntityTypes)[number];

export const conversationTypes = ["default", "meeting_followup"] as const;
export type ConversationType = (typeof conversationTypes)[number];

export const notificationTypes = [
  "mention",
  "assignment_changed",
  "deadline_risk",
  "control_signal",
  "meeting_invite",
  "meeting_action_item"
] as const;
export type NotificationType = (typeof notificationTypes)[number];

export const notificationChannels = ["in_app", "email", "digest"] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export const digestFrequencies = ["none", "daily", "weekly"] as const;
export type DigestFrequency = (typeof digestFrequencies)[number];

export const meetingStatuses = ["scheduled", "completed", "cancelled"] as const;
export type MeetingStatus = (typeof meetingStatuses)[number];

export const meetingParticipantRoles = ["organizer", "required", "optional"] as const;
export type MeetingParticipantRole = (typeof meetingParticipantRoles)[number];

export const meetingParticipantResponses = ["pending", "accepted", "declined"] as const;
export type MeetingParticipantResponse = (typeof meetingParticipantResponses)[number];

export const meetingExternalLinkProviders = [
  "zoom",
  "teams",
  "google_meet",
  "manual_link",
  "other"
] as const;
export type MeetingExternalLinkProvider = (typeof meetingExternalLinkProviders)[number];

export const meetingActionItemStatuses = ["open", "done", "cancelled"] as const;
export type MeetingActionItemStatus = (typeof meetingActionItemStatuses)[number];

export const meetingActionTargetTypes = [
  "task",
  "corrective_action",
  "project",
  "opportunity"
] as const;
export type MeetingActionTargetType = (typeof meetingActionTargetTypes)[number];

export const callRoomProviders = ["manual", "jitsi", "livekit"] as const;
export type CallRoomProvider = (typeof callRoomProviders)[number];

export const callMediaKinds = ["audio", "video"] as const;
export type CallMediaKind = (typeof callMediaKinds)[number];

export const callRoomStatuses = [
  "scheduled",
  "open",
  "active",
  "ended",
  "cancelled"
] as const;
export type CallRoomStatus = (typeof callRoomStatuses)[number];

export const callSessionStatuses = ["active", "ended", "failed"] as const;
export type CallSessionStatus = (typeof callSessionStatuses)[number];

export const callParticipantStates = [
  "invited",
  "joining",
  "joined",
  "left",
  "removed"
] as const;
export type CallParticipantStateValue = (typeof callParticipantStates)[number];

export const callEventTypes = [
  "room_created",
  "session_started",
  "join_token_issued",
  "participant_invited",
  "participant_joining",
  "participant_joined",
  "participant_left",
  "session_ended",
  "recording_attached"
] as const;
export type CallEventType = (typeof callEventTypes)[number];

export type Conversation = {
  id: string;
  tenantId: TenantId;
  entityType: CollaborationEntityType;
  entityId: string;
  conversationType: ConversationType;
  title: string;
  createdByUserId: UserId;
  createdAt: Date;
  archivedAt: Date | null;
};

export type DiscussionMessage = {
  id: string;
  tenantId: TenantId;
  conversationId: string;
  authorUserId: UserId;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  editedAt: Date | null;
  archivedAt: Date | null;
  pinnedAt: Date | null;
  pinnedByUserId: UserId | null;
};

export type MessageMention = {
  tenantId: TenantId;
  messageId: string;
  mentionedUserId: UserId;
  createdAt: Date;
};

export type ConversationReadState = {
  tenantId: TenantId;
  conversationId: string;
  userId: UserId;
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  unreadCount: number;
};

export type UserNotification = {
  id: string;
  tenantId: TenantId;
  userId: UserId;
  notificationType: NotificationType;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  body: string;
  route: string;
  createdAt: Date;
  readAt: Date | null;
  archivedAt: Date | null;
};

export type DerivedNotification = {
  userId: UserId;
  notificationType: NotificationType;
  sourceEntityType: CollaborationEntityType;
  sourceEntityId: string;
  title: string;
  body: string;
  route: string;
};

export type NotificationPreference = {
  tenantId: TenantId;
  userId: UserId;
  channel: NotificationChannel;
  notificationType: NotificationType;
  enabled: boolean;
  digestFrequency: DigestFrequency;
};

export type Meeting = {
  id: string;
  tenantId: TenantId;
  entityType: CollaborationEntityType;
  entityId: string;
  title: string;
  agenda: string;
  scheduledStart: Date;
  scheduledFinish: Date;
  status: MeetingStatus;
  createdByUserId: UserId;
  createdAt: Date;
  archivedAt: Date | null;
};

export type MeetingParticipant = {
  tenantId: TenantId;
  meetingId: string;
  userId: UserId;
  role: MeetingParticipantRole;
  response: MeetingParticipantResponse;
  createdAt: Date;
};

export type MeetingExternalLink = {
  id: string;
  tenantId: TenantId;
  meetingId: string;
  provider: MeetingExternalLinkProvider;
  url: string;
  title: string;
  createdByUserId: UserId;
  createdAt: Date;
  archivedAt: Date | null;
};

export type MeetingNote = {
  id: string;
  tenantId: TenantId;
  meetingId: string;
  authorUserId: UserId;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  archivedAt: Date | null;
};

export type MeetingActionItem = {
  id: string;
  tenantId: TenantId;
  meetingId: string;
  title: string;
  ownerUserId: UserId;
  dueDate: string | null;
  targetEntityType: MeetingActionTargetType;
  targetEntityId: string;
  status: MeetingActionItemStatus;
  createdByUserId: UserId;
  createdAt: Date;
  archivedAt: Date | null;
};

export type CallRoom = {
  id: string;
  tenantId: TenantId;
  entityType: CollaborationEntityType;
  entityId: string;
  meetingId: string | null;
  title: string;
  mediaKind: CallMediaKind;
  provider: CallRoomProvider;
  providerRoomId: string;
  status: CallRoomStatus;
  createdByUserId: UserId;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type CallSession = {
  id: string;
  tenantId: TenantId;
  roomId: string;
  providerSessionId: string | null;
  status: CallSessionStatus;
  startedByUserId: UserId;
  startedAt: Date;
  endedByUserId: UserId | null;
  endedAt: Date | null;
  failureReason: string | null;
};

export type CallParticipantState = {
  tenantId: TenantId;
  roomId: string;
  sessionId: string;
  userId: UserId;
  state: CallParticipantStateValue;
  joinedAt: Date | null;
  leftAt: Date | null;
  lastSeenAt: Date;
};

export type CallEvent = {
  id: string;
  tenantId: TenantId;
  roomId: string;
  sessionId: string | null;
  eventType: CallEventType;
  actorUserId: UserId;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type CallRecording = {
  id: string;
  tenantId: TenantId;
  roomId: string;
  sessionId: string | null;
  attachmentId: string;
  title: string;
  createdByUserId: UserId;
  createdAt: Date;
  archivedAt: Date | null;
};

export type CollaborationParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const maxIdLength = 200;
const maxTitleLength = 180;
const maxMessageBodyLength = 8000;
const maxNoteBodyLength = 12000;
const maxAgendaLength = 12000;
const maxProviderRoomIdLength = 200;
const controlCharacterPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const mentionPattern = /@([a-zA-Z0-9][a-zA-Z0-9._:-]{1,120})/g;

export function parseCollaborationEntityType(
  value: unknown
): CollaborationParseResult<CollaborationEntityType> {
  if (
    typeof value === "string" &&
    collaborationEntityTypes.includes(value as CollaborationEntityType)
  ) {
    return { ok: true, value: value as CollaborationEntityType };
  }
  return { ok: false, error: "collaboration_entity_type_invalid" };
}

export function parseCollaborationId(
  value: unknown,
  error = "collaboration_id_invalid"
): CollaborationParseResult<string> {
  if (typeof value !== "string") return { ok: false, error };
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > maxIdLength ||
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    /[\\/]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return { ok: false, error };
  }
  return { ok: true, value: trimmed };
}

export function parseConversationTitle(value: unknown): CollaborationParseResult<string> {
  return parseBoundedText(value, {
    emptyError: "conversation_title_required",
    invalidError: "conversation_title_invalid",
    maxLength: maxTitleLength
  });
}

export function parseMessageBody(value: unknown): CollaborationParseResult<string> {
  return parseBoundedText(value, {
    emptyError: "message_body_required",
    invalidError: "message_body_invalid",
    maxLength: maxMessageBodyLength
  });
}

export function parseMeetingTitle(value: unknown): CollaborationParseResult<string> {
  return parseBoundedText(value, {
    emptyError: "meeting_title_required",
    invalidError: "meeting_title_invalid",
    maxLength: maxTitleLength
  });
}

export function parseMeetingAgenda(value: unknown): CollaborationParseResult<string> {
  if (value === undefined || value === null) return { ok: true, value: "" };
  return parseBoundedText(value, {
    emptyError: "meeting_agenda_invalid",
    invalidError: "meeting_agenda_invalid",
    maxLength: maxAgendaLength,
    allowEmpty: true
  });
}

export function parseMeetingNoteBody(value: unknown): CollaborationParseResult<string> {
  return parseBoundedText(value, {
    emptyError: "meeting_note_body_required",
    invalidError: "meeting_note_body_invalid",
    maxLength: maxNoteBodyLength
  });
}

export function parseMeetingStatus(value: unknown): CollaborationParseResult<MeetingStatus> {
  if (typeof value === "string" && meetingStatuses.includes(value as MeetingStatus)) {
    return { ok: true, value: value as MeetingStatus };
  }
  return { ok: false, error: "meeting_status_invalid" };
}

export function parseMeetingExternalLinkProvider(
  value: unknown
): CollaborationParseResult<MeetingExternalLinkProvider> {
  if (
    typeof value === "string" &&
    meetingExternalLinkProviders.includes(value as MeetingExternalLinkProvider)
  ) {
    return { ok: true, value: value as MeetingExternalLinkProvider };
  }
  return { ok: false, error: "meeting_external_link_provider_invalid" };
}

export function parseMeetingActionTargetType(
  value: unknown
): CollaborationParseResult<MeetingActionTargetType> {
  if (
    typeof value === "string" &&
    meetingActionTargetTypes.includes(value as MeetingActionTargetType)
  ) {
    return { ok: true, value: value as MeetingActionTargetType };
  }
  return { ok: false, error: "meeting_action_target_type_invalid" };
}

export function parseCallRoomProvider(
  value: unknown
): CollaborationParseResult<CallRoomProvider> {
  if (typeof value === "string" && callRoomProviders.includes(value as CallRoomProvider)) {
    return { ok: true, value: value as CallRoomProvider };
  }
  return { ok: false, error: "call_room_provider_invalid" };
}

export function parseCallMediaKind(value: unknown): CollaborationParseResult<CallMediaKind> {
  if (typeof value === "string" && callMediaKinds.includes(value as CallMediaKind)) {
    return { ok: true, value: value as CallMediaKind };
  }
  return { ok: false, error: "call_media_kind_invalid" };
}

export function parseCallRoomStatus(value: unknown): CollaborationParseResult<CallRoomStatus> {
  if (typeof value === "string" && callRoomStatuses.includes(value as CallRoomStatus)) {
    return { ok: true, value: value as CallRoomStatus };
  }
  return { ok: false, error: "call_room_status_invalid" };
}

export function parseCallSessionStatus(
  value: unknown
): CollaborationParseResult<CallSessionStatus> {
  if (typeof value === "string" && callSessionStatuses.includes(value as CallSessionStatus)) {
    return { ok: true, value: value as CallSessionStatus };
  }
  return { ok: false, error: "call_session_status_invalid" };
}

export function parseCallParticipantState(
  value: unknown
): CollaborationParseResult<CallParticipantStateValue> {
  if (typeof value === "string" && callParticipantStates.includes(value as CallParticipantStateValue)) {
    return { ok: true, value: value as CallParticipantStateValue };
  }
  return { ok: false, error: "call_participant_state_invalid" };
}

export function parseCallTitle(value: unknown): CollaborationParseResult<string> {
  return parseBoundedText(value, {
    emptyError: "call_title_required",
    invalidError: "call_title_invalid",
    maxLength: maxTitleLength
  });
}

export function parseProviderRoomId(value: unknown): CollaborationParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "provider_room_id_invalid" };
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > maxProviderRoomIdLength ||
    controlCharacterPattern.test(trimmed) ||
    /[\\]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return { ok: false, error: "provider_room_id_invalid" };
  }
  return { ok: true, value: trimmed };
}

export function parseNotificationChannel(
  value: unknown
): CollaborationParseResult<NotificationChannel> {
  if (typeof value === "string" && notificationChannels.includes(value as NotificationChannel)) {
    return { ok: true, value: value as NotificationChannel };
  }
  return { ok: false, error: "notification_channel_invalid" };
}

export function parseNotificationType(
  value: unknown
): CollaborationParseResult<NotificationType> {
  if (typeof value === "string" && notificationTypes.includes(value as NotificationType)) {
    return { ok: true, value: value as NotificationType };
  }
  return { ok: false, error: "notification_type_invalid" };
}

export function parseDigestFrequency(
  value: unknown
): CollaborationParseResult<DigestFrequency> {
  if (typeof value === "string" && digestFrequencies.includes(value as DigestFrequency)) {
    return { ok: true, value: value as DigestFrequency };
  }
  return { ok: false, error: "digest_frequency_invalid" };
}

export function extractMentionedUserIds(body: string): UserId[] {
  const mentioned = new Set<UserId>();
  for (const match of body.matchAll(mentionPattern)) {
    const id = match[1]?.trim();
    if (id) mentioned.add(id);
  }
  return [...mentioned];
}

export function derivePlanningNotifications(input: {
  actorUserId: UserId;
  beforeSnapshot: PlanSnapshot;
  afterSnapshot: PlanSnapshot;
  commands: PlanningCommand[];
}): DerivedNotification[] {
  const notifications: DerivedNotification[] = [];
  for (const command of input.commands) {
    if (isAssignmentNotificationCommand(command)) {
      for (const userId of recipientUserIdsForAssignmentCommand(
        input.beforeSnapshot,
        input.afterSnapshot,
        command
      )) {
        pushUniqueNotification(notifications, {
          userId,
          notificationType: "assignment_changed",
          sourceEntityType: "project",
          sourceEntityId: input.afterSnapshot.projectId,
          title: "Изменилось назначение",
          body: assignmentNotificationBody(input.beforeSnapshot, input.afterSnapshot, command),
          route: projectRoute(input.afterSnapshot.projectId)
        }, input.actorUserId);
      }
    }

    if (isTaskChangeNotificationCommand(command)) {
      const taskId = taskIdForTaskChangeCommand(command);
      const task = input.afterSnapshot.tasks.find((candidate) => candidate.id === taskId);
      if (!task) continue;
      for (const userId of assignedUserIds(input.afterSnapshot, task.id)) {
        pushUniqueNotification(notifications, {
          userId,
          notificationType: "assignment_changed",
          sourceEntityType: "project",
          sourceEntityId: input.afterSnapshot.projectId,
          title: "Изменилась задача",
          body: task.title,
          route: projectRoute(input.afterSnapshot.projectId)
        }, input.actorUserId);
      }
    }

    if (isDeadlineRiskNotificationCommand(command)) {
      for (const userId of projectParticipantUserIds(input.afterSnapshot)) {
        pushUniqueNotification(notifications, {
          userId,
          notificationType: "deadline_risk",
          sourceEntityType: "project",
          sourceEntityId: input.afterSnapshot.projectId,
          title: "Изменился риск по срокам",
          body: deadlineRiskNotificationBody(input.afterSnapshot, command),
          route: projectRoute(input.afterSnapshot.projectId)
        }, input.actorUserId);
      }
    }
  }
  return notifications;
}

export function deriveControlSignalNotifications(input: {
  actorUserId: UserId;
  snapshot: PlanSnapshot;
  signals: ControlSignal[];
  previousSignals?: ControlSignal[];
}): DerivedNotification[] {
  const notifications: DerivedNotification[] = [];
  const previousById = new Map(input.previousSignals?.map((signal) => [signal.id, signal]));
  for (const signal of input.signals) {
    if (!isNewlyOpenSignal(signal, previousById.get(signal.id))) continue;
    const recipients = signal.ownerUserId
      ? [signal.ownerUserId]
      : projectParticipantUserIds(input.snapshot);
    for (const userId of recipients) {
      pushUniqueNotification(notifications, {
        userId,
        notificationType: "control_signal",
        sourceEntityType: "project",
        sourceEntityId: signal.projectId,
        title: "Новый control signal",
        body: signal.explanation,
        route: `${projectRoute(signal.projectId)}?controlSignalId=${encodeURIComponent(signal.id)}`
      }, input.actorUserId);
    }
  }
  return notifications;
}

function parseBoundedText(
  value: unknown,
  input: {
    emptyError: string;
    invalidError: string;
    maxLength: number;
    allowEmpty?: boolean;
  }
): CollaborationParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: input.emptyError };
  if (controlCharacterPattern.test(value)) return { ok: false, error: input.invalidError };
  const trimmed = value.trim().replace(/\r\n/g, "\n");
  if (!trimmed && !input.allowEmpty) return { ok: false, error: input.emptyError };
  if (trimmed.length > input.maxLength) return { ok: false, error: input.invalidError };
  return { ok: true, value: trimmed };
}

function isAssignmentNotificationCommand(
  command: PlanningCommand
): command is Extract<PlanningCommand, { type: "task.create" | "assignment.upsert" | "assignment.delete" }> {
  return command.type === "task.create" || command.type === "assignment.upsert" || command.type === "assignment.delete";
}

function isTaskChangeNotificationCommand(command: PlanningCommand): boolean {
  return (
    command.type === "task.update_identity" ||
    command.type === "task.update_schedule" ||
    command.type === "task.update_work_model" ||
    command.type === "task.update_status" ||
    command.type === "task.update_progress" ||
    command.type === "task.move_wbs" ||
    command.type === "task.update_custom_field"
  );
}

function taskIdForTaskChangeCommand(command: PlanningCommand): string {
  return "taskId" in command.payload ? String(command.payload.taskId) : "";
}

function isDeadlineRiskNotificationCommand(command: PlanningCommand): boolean {
  return command.type === "project.deadline.move" || command.type === "risk.accept_overload";
}

function recipientUserIdsForAssignmentCommand(
  beforeSnapshot: PlanSnapshot,
  afterSnapshot: PlanSnapshot,
  command: PlanningCommand
): UserId[] {
  if (command.type === "task.create") {
    return uniqueUserIds(command.payload.assignments.map((assignment) => userIdForResource(afterSnapshot, assignment.resourceId)));
  }
  if (command.type === "assignment.upsert") {
    return uniqueUserIds([userIdForResource(afterSnapshot, command.payload.resourceId)]);
  }
  if (command.type === "assignment.delete") {
    const assignment = beforeSnapshot.assignments.find((candidate) => candidate.id === command.payload.assignmentId);
    return assignment ? uniqueUserIds([userIdForResource(beforeSnapshot, assignment.resourceId)]) : [];
  }
  return [];
}

function assignmentNotificationBody(
  beforeSnapshot: PlanSnapshot,
  afterSnapshot: PlanSnapshot,
  command: PlanningCommand
): string {
  const task = taskForAssignmentCommand(beforeSnapshot, afterSnapshot, command);
  return task ? task.title : "План проекта обновлен";
}

function taskForAssignmentCommand(
  beforeSnapshot: PlanSnapshot,
  afterSnapshot: PlanSnapshot,
  command: PlanningCommand
): PlanTask | undefined {
  if (command.type === "task.create") return afterSnapshot.tasks.find((task) => task.id === command.payload.id);
  if (command.type === "assignment.upsert") return afterSnapshot.tasks.find((task) => task.id === command.payload.taskId);
  if (command.type === "assignment.delete") {
    const assignment = beforeSnapshot.assignments.find((candidate) => candidate.id === command.payload.assignmentId);
    return assignment ? beforeSnapshot.tasks.find((task) => task.id === assignment.taskId) : undefined;
  }
  return undefined;
}

function assignedUserIds(snapshot: PlanSnapshot, taskId: string): UserId[] {
  return uniqueUserIds(
    snapshot.assignments
      .filter((assignment) => assignment.taskId === taskId && isWorkAssignment(assignment))
      .map((assignment) => userIdForResource(snapshot, assignment.resourceId))
  );
}

function projectParticipantUserIds(snapshot: PlanSnapshot): UserId[] {
  return uniqueUserIds(
    snapshot.assignments
      .filter(isWorkAssignment)
      .map((assignment) => userIdForResource(snapshot, assignment.resourceId))
  );
}

function isWorkAssignment(assignment: PlanAssignment): boolean {
  return assignment.role === "executor" || assignment.role === "co_executor";
}

function userIdForResource(snapshot: PlanSnapshot, resourceId: string): UserId | null {
  return snapshot.resources.find((resource) => resource.id === resourceId)?.userId ?? null;
}

function uniqueUserIds(values: Array<UserId | null | undefined>): UserId[] {
  return [...new Set(values.filter((value): value is UserId => typeof value === "string" && value.length > 0))];
}

function isNewlyOpenSignal(signal: ControlSignal, previous: ControlSignal | undefined): boolean {
  return signal.status === "open" && previous?.status !== "open";
}

function pushUniqueNotification(
  notifications: DerivedNotification[],
  notification: DerivedNotification,
  actorUserId: UserId
): void {
  if (notification.userId === actorUserId) return;
  const duplicate = notifications.some((candidate) =>
    candidate.userId === notification.userId &&
    candidate.notificationType === notification.notificationType &&
    candidate.sourceEntityType === notification.sourceEntityType &&
    candidate.sourceEntityId === notification.sourceEntityId &&
    candidate.title === notification.title &&
    candidate.body === notification.body
  );
  if (!duplicate) notifications.push(notification);
}

function deadlineRiskNotificationBody(snapshot: PlanSnapshot, command: PlanningCommand): string {
  if (command.type === "project.deadline.move") {
    return `Дедлайн проекта изменен на ${command.payload.deadline ?? "без дедлайна"}`;
  }
  return `Принят риск перегрузки в плане ${snapshot.projectId}`;
}

function projectRoute(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}
