export type PersistenceTableName =
  | "tenants"
  | "access_profiles"
  | "positions"
  | "custom_field_definitions"
  | "project_templates"
  | "clients"
  | "contacts"
  | "products"
  | "project_types"
  | "crm_pipelines"
  | "crm_pipeline_stages"
  | "crm_pipeline_transition_rules"
  | "crm_pipeline_stage_automation_definitions"
  | "opportunities"
  | "opportunity_demands"
  | "projects"
  | "project_position_demands"
  | "task_statuses"
  | "tasks"
  | "plan_versions"
  | "project_calendars"
  | "resource_calendars"
  | "calendar_exceptions"
  | "task_assignments"
  | "task_assignment_allocations"
  | "task_dependencies"
  | "project_baselines"
  | "project_baseline_tasks"
  | "project_baseline_assignments"
  | "resource_reservations"
  | "planning_scenario_runs"
  | "planning_solver_runs"
  | "planning_command_idempotency_keys"
  | "kpi_definitions"
  | "kpi_evaluations"
  | "control_signals"
  | "corrective_actions"
  | "action_executions"
  | "project_closure_snapshots"
  | "retrospective_lessons"
  | "template_improvement_actions"
  | "control_surface_definitions"
  | "control_surface_versions"
  | "tenant_production_calendars"
  | "tenant_production_calendar_exceptions"
  | "planning_saved_views"
  | "resource_absences"
  | "resource_personal_calendars"
  | "resource_calendar_events"
  | "tenant_org_nodes"
  | "tenant_user_org_placements"
  | "file_assets"
  | "external_references"
  | "entity_attachments"
  | "background_job_schedules"
  | "background_job_runs"
  | "background_job_events"
  | "communication_channels"
  | "communication_channel_members"
  | "conversations"
  | "discussion_messages"
  | "message_reactions"
  | "sticker_packs"
  | "sticker_assets"
  | "message_stickers"
  | "message_mentions"
  | "conversation_read_states"
  | "user_notifications"
  | "notification_preferences"
  | "meetings"
  | "meeting_participants"
  | "meeting_external_links"
  | "meeting_notes"
  | "meeting_action_items"
  | "call_rooms"
  | "call_sessions"
  | "call_participant_states"
  | "call_events"
  | "call_recordings"
  | "knowledge_documents"
  | "knowledge_document_versions"
  | "decision_log_entries"
  | "knowledge_action_items"
  | "task_participants"
  | "task_activities"
  | "crm_activities"
  | "tenant_users"
  | "user_credentials"
  | "user_sessions"
  | "password_reset_tokens"
  | "audit_events";

export type TenantOwnedTableName = Exclude<PersistenceTableName, "tenants">;

export type AuditSourceEntity = {
  type: string;
  id: string;
};

export const persistenceTableNames: readonly PersistenceTableName[] = [
  "tenants",
  "access_profiles",
  "positions",
  "custom_field_definitions",
  "project_templates",
  "clients",
  "contacts",
  "products",
  "project_types",
  "crm_pipelines",
  "crm_pipeline_stages",
  "crm_pipeline_transition_rules",
  "crm_pipeline_stage_automation_definitions",
  "opportunities",
  "opportunity_demands",
  "projects",
  "project_position_demands",
  "task_statuses",
  "tasks",
  "plan_versions",
  "project_calendars",
  "resource_calendars",
  "calendar_exceptions",
  "task_assignments",
  "task_assignment_allocations",
  "task_dependencies",
  "project_baselines",
  "project_baseline_tasks",
  "project_baseline_assignments",
  "resource_reservations",
  "planning_scenario_runs",
  "planning_solver_runs",
  "planning_command_idempotency_keys",
  "kpi_definitions",
  "kpi_evaluations",
  "control_signals",
  "corrective_actions",
  "action_executions",
  "project_closure_snapshots",
  "retrospective_lessons",
  "template_improvement_actions",
  "control_surface_definitions",
  "control_surface_versions",
  "tenant_production_calendars",
  "tenant_production_calendar_exceptions",
  "planning_saved_views",
  "resource_absences",
  "resource_personal_calendars",
  "resource_calendar_events",
  "tenant_org_nodes",
  "tenant_user_org_placements",
  "file_assets",
  "external_references",
  "entity_attachments",
  "background_job_schedules",
  "background_job_runs",
  "background_job_events",
  "communication_channels",
  "communication_channel_members",
  "conversations",
  "discussion_messages",
  "message_reactions",
  "sticker_packs",
  "sticker_assets",
  "message_stickers",
  "message_mentions",
  "conversation_read_states",
  "user_notifications",
  "notification_preferences",
  "meetings",
  "meeting_participants",
  "meeting_external_links",
  "meeting_notes",
  "meeting_action_items",
  "call_rooms",
  "call_sessions",
  "call_participant_states",
  "call_events",
  "call_recordings",
  "knowledge_documents",
  "knowledge_document_versions",
  "decision_log_entries",
  "knowledge_action_items",
  "task_participants",
  "task_activities",
  "crm_activities",
  "tenant_users",
  "user_credentials",
  "user_sessions",
  "password_reset_tokens",
  "audit_events"
];

export const tenantOwnedTableNames: readonly TenantOwnedTableName[] = [
  "access_profiles",
  "positions",
  "custom_field_definitions",
  "project_templates",
  "clients",
  "contacts",
  "products",
  "project_types",
  "crm_pipelines",
  "crm_pipeline_stages",
  "crm_pipeline_transition_rules",
  "crm_pipeline_stage_automation_definitions",
  "opportunities",
  "opportunity_demands",
  "projects",
  "project_position_demands",
  "task_statuses",
  "tasks",
  "plan_versions",
  "project_calendars",
  "resource_calendars",
  "calendar_exceptions",
  "task_assignments",
  "task_assignment_allocations",
  "task_dependencies",
  "project_baselines",
  "project_baseline_tasks",
  "project_baseline_assignments",
  "resource_reservations",
  "planning_scenario_runs",
  "planning_solver_runs",
  "planning_command_idempotency_keys",
  "kpi_definitions",
  "kpi_evaluations",
  "control_signals",
  "corrective_actions",
  "action_executions",
  "project_closure_snapshots",
  "retrospective_lessons",
  "template_improvement_actions",
  "control_surface_definitions",
  "control_surface_versions",
  "tenant_production_calendars",
  "tenant_production_calendar_exceptions",
  "planning_saved_views",
  "resource_absences",
  "resource_personal_calendars",
  "resource_calendar_events",
  "tenant_org_nodes",
  "tenant_user_org_placements",
  "file_assets",
  "external_references",
  "entity_attachments",
  "background_job_schedules",
  "background_job_runs",
  "background_job_events",
  "communication_channels",
  "communication_channel_members",
  "conversations",
  "discussion_messages",
  "message_reactions",
  "sticker_packs",
  "sticker_assets",
  "message_stickers",
  "message_mentions",
  "conversation_read_states",
  "user_notifications",
  "notification_preferences",
  "meetings",
  "meeting_participants",
  "meeting_external_links",
  "meeting_notes",
  "meeting_action_items",
  "call_rooms",
  "call_sessions",
  "call_participant_states",
  "call_events",
  "call_recordings",
  "knowledge_documents",
  "knowledge_document_versions",
  "decision_log_entries",
  "knowledge_action_items",
  "task_participants",
  "task_activities",
  "crm_activities",
  "tenant_users",
  "user_credentials",
  "user_sessions",
  "password_reset_tokens",
  "audit_events"
];

const tableColumns = {
  tenants: ["id", "name", "created_at"],
  access_profiles: ["id", "tenant_id", "name", "permissions", "created_at"],
  positions: ["id", "tenant_id", "name", "description", "created_at"],
  custom_field_definitions: [
    "id",
    "tenant_id",
    "system_key",
    "tenant_label",
    "target_entity",
    "field_type",
    "required",
    "status",
    "created_at",
    "updated_at"
  ],
  project_templates: [
    "id",
    "tenant_id",
    "system_key",
    "tenant_label",
    "description",
    "status",
    "created_at",
    "updated_at"
  ],
  clients: [
    "id",
    "tenant_id",
    "name",
    "description",
    "status",
    "created_at",
    "updated_at"
  ],
  contacts: [
    "id",
    "tenant_id",
    "client_id",
    "name",
    "email",
    "phone",
    "telegram",
    "role",
    "status",
    "created_at",
    "updated_at"
  ],
  products: [
    "id",
    "tenant_id",
    "name",
    "sku",
    "type",
    "unit",
    "price",
    "description",
    "status",
    "created_at",
    "updated_at"
  ],
  project_types: [
    "id",
    "tenant_id",
    "name",
    "description",
    "status",
    "created_at",
    "updated_at"
  ],
  crm_pipelines: [
    "id",
    "tenant_id",
    "name",
    "description",
    "is_default",
    "sort_order",
    "status",
    "lifecycle_graph_metadata",
    "created_at",
    "updated_at"
  ],
  crm_pipeline_stages: [
    "id",
    "tenant_id",
    "pipeline_id",
    "name",
    "sort_order",
    "status",
    "lifecycle_state",
    "is_final",
    "created_at",
    "updated_at"
  ],
  crm_pipeline_transition_rules: [
    "id",
    "tenant_id",
    "pipeline_id",
    "from_stage_id",
    "to_stage_id",
    "required_permission",
    "required_fields",
    "require_reason",
    "require_feasibility_ok",
    "min_probability",
    "guard_note",
    "status",
    "created_at",
    "updated_at"
  ],
  crm_pipeline_stage_automation_definitions: [
    "id",
    "tenant_id",
    "pipeline_id",
    "stage_id",
    "trigger",
    "action_type",
    "action_config",
    "status",
    "created_at",
    "updated_at"
  ],
  opportunities: [
    "id",
    "tenant_id",
    "client_id",
    "primary_contact_id",
    "owner_user_id",
    "project_type_id",
    "stage_id",
    "pipeline_id",
    "client_name",
    "contact_name",
    "title",
    "project_type",
    "description",
    "planned_start",
    "planned_finish",
    "contract_value",
    "planned_hourly_rate",
    "planned_hours",
    "probability",
    "status",
    "template_id",
    "feasibility_status",
    "feasibility_result",
    "feasibility_checked_at",
    "custom_field_values",
    "created_at",
    "updated_at"
  ],
  opportunity_demands: [
    "tenant_id",
    "opportunity_id",
    "position_id",
    "required_hours"
  ],
  projects: [
    "id",
    "tenant_id",
    "source_type",
    "source_opportunity_id",
    "client_id",
    "project_type_id",
    "title",
    "client_name",
    "status",
    "planned_start",
    "planned_finish",
    "deadline",
    "calendar_id",
    "contract_value",
    "planned_hours",
    "template_id",
    "created_at",
    "activated_at",
    "closed_at"
  ],
  project_position_demands: [
    "tenant_id",
    "project_id",
    "position_id",
    "required_hours"
  ],
  task_statuses: [
    "id",
    "tenant_id",
    "name",
    "category",
    "sort_order",
    "status",
    "is_system",
    "created_at",
    "updated_at"
  ],
  tasks: [
    "id",
    "tenant_id",
    "project_id",
    "stage_id",
    "title",
    "description",
    "status",
    "status_id",
    "priority",
    "requester_user_id",
    "owner_user_id",
    "planned_start",
    "planned_finish",
    "planned_start_minute",
    "planned_finish_minute",
    "parent_task_id",
    "wbs_code",
    "scheduling_mode",
    "task_type",
    "effort_driven",
    "duration_minutes",
    "work_minutes",
    "constraint_type",
    "constraint_date",
    "duration_working_days",
    "planned_work",
    "actual_work",
    "progress",
    "requires_acceptance",
    "source",
    "custom_fields",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  plan_versions: ["tenant_id", "project_id", "version", "updated_at"],
  project_calendars: [
    "id",
    "tenant_id",
    "project_id",
    "working_weekdays",
    "working_minutes_per_day",
    "created_at",
    "updated_at"
  ],
  resource_calendars: [
    "id",
    "tenant_id",
    "resource_id",
    "working_weekdays",
    "working_minutes_per_day",
    "created_at",
    "updated_at"
  ],
  calendar_exceptions: [
    "id",
    "tenant_id",
    "project_id",
    "calendar_id",
    "resource_id",
    "date",
    "working_minutes",
    "reason",
    "created_at",
    "updated_at"
  ],
  task_assignments: [
    "id",
    "tenant_id",
    "project_id",
    "task_id",
    "resource_id",
    "role",
    "units_permille",
    "work_minutes",
    "calendar_id"
  ],
  task_assignment_allocations: [
    "id",
    "tenant_id",
    "project_id",
    "assignment_id",
    "task_id",
    "resource_id",
    "date",
    "work_minutes",
    "created_at",
    "updated_at"
  ],
  task_dependencies: [
    "id",
    "tenant_id",
    "project_id",
    "predecessor_task_id",
    "successor_task_id",
    "type",
    "lag_minutes"
  ],
  project_baselines: ["id", "tenant_id", "project_id", "label", "captured_at"],
  project_baseline_tasks: [
    "tenant_id",
    "project_id",
    "baseline_id",
    "task_id",
    "planned_start",
    "planned_finish",
    "work_minutes"
  ],
  project_baseline_assignments: [
    "tenant_id",
    "project_id",
    "baseline_id",
    "assignment_id",
    "task_id",
    "resource_id",
    "work_minutes"
  ],
  resource_reservations: [
    "id",
    "tenant_id",
    "project_id",
    "resource_id",
    "start",
    "finish",
    "work_minutes",
    "reason"
  ],
  planning_scenario_runs: [
    "id",
    "tenant_id",
    "project_id",
    "plan_version",
    "engine_version",
    "target_conflict",
    "proposal_payload",
    "proposal_payload_hash",
    "actor_user_id",
    "expires_at",
    "applied_at",
    "created_at"
  ],
  planning_solver_runs: [
    "id",
    "tenant_id",
    "project_id",
    "mode",
    "client_plan_version",
    "engine_version",
    "input_snapshot_metadata",
    "target_deadline",
    "proposals",
    "proposal_payload_hash",
    "actor_user_id",
    "expires_at",
    "applied_proposal_id",
    "applied_at",
    "created_at"
  ],
  planning_command_idempotency_keys: [
    "tenant_id",
    "project_id",
    "idempotency_key",
    "request_hash",
    "response_payload",
    "actor_user_id",
    "created_at"
  ],
  kpi_definitions: [
    "id",
    "tenant_id",
    "entity_type",
    "code",
    "label",
    "formula",
    "unit",
    "period",
    "threshold_rules",
    "owner_role",
    "allowed_actions",
    "version",
    "status",
    "created_at",
    "updated_at"
  ],
  kpi_evaluations: [
    "id",
    "tenant_id",
    "project_id",
    "definition_id",
    "definition_version",
    "formula_version",
    "source_data",
    "period_start",
    "period_end",
    "threshold",
    "calculated_value",
    "severity",
    "evaluated_at"
  ],
  control_signals: [
    "id",
    "tenant_id",
    "project_id",
    "evaluation_id",
    "source_entity",
    "source_metric",
    "severity",
    "explanation",
    "owner_user_id",
    "allowed_actions",
    "scenario_proposals",
    "status",
    "created_at",
    "updated_at",
    "resolved_at"
  ],
  corrective_actions: [
    "id",
    "tenant_id",
    "project_id",
    "control_signal_id",
    "title",
    "description",
    "responsible_user_id",
    "due_date",
    "status",
    "result",
    "created_at",
    "updated_at"
  ],
  action_executions: [
    "id",
    "tenant_id",
    "project_id",
    "action_type",
    "target_entity",
    "actor_user_id",
    "input",
    "preview_payload",
    "result_payload",
    "status",
    "audit_event_id",
    "created_at"
  ],
  project_closure_snapshots: [
    "id",
    "tenant_id",
    "project_id",
    "project_status_before",
    "plan_version",
    "snapshot_payload",
    "plan_fact_summary",
    "closed_by_user_id",
    "closed_at",
    "close_reason",
    "audit_event_id"
  ],
  retrospective_lessons: [
    "id",
    "tenant_id",
    "project_id",
    "snapshot_id",
    "category",
    "title",
    "body",
    "impact",
    "created_by_user_id",
    "created_at"
  ],
  template_improvement_actions: [
    "id",
    "tenant_id",
    "project_id",
    "snapshot_id",
    "template_id",
    "status",
    "title",
    "description",
    "impact",
    "created_by_user_id",
    "applied_by_user_id",
    "created_at",
    "applied_at",
    "audit_event_id"
  ],
  control_surface_definitions: [
    "id",
    "tenant_id",
    "code",
    "name",
    "description",
    "owner_user_id",
    "status",
    "current_version",
    "draft_version",
    "draft_definition",
    "published_definition",
    "created_by_user_id",
    "updated_by_user_id",
    "created_at",
    "updated_at",
    "published_at",
    "archived_at"
  ],
  control_surface_versions: [
    "tenant_id",
    "surface_id",
    "version",
    "definition",
    "published_by_user_id",
    "audit_event_id",
    "created_at"
  ],
  tenant_production_calendars: [
    "tenant_id",
    "calendar_id",
    "working_weekdays",
    "working_minutes_per_day",
    "updated_at"
  ],
  tenant_production_calendar_exceptions: [
    "id",
    "tenant_id",
    "calendar_id",
    "resource_id",
    "date",
    "working_minutes",
    "reason",
    "created_at",
    "updated_at"
  ],
  planning_saved_views: [
    "id",
    "tenant_id",
    "project_id",
    "owner_user_id",
    "scope",
    "name",
    "payload",
    "created_at"
  ],
  resource_absences: [
    "id",
    "tenant_id",
    "user_id",
    "type",
    "date_from",
    "date_to",
    "status",
    "reason",
    "created_by",
    "approved_by",
    "created_at",
    "updated_at"
  ],
  resource_personal_calendars: [
    "id",
    "tenant_id",
    "user_id",
    "name",
    "timezone",
    "source_provider",
    "sync_status",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  resource_calendar_events: [
    "id",
    "tenant_id",
    "calendar_id",
    "user_id",
    "source_provider",
    "external_id",
    "title",
    "starts_at",
    "finishes_at",
    "work_minutes",
    "capacity_impact",
    "visibility",
    "metadata",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  tenant_org_nodes: [
    "id",
    "tenant_id",
    "track",
    "node_type",
    "name",
    "parent_id",
    "sort_order"
  ],
  tenant_user_org_placements: [
    "tenant_id",
    "user_id",
    "track",
    "direction_id",
    "department_id",
    "team_id",
    "position_id"
  ],
  file_assets: [
    "id",
    "tenant_id",
    "provider",
    "storage_key",
    "original_name",
    "safe_display_name",
    "mime_type",
    "size_bytes",
    "checksum_sha256",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at",
    "purged_at"
  ],
  external_references: [
    "id",
    "tenant_id",
    "connector_type",
    "external_id",
    "url",
    "title",
    "metadata",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  entity_attachments: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "asset_id",
    "external_reference_id",
    "relation_type",
    "source_activity_type",
    "source_activity_id",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  background_job_schedules: [
    "id",
    "tenant_id",
    "kind",
    "schedule_key",
    "payload",
    "interval_seconds",
    "enabled",
    "next_run_at",
    "last_enqueued_at",
    "created_at",
    "updated_at"
  ],
  background_job_runs: [
    "id",
    "tenant_id",
    "kind",
    "status",
    "priority",
    "payload",
    "idempotency_key",
    "attempt",
    "max_attempts",
    "run_after",
    "locked_by",
    "locked_at",
    "started_at",
    "finished_at",
    "last_error",
    "created_at",
    "updated_at"
  ],
  background_job_events: [
    "id",
    "tenant_id",
    "job_id",
    "event_type",
    "message",
    "metadata",
    "created_at"
  ],
  communication_channels: [
    "id",
    "tenant_id",
    "channel_type",
    "title",
    "description",
    "scope_entity_type",
    "scope_entity_id",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  communication_channel_members: [
    "tenant_id",
    "channel_id",
    "user_id",
    "role",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  conversations: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "conversation_type",
    "title",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  discussion_messages: [
    "id",
    "tenant_id",
    "conversation_id",
    "author_user_id",
    "body",
    "metadata",
    "created_at",
    "edited_at",
    "archived_at",
    "pinned_at",
    "pinned_by_user_id"
  ],
  message_reactions: [
    "id",
    "tenant_id",
    "message_id",
    "user_id",
    "emoji",
    "created_at",
    "archived_at"
  ],
  sticker_packs: [
    "id",
    "tenant_id",
    "title",
    "description",
    "source",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  sticker_assets: [
    "id",
    "tenant_id",
    "pack_id",
    "file_asset_id",
    "emoji",
    "title",
    "tags",
    "mime_type",
    "width",
    "height",
    "size_bytes",
    "checksum_sha256",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  message_stickers: [
    "tenant_id",
    "message_id",
    "sticker_asset_id",
    "created_by_user_id",
    "created_at"
  ],
  message_mentions: [
    "tenant_id",
    "message_id",
    "mentioned_user_id",
    "created_at"
  ],
  conversation_read_states: [
    "tenant_id",
    "conversation_id",
    "user_id",
    "last_read_message_id",
    "last_read_at",
    "unread_count"
  ],
  user_notifications: [
    "id",
    "tenant_id",
    "user_id",
    "notification_type",
    "source_entity_type",
    "source_entity_id",
    "title",
    "body",
    "route",
    "created_at",
    "read_at",
    "archived_at"
  ],
  notification_preferences: [
    "tenant_id",
    "user_id",
    "channel",
    "notification_type",
    "enabled",
    "digest_frequency"
  ],
  meetings: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "title",
    "agenda",
    "scheduled_start",
    "scheduled_finish",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  meeting_participants: [
    "tenant_id",
    "meeting_id",
    "user_id",
    "role",
    "response",
    "created_at"
  ],
  meeting_external_links: [
    "id",
    "tenant_id",
    "meeting_id",
    "provider",
    "url",
    "title",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  meeting_notes: [
    "id",
    "tenant_id",
    "meeting_id",
    "author_user_id",
    "body",
    "created_at",
    "edited_at",
    "archived_at"
  ],
  meeting_action_items: [
    "id",
    "tenant_id",
    "meeting_id",
    "title",
    "owner_user_id",
    "due_date",
    "target_entity_type",
    "target_entity_id",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  call_rooms: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "meeting_id",
    "title",
    "media_kind",
    "provider",
    "provider_room_id",
    "status",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  call_sessions: [
    "id",
    "tenant_id",
    "room_id",
    "provider_session_id",
    "status",
    "started_by_user_id",
    "started_at",
    "ended_by_user_id",
    "ended_at",
    "failure_reason"
  ],
  call_participant_states: [
    "tenant_id",
    "room_id",
    "session_id",
    "user_id",
    "state",
    "joined_at",
    "left_at",
    "last_seen_at"
  ],
  call_events: [
    "id",
    "tenant_id",
    "room_id",
    "session_id",
    "event_type",
    "actor_user_id",
    "payload",
    "created_at"
  ],
  call_recordings: [
    "id",
    "tenant_id",
    "room_id",
    "session_id",
    "attachment_id",
    "title",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  knowledge_documents: [
    "id",
    "tenant_id",
    "project_id",
    "title",
    "summary",
    "document_type",
    "status",
    "current_version_id",
    "source_meeting_id",
    "approval_status",
    "approval_requested_by_user_id",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  knowledge_document_versions: [
    "id",
    "tenant_id",
    "document_id",
    "version_number",
    "title",
    "body",
    "summary",
    "change_reason",
    "created_by_user_id",
    "created_at"
  ],
  decision_log_entries: [
    "id",
    "tenant_id",
    "project_id",
    "title",
    "decision",
    "rationale",
    "status",
    "source_meeting_id",
    "document_id",
    "supersedes_decision_id",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  knowledge_action_items: [
    "id",
    "tenant_id",
    "project_id",
    "title",
    "description",
    "owner_user_id",
    "due_date",
    "status",
    "source_meeting_id",
    "document_id",
    "decision_id",
    "target_entity_type",
    "target_entity_id",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  task_participants: ["tenant_id", "task_id", "user_id", "role"],
  task_activities: [
    "id",
    "tenant_id",
    "task_id",
    "type",
    "body",
    "title",
    "file_url",
    "file_size_bytes",
    "mime_type",
    "author_user_id",
    "created_at",
    "updated_at"
  ],
  crm_activities: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "type",
    "title",
    "body",
    "status",
    "due_date",
    "assignee_user_id",
    "author_user_id",
    "file_url",
    "file_size_bytes",
    "mime_type",
    "created_at",
    "updated_at"
  ],
  tenant_users: [
    "id",
    "tenant_id",
    "access_profile_id",
    "position_id",
    "email",
    "name",
    "phone",
    "telegram",
    "status",
    "theme",
    "accent_color",
    "created_at"
  ],
  user_credentials: [
    "user_id",
    "tenant_id",
    "email",
    "password_hash",
    "password_salt",
    "created_at"
  ],
  user_sessions: [
    "id",
    "tenant_id",
    "user_id",
    "token_hash",
    "expires_at",
    "created_at"
  ],
  password_reset_tokens: [
    "id",
    "tenant_id",
    "user_id",
    "token_hash",
    "expires_at",
    "consumed_at",
    "requested_ip",
    "created_at"
  ],
  audit_events: [
    "id",
    "tenant_id",
    "actor_user_id",
    "action_type",
    "source_surface_id",
    "source_workflow",
    "source_entity",
    "input",
    "before_state",
    "after_state",
    "permission_result",
    "execution_result",
    "correlation_id",
    "created_at"
  ]
} as const satisfies Record<PersistenceTableName, readonly string[]>;

export function getPersistenceTableColumns(
  tableName: PersistenceTableName
): readonly string[] {
  return tableColumns[tableName];
}
