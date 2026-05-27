export const stringIdSchema = { type: "string", minLength: 1 };
export const nullableStringSchema = { type: ["string", "null"] };
export const crmStatusSchema = { type: "string", enum: ["active", "archived"], default: "active" };
export const dateTimeSchema = { type: "string", format: "date-time" };
export const dateSchema = { type: "string", format: "date" };
export const taskPrioritySchema = { type: "string", enum: ["low", "normal", "high", "critical"] };
export const taskStatusCategorySchema = {
  type: "string",
  enum: ["new", "waiting", "in_progress", "review", "done"]
};
export const taskParticipantRoleSchema = {
  type: "string",
  enum: ["executor", "co_executor", "requester", "controller", "approver", "observer"]
};
export const planDateOrNullSchema = { type: ["string", "null"], format: "date" };
export const planningAssignmentRoleSchema = {
  type: "string",
  enum: ["executor", "co_executor", "controller", "approver", "observer"]
};
export const planningTaskTypeSchema = {
  type: "string",
  enum: ["fixed_units", "fixed_work", "fixed_duration"]
};
export const planningSchedulingModeSchema = { type: "string", enum: ["auto", "manual"] };
export const planningDependencyTypeSchema = { type: "string", enum: ["FS", "SS", "FF", "SF"] };
export const planningGranularitySchema = { type: "string", enum: ["day", "week", "month"] };
export const planningScenarioProfileSchema = {
  type: "string",
  enum: ["aggressive", "balanced", "resilient"]
};
export const planningValidationSeveritySchema = { type: "string", enum: ["info", "warning", "error"] };
export const planningConstraintTypeSchema = {
  type: "string",
  enum: [
    "as_soon_as_possible",
    "start_no_earlier_than",
    "finish_no_later_than",
    "must_start_on",
    "must_finish_on"
  ]
};
export const planningCommandTypeSchema = {
  type: "string",
  enum: [
    "task.create",
    "task.update_identity",
    "task.update_schedule",
    "task.update_work_model",
    "task.update_status",
    "task.update_progress",
    "task.move_wbs",
    "task.delete_or_archive",
    "dependency.upsert",
    "dependency.delete",
    "assignment.upsert",
    "assignment.allocations.replace",
    "assignment.delete",
    "baseline.capture",
    "calendar.exception.upsert",
    "constraint.update",
    "resource.reserve",
    "risk.accept_overload",
    "project.deadline.move",
    "project.settings.update",
    "task.update_custom_field"
  ]
};
export const collaborationEntityTypeSchema = {
  type: "string",
  enum: ["project", "task", "opportunity", "communication_channel"]
};
export const conversationTypeSchema = { type: "string", enum: ["default", "meeting_followup"] };
export const notificationTypeSchema = {
  type: "string",
  enum: [
    "mention",
    "assignment_changed",
    "deadline_risk",
    "control_signal",
    "meeting_invite",
    "meeting_action_item"
  ]
};
export const notificationChannelSchema = { type: "string", enum: ["in_app", "email", "telegram"] };
export const digestFrequencySchema = { type: "string", enum: ["none", "hourly", "daily"] };
export const meetingStatusSchema = { type: "string", enum: ["scheduled", "completed", "cancelled"] };
export const meetingParticipantRoleSchema = { type: "string", enum: ["organizer", "required", "optional"] };
export const meetingParticipantResponseSchema = { type: "string", enum: ["pending", "accepted", "declined"] };
export const meetingExternalLinkProviderSchema = { type: "string", enum: ["manual", "google_meet", "microsoft_teams", "zoom", "other"] };
export const meetingActionTargetTypeSchema = { type: "string", enum: ["project", "task", "opportunity"] };
export const meetingActionStatusSchema = { type: "string", enum: ["open", "done", "cancelled"] };
export const communicationChannelTypeSchema = {
  type: "string",
  enum: ["workspace_general", "project_general", "custom"]
};
export const communicationChannelRoleSchema = { type: "string", enum: ["owner", "moderator", "member"] };
export const stickerPackSourceSchema = { type: "string", enum: ["manual", "telegram"] };
export const callRoomProviderSchema = { type: "string", enum: ["internal", "livekit", "jitsi", "external"] };
export const callMediaKindSchema = { type: "string", enum: ["audio", "video"] };
export const callRoomStatusSchema = { type: "string", enum: ["scheduled", "active", "ended", "cancelled"] };
export const callSessionStatusSchema = { type: "string", enum: ["active", "ended", "failed"] };
export const callParticipantStateSchema = {
  type: "string",
  enum: ["invited", "joining", "joined", "muted", "screen_sharing", "left", "declined"]
};
export const callEventTypeSchema = {
  type: "string",
  enum: [
    "room_created",
    "session_started",
    "join_token_issued",
    "participant_state_updated",
    "session_ended",
    "recording_attached"
  ]
};
export const backgroundJobKindSchema = {
  type: "string",
  enum: [
    "notification.dispatch",
    "storage.cleanup_archived_assets",
    "connector.sync",
    "search.rebuild_projection",
    "capacity.cache_warmup"
  ]
};
export const backgroundJobStatusSchema = {
  type: "string",
  enum: ["queued", "running", "succeeded", "failed", "dead", "cancelled"]
};
export const backgroundJobEventTypeSchema = {
  type: "string",
  enum: ["enqueued", "claimed", "succeeded", "failed", "retry_scheduled", "dead", "cancelled"]
};

export const openApiSchemaFragment = <T extends Record<string, unknown>>(schemas: T) => schemas;

export function schemaRef(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}
