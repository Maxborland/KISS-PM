import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const phase12Migration = readFileSync(
  new URL("../migrations/0000_phase_1_2_foundation.sql", import.meta.url),
  "utf8"
);
const phase23Migration = readFileSync(
  new URL("../migrations/0002_phase_2_3_workspace_config.sql", import.meta.url),
  "utf8"
);
const phase23ScopedIdsMigration = readFileSync(
  new URL(
    "../migrations/0003_phase_2_3_workspace_config_scoped_ids.sql",
    import.meta.url
  ),
  "utf8"
);
const phase23AccessProfileScopedIdsMigration = readFileSync(
  new URL(
    "../migrations/0004_phase_2_3_access_profiles_scoped_ids.sql",
    import.meta.url
  ),
  "utf8"
);
const phase3IntakeMigration = readFileSync(
  new URL("../migrations/0005_phase_3_project_intake.sql", import.meta.url),
  "utf8"
);
const phase3ProjectSourceUniqueMigration = readFileSync(
  new URL(
    "../migrations/0006_phase_3_project_source_unique.sql",
    import.meta.url
  ),
  "utf8"
);
const phase31CrmFoundationMigration = readFileSync(
  new URL("../migrations/0007_phase_3_1_crm_foundation.sql", import.meta.url),
  "utf8"
);
const phase31ContactClientFkMigration = readFileSync(
  new URL("../migrations/0008_phase_3_1_contact_client_fk.sql", import.meta.url),
  "utf8"
);
const phase32ProjectLifecycleMigration = readFileSync(
  new URL(
    "../migrations/0009_phase_3_2_project_lifecycle_status.sql",
    import.meta.url
  ),
  "utf8"
);
const phase4ProjectTasksMigration = readFileSync(
  new URL("../migrations/0010_phase_4_project_tasks.sql", import.meta.url),
  "utf8"
);
const phase4CrmFinalActionsMigration = readFileSync(
  new URL(
    "../migrations/0011_phase_4_crm_final_actions_custom_fields.sql",
    import.meta.url
  ),
  "utf8"
);
const phase4CrmActivityMigration = readFileSync(
  new URL(
    "../migrations/0012_phase_4_crm_opportunity_activities.sql",
    import.meta.url
  ),
  "utf8"
);
const phase4CrmActivityFkRepairMigration = readFileSync(
  new URL(
    "../migrations/0013_phase_4_repair_opportunity_activity_fk.sql",
    import.meta.url
  ),
  "utf8"
);
const phase4CrmProductsMigration = readFileSync(
  new URL("../migrations/0014_phase_4_crm_products.sql", import.meta.url),
  "utf8"
);
const phase4CrmActivityFkRepairAgainMigration = readFileSync(
  new URL(
    "../migrations/0015_phase_4_repair_opportunity_activity_fk_again.sql",
    import.meta.url
  ),
  "utf8"
);
const phase4CrmActivityChecksRepairMigration = readFileSync(
  new URL(
    "../migrations/0016_phase_4_repair_opportunity_activity_checks.sql",
    import.meta.url
  ),
  "utf8"
);
const phase4OpportunityOwnerMigration = readFileSync(
  new URL("../migrations/0017_phase_4_opportunity_owner.sql", import.meta.url),
  "utf8"
);
const phase4GeneralCrmActivityMigration = readFileSync(
  new URL(
    "../migrations/0018_phase_4_general_crm_activities.sql",
    import.meta.url
  ),
  "utf8"
);
const phase42TaskWorkspaceMigration = readFileSync(
  new URL("../migrations/0019_phase_4_2_task_workspace.sql", import.meta.url),
  "utf8"
);
const phase42TaskSystemActivityMigration = readFileSync(
  new URL(
    "../migrations/0020_phase_4_2_task_system_activity.sql",
    import.meta.url
  ),
  "utf8"
);
const phase56PlanningCoreMigration = readFileSync(
  new URL("../migrations/0021_phase_5_6_planning_core.sql", import.meta.url),
  "utf8"
);
const phase56PlanningCommandIdempotencyMigration = readFileSync(
  new URL(
    "../migrations/0022_phase_5_6_planning_command_idempotency.sql",
    import.meta.url
  ),
  "utf8"
);
const phase7KpiSignalActionEngineMigration = readFileSync(
  new URL(
    "../migrations/0028_phase_7_kpi_signal_action_engine.sql",
    import.meta.url
  ),
  "utf8"
);
const phase7KpiEvaluationDecimalMigration = readFileSync(
  new URL(
    "../migrations/0029_phase_7_kpi_evaluation_decimal_value.sql",
    import.meta.url
  ),
  "utf8"
);
const phase78AutoSolverAllocationsMigration = readFileSync(
  new URL(
    "../migrations/0030_phase_7_8_auto_solver_allocations.sql",
    import.meta.url
  ),
  "utf8"
);
const phase8ControlSurfacesMigration = readFileSync(
  new URL("../migrations/0032_phase_8_control_surfaces.sql", import.meta.url),
  "utf8"
);
const phase9ClosureRetrospectivesMigration = readFileSync(
  new URL(
    "../migrations/0033_phase_9_closure_retrospectives.sql",
    import.meta.url
  ),
  "utf8"
);
const phaseGCollaborationMigration = readFileSync(
  new URL(
    "../migrations/0034_phase_g_collaboration_communications.sql",
    import.meta.url
  ),
  "utf8"
);
const phaseG2CommunicationsRealtimeMigration = readFileSync(
  new URL(
    "../migrations/0035_phase_g2_communications_realtime.sql",
    import.meta.url
  ),
  "utf8"
);
const phaseG2ParticipantStateEventsMigration = readFileSync(
  new URL(
    "../migrations/0036_phase_g2_participant_state_events.sql",
    import.meta.url
  ),
  "utf8"
);
const phase12CalendarOccupancyMigration = readFileSync(
  new URL(
    "../migrations/0037_phase_12_calendar_occupancy_v2.sql",
    import.meta.url
  ),
  "utf8"
);
const phaseBackgroundJobsMigration = readFileSync(
  new URL(
    "../migrations/0038_phase_8_background_jobs_infrastructure.sql",
    import.meta.url
  ),
  "utf8"
);
const phaseG3CommunicationsUpgradeMigration = readFileSync(
  new URL(
    "../migrations/0039_phase_g3_communications_upgrade.sql",
    import.meta.url
  ),
  "utf8"
);
const phaseG3CommunicationChannelAttachmentsMigration = readFileSync(
  new URL(
    "../migrations/0040_phase_g3_communication_channel_attachments.sql",
    import.meta.url
  ),
  "utf8"
);
const crmPipelineSchemaContractMigration = readFileSync(
  new URL(
    "../migrations/0041_crm_pipeline_schema_contract.sql",
    import.meta.url
  ),
  "utf8"
);
const projectLifecycleStatusMigration = readFileSync(
  new URL(
    "../migrations/0042_project_lifecycle_status_constraint.sql",
    import.meta.url
  ),
  "utf8"
);

describe("Phase 1.2 SQL migration", () => {
  it("prevents tenant users from referencing access profiles from another tenant", () => {
    const uniqueIndexPosition = phase12Migration.indexOf(
      'CREATE UNIQUE INDEX "access_profiles_tenant_id_id_uidx"'
    );
    const sameTenantForeignKeyPosition = phase12Migration.indexOf(
      'CONSTRAINT "tenant_users_access_profile_same_tenant_fk"'
    );

    expect(phase12Migration).toContain(
      'CONSTRAINT "tenant_users_access_profile_same_tenant_fk"'
    );
    expect(phase12Migration).toContain(
      'FOREIGN KEY ("tenant_id","access_profile_id")'
    );
    expect(phase12Migration).toContain(
      'CREATE UNIQUE INDEX "access_profiles_tenant_id_id_uidx"'
    );
    expect(uniqueIndexPosition).toBeGreaterThanOrEqual(0);
    expect(sameTenantForeignKeyPosition).toBeGreaterThan(uniqueIndexPosition);
  });

  it("adds Phase G.3 channels, reactions and sticker storage tables", () => {
    expect(phaseG3CommunicationsUpgradeMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "communication_channels"'
    );
    expect(phaseG3CommunicationsUpgradeMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "communication_channel_members"'
    );
    expect(phaseG3CommunicationsUpgradeMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "message_reactions"'
    );
    expect(phaseG3CommunicationsUpgradeMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "sticker_packs"'
    );
    expect(phaseG3CommunicationsUpgradeMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "sticker_assets"'
    );
    expect(phaseG3CommunicationsUpgradeMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "message_stickers"'
    );
    expect(phaseG3CommunicationsUpgradeMigration).toContain(
      "communication_channel"
    );
    expect(phaseG3CommunicationsUpgradeMigration).toContain(
      'REFERENCES "file_assets"("tenant_id", "id")'
    );
  });

  it("allows communication channels to own recording attachments", () => {
    expect(phaseG3CommunicationChannelAttachmentsMigration).toContain(
      'ALTER TABLE "entity_attachments" DROP CONSTRAINT IF EXISTS "entity_attachments_entity_type_chk"'
    );
    expect(phaseG3CommunicationChannelAttachmentsMigration).toContain(
      "'communication_channel'"
    );
  });
});

describe("Phase 7 SQL migration", () => {
  it("creates tenant-scoped KPI, signal and action engine tables", () => {
    expect(phase7KpiSignalActionEngineMigration).toContain('CREATE TABLE "kpi_definitions"');
    expect(phase7KpiSignalActionEngineMigration).toContain('CREATE TABLE "kpi_evaluations"');
    expect(phase7KpiSignalActionEngineMigration).toContain('CREATE TABLE "control_signals"');
    expect(phase7KpiSignalActionEngineMigration).toContain('CREATE TABLE "corrective_actions"');
    expect(phase7KpiSignalActionEngineMigration).toContain('CREATE TABLE "action_executions"');
    expect(phase7KpiSignalActionEngineMigration).toContain(
      'CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("tenant_id","id")'
    );
    expect(phase7KpiSignalActionEngineMigration).toContain(
      'CONSTRAINT "control_signals_pkey" PRIMARY KEY ("tenant_id","project_id","id")'
    );
    expect(phase7KpiSignalActionEngineMigration).toContain(
      'CONSTRAINT "corrective_actions_signal_fk" FOREIGN KEY ("tenant_id","project_id","control_signal_id")'
    );
  });

  it("keeps KPI evaluation values decimal-safe for expression formulas", () => {
    expect(phase7KpiEvaluationDecimalMigration).toContain(
      'ALTER COLUMN "calculated_value" TYPE double precision'
    );
  });

  it("adds persisted auto-solver runs and explicit assignment allocations", () => {
    expect(phase78AutoSolverAllocationsMigration).toContain(
      "CREATE TABLE IF NOT EXISTS task_assignment_allocations"
    );
    expect(phase78AutoSolverAllocationsMigration).toContain(
      "CREATE TABLE IF NOT EXISTS planning_solver_runs"
    );
    expect(phase78AutoSolverAllocationsMigration).toContain(
      "task_assignment_allocations_assignment_date_uidx"
    );
    expect(phase78AutoSolverAllocationsMigration).toContain(
      "CONSTRAINT planning_solver_runs_mode_chk CHECK (mode IN ('schedule', 'repair'))"
    );
  });
});

describe("Phase 8 SQL migration", () => {
  it("creates versioned tenant-scoped control surface tables", () => {
    expect(phase8ControlSurfacesMigration).toContain(
      "CREATE TABLE IF NOT EXISTS control_surface_definitions"
    );
    expect(phase8ControlSurfacesMigration).toContain(
      "CREATE TABLE IF NOT EXISTS control_surface_versions"
    );
    expect(phase8ControlSurfacesMigration).toContain(
      "CONSTRAINT control_surface_definitions_pkey PRIMARY KEY (tenant_id, id)"
    );
    expect(phase8ControlSurfacesMigration).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS control_surface_definitions_tenant_code_uidx"
    );
    expect(phase8ControlSurfacesMigration).toContain(
      "CONSTRAINT control_surface_versions_pkey PRIMARY KEY (tenant_id, surface_id, version)"
    );
    expect(phase8ControlSurfacesMigration).toContain(
      "CONSTRAINT control_surface_versions_surface_fk"
    );
  });
});

describe("Background jobs infrastructure SQL migration", () => {
  it("creates durable schedules, runs, events and file purge tracking", () => {
    expect(phaseBackgroundJobsMigration).toContain(
      'ALTER TABLE "file_assets"'
    );
    expect(phaseBackgroundJobsMigration).toContain(
      'ADD COLUMN IF NOT EXISTS "purged_at"'
    );
    expect(phaseBackgroundJobsMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "background_job_schedules"'
    );
    expect(phaseBackgroundJobsMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "background_job_runs"'
    );
    expect(phaseBackgroundJobsMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "background_job_events"'
    );
    expect(phaseBackgroundJobsMigration).toContain(
      'CONSTRAINT "background_job_runs_status_chk"'
    );
    expect(phaseBackgroundJobsMigration).toContain(
      'CREATE INDEX IF NOT EXISTS "background_job_runs_claim_idx"'
    );
  });
});

describe("Phase 9 SQL migration", () => {
  it("creates immutable closure snapshots, lessons and template improvement actions", () => {
    expect(phase9ClosureRetrospectivesMigration).toContain(
      "CREATE TABLE IF NOT EXISTS project_closure_snapshots"
    );
    expect(phase9ClosureRetrospectivesMigration).toContain(
      "CREATE TABLE IF NOT EXISTS retrospective_lessons"
    );
    expect(phase9ClosureRetrospectivesMigration).toContain(
      "CREATE TABLE IF NOT EXISTS template_improvement_actions"
    );
    expect(phase9ClosureRetrospectivesMigration).toContain(
      "project_closure_snapshots_tenant_project_uidx"
    );
    expect(phase9ClosureRetrospectivesMigration).toContain(
      "CONSTRAINT template_improvement_actions_template_fk"
    );
    expect(phase9ClosureRetrospectivesMigration).toContain(
      "ALTER TABLE projects"
    );
  });
});

describe("Phase G / 11 SQL migration", () => {
  it("creates tenant-scoped collaboration and meeting tables", () => {
    expect(phaseGCollaborationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS conversations"
    );
    expect(phaseGCollaborationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS discussion_messages"
    );
    expect(phaseGCollaborationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS user_notifications"
    );
    expect(phaseGCollaborationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS meetings"
    );
    expect(phaseGCollaborationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS meeting_external_links"
    );
    expect(phaseGCollaborationMigration).toContain(
      "conversations_tenant_entity_type_uidx"
    );
    expect(phaseGCollaborationMigration).toContain(
      "CONSTRAINT meeting_external_links_provider_chk"
    );
  });
});

describe("Phase G.2 / 11.2 SQL migration", () => {
  it("creates tenant-scoped call room, session and event tables", () => {
    expect(phaseG2CommunicationsRealtimeMigration).toContain(
      "CREATE TABLE IF NOT EXISTS call_rooms"
    );
    expect(phaseG2CommunicationsRealtimeMigration).toContain(
      "CREATE TABLE IF NOT EXISTS call_sessions"
    );
    expect(phaseG2CommunicationsRealtimeMigration).toContain(
      "CREATE TABLE IF NOT EXISTS call_participant_states"
    );
    expect(phaseG2CommunicationsRealtimeMigration).toContain(
      "CREATE TABLE IF NOT EXISTS call_events"
    );
    expect(phaseG2CommunicationsRealtimeMigration).toContain(
      "CREATE TABLE IF NOT EXISTS call_recordings"
    );
    expect(phaseG2CommunicationsRealtimeMigration).toContain(
      "call_sessions_one_active_per_room_uidx"
    );
    expect(phaseG2CommunicationsRealtimeMigration).toContain(
      "call_sessions_tenant_room_id_uidx"
    );
    expect(phaseG2CommunicationsRealtimeMigration).toContain(
      "CONSTRAINT call_recordings_attachment_fk"
    );
  });

  it("extends call event types for intermediate participant states", () => {
    expect(phaseG2ParticipantStateEventsMigration).toContain(
      "DROP CONSTRAINT IF EXISTS call_events_type_chk"
    );
    expect(phaseG2ParticipantStateEventsMigration).toContain("participant_invited");
    expect(phaseG2ParticipantStateEventsMigration).toContain("participant_joining");
    expect(phaseG2ParticipantStateEventsMigration).toContain(
      "ADD CONSTRAINT call_events_type_chk"
    );
  });
});

describe("Phase 12 Calendar & Occupancy V2 SQL migration", () => {
  it("creates tenant-scoped personal calendar and occupancy event tables", () => {
    expect(phase12CalendarOccupancyMigration).toContain(
      'CREATE TABLE "resource_personal_calendars"'
    );
    expect(phase12CalendarOccupancyMigration).toContain(
      'CREATE TABLE "resource_calendar_events"'
    );
    expect(phase12CalendarOccupancyMigration).toContain(
      'CONSTRAINT "resource_personal_calendars_pkey" PRIMARY KEY ("tenant_id","id")'
    );
    expect(phase12CalendarOccupancyMigration).toContain(
      'CONSTRAINT "resource_calendar_events_calendar_fk"'
    );
    expect(phase12CalendarOccupancyMigration).toContain(
      "resource_personal_calendars_tenant_user_provider_uidx"
    );
    expect(phase12CalendarOccupancyMigration).toContain(
      "resource_calendar_events_external_uidx"
    );
  });

  it("guards event ranges, work minutes, providers and privacy visibility", () => {
    expect(phase12CalendarOccupancyMigration).toContain(
      'CONSTRAINT "resource_calendar_events_time_range_chk" CHECK ("finishes_at" > "starts_at")'
    );
    expect(phase12CalendarOccupancyMigration).toContain(
      'CONSTRAINT "resource_calendar_events_work_minutes_chk"'
    );
    expect(phase12CalendarOccupancyMigration).toContain(
      '"capacity_impact" IN (\'busy\', \'unavailable\', \'tentative\')'
    );
    expect(phase12CalendarOccupancyMigration).toContain(
      '"visibility" IN (\'public\', \'busy_only\', \'private\')'
    );
  });
});

describe("Phase 2.3 SQL migration", () => {
  it("adds tenant-scoped workspace config tables with canonical keys", () => {
    expect(phase23Migration).toContain('CREATE TABLE "custom_field_definitions"');
    expect(phase23Migration).toContain('CREATE TABLE "project_templates"');
    expect(phase23Migration).toContain('"tenant_id" text NOT NULL');
    expect(phase23Migration).toContain('"system_key" text NOT NULL');
    expect(phase23Migration).toContain('"tenant_label" text NOT NULL');
    expect(phase23Migration).toContain(
      'CREATE UNIQUE INDEX "custom_field_definitions_tenant_id_system_key_uidx"'
    );
    expect(phase23Migration).toContain(
      'CREATE UNIQUE INDEX "project_templates_tenant_id_system_key_uidx"'
    );
    expect(phase23Migration).toContain(
      'CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY("tenant_id","id")'
    );
    expect(phase23Migration).toContain(
      'CONSTRAINT "project_templates_pkey" PRIMARY KEY("tenant_id","id")'
    );
    expect(phase23Migration).toContain(
      'FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade'
    );
  });

  it("repairs already-applied Phase 2.3 tables to tenant-scoped primary keys", () => {
    expect(phase23ScopedIdsMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "custom_field_definitions_pkey"'
    );
    expect(phase23ScopedIdsMigration).toContain(
      'PRIMARY KEY ("tenant_id","id")'
    );
    expect(phase23ScopedIdsMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "project_templates_pkey"'
    );
  });

  it("repairs access profiles to tenant-scoped primary keys", () => {
    expect(phase23AccessProfileScopedIdsMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "access_profiles_pkey"'
    );
    expect(phase23AccessProfileScopedIdsMigration).toContain(
      'ADD CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("tenant_id","id")'
    );
  });
});

describe("Phase 3 SQL migration", () => {
  it("creates tenant-scoped opportunity, demand and project tables", () => {
    expect(phase3IntakeMigration).toContain('CREATE TABLE "opportunities"');
    expect(phase3IntakeMigration).toContain('CREATE TABLE "opportunity_demands"');
    expect(phase3IntakeMigration).toContain('CREATE TABLE "projects"');
    expect(phase3IntakeMigration).toContain('CREATE TABLE "project_position_demands"');
    expect(phase3IntakeMigration).toContain(
      'PRIMARY KEY ("tenant_id","opportunity_id","position_id")'
    );
  });

  it("keeps activation single-use per source opportunity", () => {
    expect(phase3ProjectSourceUniqueMigration).toContain(
      'CREATE UNIQUE INDEX "projects_tenant_source_opportunity_uidx"'
    );
    expect(phase3ProjectSourceUniqueMigration).toContain(
      'ON "projects" USING btree ("tenant_id","source_opportunity_id")'
    );
  });
});

describe("Phase 3.1 SQL migration", () => {
  it("adds tenant-scoped CRM foundation tables and links opportunities", () => {
    expect(phase31CrmFoundationMigration).toContain('CREATE TABLE "clients"');
    expect(phase31CrmFoundationMigration).toContain('CREATE TABLE "contacts"');
    expect(phase31CrmFoundationMigration).toContain('CREATE TABLE "project_types"');
    expect(phase31CrmFoundationMigration).toContain('CREATE TABLE "deal_stages"');
    expect(phase31CrmFoundationMigration).toContain(
      'ALTER TABLE "opportunities" ADD COLUMN "client_id" text'
    );
    expect(phase31CrmFoundationMigration).toContain(
      'ALTER TABLE "opportunities" ADD COLUMN "primary_contact_id" text'
    );
    expect(phase31CrmFoundationMigration).toContain(
      'ALTER TABLE "opportunities" ADD COLUMN "project_type_id" text'
    );
    expect(phase31CrmFoundationMigration).toContain(
      'ALTER TABLE "opportunities" ADD COLUMN "stage_id" text'
    );
  });

  it("keeps primary contact constrained to the selected deal client", () => {
    expect(phase31ContactClientFkMigration).toContain(
      'CONSTRAINT "opportunities_primary_contact_client_fk"'
    );
    expect(phase31ContactClientFkMigration).toContain(
      'FOREIGN KEY ("tenant_id","client_id","primary_contact_id")'
    );
    expect(phase31ContactClientFkMigration).toContain(
      'REFERENCES "public"."contacts"("tenant_id","client_id","id")'
    );
  });
});

describe("Phase 3.2 project lifecycle SQL migration", () => {
  it("allows project drafts before governed activation", () => {
    expect(phase32ProjectLifecycleMigration).toContain(
      'ALTER TABLE "projects" ALTER COLUMN "activated_at" DROP NOT NULL'
    );
  });
});

describe("Project lifecycle status SQL migration", () => {
  it("constrains project lifecycle statuses", () => {
    expect(projectLifecycleStatusMigration).toContain(
      "CONSTRAINT \"projects_status_chk\" CHECK (\"status\" in ('draft', 'active', 'paused', 'closed', 'cancelled'))"
    );
  });
});

describe("Phase 4 project tasks SQL migration", () => {
  it("adds tenant-scoped task and participant tables for active project work", () => {
    expect(phase4ProjectTasksMigration).toContain('CREATE TABLE "tasks"');
    expect(phase4ProjectTasksMigration).toContain('CREATE TABLE "task_participants"');
    expect(phase4ProjectTasksMigration).toContain(
      'CONSTRAINT "tasks_pkey" PRIMARY KEY("tenant_id","id")'
    );
    expect(phase4ProjectTasksMigration).toContain(
      'CONSTRAINT "task_participants_pkey" PRIMARY KEY("tenant_id","task_id","user_id","role")'
    );
    expect(phase4ProjectTasksMigration).toContain(
      'CONSTRAINT "tasks_project_fk"'
    );
    expect(phase4ProjectTasksMigration).toContain(
      'CONSTRAINT "task_participants_user_fk"'
    );
    expect(phase4ProjectTasksMigration).toContain(
      'CREATE INDEX "tasks_tenant_project_id_idx"'
    );
    expect(phase4ProjectTasksMigration).toContain(
      'CREATE INDEX "task_participants_tenant_user_id_idx"'
    );
  });
});

describe("Phase 4 CRM final actions SQL migration", () => {
  it("stores runtime custom field values on opportunities", () => {
    expect(phase4CrmFinalActionsMigration).toContain(
      'ALTER TABLE "opportunities"'
    );
    expect(phase4CrmFinalActionsMigration).toContain(
      'ADD COLUMN IF NOT EXISTS "custom_field_values" jsonb NOT NULL DEFAULT'
    );
  });
});

describe("Phase 4 CRM activity SQL migration", () => {
  it("adds tenant-scoped opportunity activity with opportunity and user guards", () => {
    expect(phase4CrmActivityMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "opportunity_activities"'
    );
    expect(phase4CrmActivityMigration).toContain(
      'CONSTRAINT "opportunity_activities_pkey" PRIMARY KEY("tenant_id","id")'
    );
    expect(phase4CrmActivityMigration).toContain(
      'CONSTRAINT "opportunity_activities_opportunity_fk"'
    );
    expect(phase4CrmActivityMigration).toContain(
      'FOREIGN KEY ("tenant_id","opportunity_id")'
    );
    expect(phase4CrmActivityMigration).toContain(
      'CONSTRAINT "opportunity_activities_author_user_fk"'
    );
    expect(phase4CrmActivityMigration).toContain(
      'CONSTRAINT "opportunity_activities_type_chk"'
    );
    expect(phase4CrmActivityMigration).toContain(
      'CONSTRAINT "opportunity_activities_status_chk"'
    );
    expect(phase4CrmActivityMigration).toContain("ON DELETE restrict");
    expect(phase4CrmActivityMigration).toContain(
      'CREATE INDEX IF NOT EXISTS "opportunity_activities_tenant_opportunity_created_idx"'
    );
  });

  it("repairs previously applied opportunity activity FK to restrict deletes", () => {
    expect(phase4CrmActivityFkRepairMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "opportunity_activities_opportunity_fk"'
    );
    expect(phase4CrmActivityFkRepairMigration).toContain(
      'ADD CONSTRAINT "opportunity_activities_opportunity_fk"'
    );
    expect(phase4CrmActivityFkRepairMigration).toContain("ON DELETE restrict");
  });

  it("reapplies the activity repair for environments that marked the first repair stale", () => {
    expect(phase4CrmActivityFkRepairAgainMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "opportunity_activities_opportunity_fk"'
    );
    expect(phase4CrmActivityFkRepairAgainMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "opportunity_activities_type_chk"'
    );
    expect(phase4CrmActivityFkRepairAgainMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "opportunity_activities_status_chk"'
    );
    expect(phase4CrmActivityFkRepairAgainMigration).toContain(
      'ADD CONSTRAINT "opportunity_activities_opportunity_fk"'
    );
    expect(phase4CrmActivityFkRepairAgainMigration).toContain("ON DELETE restrict");
    expect(phase4CrmActivityFkRepairAgainMigration).toContain(
      'ADD CONSTRAINT "opportunity_activities_type_chk"'
    );
    expect(phase4CrmActivityFkRepairAgainMigration).toContain(
      'ADD CONSTRAINT "opportunity_activities_status_chk"'
    );
  });

  it("reapplies activity CHECK constraints when a local database already applied the FK repair", () => {
    expect(phase4CrmActivityChecksRepairMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "opportunity_activities_type_chk"'
    );
    expect(phase4CrmActivityChecksRepairMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "opportunity_activities_status_chk"'
    );
    expect(phase4CrmActivityChecksRepairMigration).toContain(
      'ADD CONSTRAINT "opportunity_activities_type_chk"'
    );
    expect(phase4CrmActivityChecksRepairMigration).toContain(
      'ADD CONSTRAINT "opportunity_activities_status_chk"'
    );
    expect(phase4CrmActivityChecksRepairMigration).toContain("NOT VALID");
  });
});

describe("Phase 4 CRM products SQL migration", () => {
  it("adds tenant-scoped products as first-class CRM entities", () => {
    expect(phase4CrmProductsMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "products"'
    );
    expect(phase4CrmProductsMigration).toContain(
      'CONSTRAINT "products_pkey" PRIMARY KEY("tenant_id","id")'
    );
    expect(phase4CrmProductsMigration).toContain(
      'CONSTRAINT "products_type_chk"'
    );
    expect(phase4CrmProductsMigration).toContain(
      'CONSTRAINT "products_price_chk"'
    );
    expect(phase4CrmProductsMigration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_name_uidx"'
    );
  });
});

describe("Phase 4 opportunity owner SQL migration", () => {
  it("adds owner user id for CRM responsibility without changing the deal lifecycle", () => {
    expect(phase4OpportunityOwnerMigration).toContain(
      'ADD COLUMN IF NOT EXISTS "owner_user_id" text'
    );
    expect(phase4OpportunityOwnerMigration).toContain(
      'CREATE INDEX IF NOT EXISTS "opportunities_owner_user_id_idx"'
    );
    expect(phase4OpportunityOwnerMigration).toContain('"tenant_id", "owner_user_id"');
  });
});

describe("Phase 4 general CRM activity SQL migration", () => {
  it("moves runtime activity to the shared CRM entity contract", () => {
    expect(phase4GeneralCrmActivityMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "crm_activities"'
    );
    expect(phase4GeneralCrmActivityMigration).toContain('"entity_type" text NOT NULL');
    expect(phase4GeneralCrmActivityMigration).toContain('"entity_id" text NOT NULL');
    expect(phase4GeneralCrmActivityMigration).toContain('"file_url" text');
    expect(phase4GeneralCrmActivityMigration).toContain('"file_size_bytes" integer');
    expect(phase4GeneralCrmActivityMigration).toContain(
      'CONSTRAINT "crm_activities_entity_type_chk"'
    );
    expect(phase4GeneralCrmActivityMigration).toMatch(
      /"entity_type" in \('opportunity', 'client', 'contact', 'product'\)/
    );
    expect(phase4GeneralCrmActivityMigration).toContain(
      'CREATE INDEX IF NOT EXISTS "crm_activities_tenant_entity_created_idx"'
    );
    expect(phase4GeneralCrmActivityMigration).toContain(
      'DROP TABLE IF EXISTS "opportunity_activities"'
    );
  });
});

describe("CRM pipeline schema contract SQL migration", () => {
  it("adds first-class pipeline, stage, transition rule and automation tables", () => {
    expect(crmPipelineSchemaContractMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "crm_pipelines"'
    );
    expect(crmPipelineSchemaContractMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "crm_pipeline_stages"'
    );
    expect(crmPipelineSchemaContractMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "crm_pipeline_transition_rules"'
    );
    expect(crmPipelineSchemaContractMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "crm_pipeline_stage_automation_definitions"'
    );
    expect(crmPipelineSchemaContractMigration).toContain(
      'CONSTRAINT "crm_pipeline_stages_pipeline_fk"'
    );
    expect(crmPipelineSchemaContractMigration).toContain(
      'CONSTRAINT "crm_pipeline_transition_rules_from_stage_fk"'
    );
    expect(crmPipelineSchemaContractMigration).toContain(
      'CONSTRAINT "crm_pipeline_stage_automation_definitions_stage_fk"'
    );
    expect(crmPipelineSchemaContractMigration).not.toContain(
      'ALTER TABLE "deal_stages"'
    );
  });

  it("requires explicit structured lifecycle graph metadata on CRM pipeline writes", () => {
    expect(crmPipelineSchemaContractMigration).toContain(
      '"lifecycle_graph_metadata" jsonb NOT NULL,'
    );
    expect(crmPipelineSchemaContractMigration).not.toMatch(
      /"lifecycle_graph_metadata" jsonb NOT NULL DEFAULT/
    );
  });

  it("keeps CRM pipeline stage finality consistent with lifecycle state", () => {
    expect(crmPipelineSchemaContractMigration).toContain(
      'CONSTRAINT "crm_pipeline_stages_final_lifecycle_state_chk"'
    );
  });
});

describe("Phase 4.2 task workspace SQL migration", () => {
  it("adds tenant-scoped task statuses, extended task fields and task activities", () => {
    expect(phase42TaskWorkspaceMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "task_statuses"'
    );
    expect(phase42TaskWorkspaceMigration).toContain(
      'CONSTRAINT "task_statuses_pkey" PRIMARY KEY("tenant_id","id")'
    );
    expect(phase42TaskWorkspaceMigration).toContain(
      'ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status_id" text'
    );
    expect(phase42TaskWorkspaceMigration).toContain(
      'ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "requester_user_id" text'
    );
    expect(phase42TaskWorkspaceMigration).toContain(
      'ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "owner_user_id" text'
    );
    expect(phase42TaskWorkspaceMigration).toContain(
      'ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "requires_acceptance" boolean'
    );
    expect(phase42TaskWorkspaceMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "task_activities"'
    );
    expect(phase42TaskWorkspaceMigration).toContain(
      'CONSTRAINT "task_activities_pkey" PRIMARY KEY("tenant_id","id")'
    );
  });

  it("allows persisted system events in task activity", () => {
    expect(phase42TaskSystemActivityMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "task_activities_type_chk"'
    );
    expect(phase42TaskSystemActivityMigration).toContain(
      `"type" in ('comment', 'file', 'system')`
    );
    expect(phase42TaskSystemActivityMigration).toContain(
      `"type" = 'system' and "title" is not null and "body" is not null`
    );
  });
});

describe("Phase 5/6 planning core SQL migration", () => {
  it("adds explicit project source metadata without fake opportunities", () => {
    expect(phase56PlanningCoreMigration).toContain(
      'ADD COLUMN IF NOT EXISTS "source_type" text NOT NULL DEFAULT'
    );
    expect(phase56PlanningCoreMigration).toContain(
      'ALTER COLUMN "source_opportunity_id" DROP NOT NULL'
    );
    expect(phase56PlanningCoreMigration).toContain(
      '"source_type" in (\'opportunity\', \'workspace_inbox\', \'manual\')'
    );
    expect(phase56PlanningCoreMigration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "projects_tenant_workspace_inbox_uidx"'
    );
    expect(phase56PlanningCoreMigration).toContain(
      '"source_type" = \'workspace_inbox\' and "status" in (\'draft\', \'active\', \'paused\')'
    );
  });

  it("adds tenant-scoped authored planning tables", () => {
    expect(phase56PlanningCoreMigration).toContain('CREATE TABLE IF NOT EXISTS "plan_versions"');
    expect(phase56PlanningCoreMigration).toContain('CREATE TABLE IF NOT EXISTS "task_assignments"');
    expect(phase56PlanningCoreMigration).toContain('CREATE TABLE IF NOT EXISTS "task_dependencies"');
    expect(phase56PlanningCoreMigration).toContain('CREATE TABLE IF NOT EXISTS "project_baselines"');
    expect(phase56PlanningCoreMigration).toContain('CREATE TABLE IF NOT EXISTS "resource_reservations"');
    expect(phase56PlanningCoreMigration).toContain('CREATE TABLE IF NOT EXISTS "planning_scenario_runs"');
    expect(phase56PlanningCoreMigration).toContain(
      'CONSTRAINT "task_dependencies_predecessor_fk"'
    );
    expect(phase56PlanningCoreMigration).toContain(
      'FOREIGN KEY ("tenant_id", "project_id", "predecessor_task_id")'
    );
    expect(phase56PlanningCoreMigration).toContain(
      'CONSTRAINT "task_dependencies_not_self_chk"'
    );
  });

  it("adds tenant-scoped idempotency records for planning command apply retries", () => {
    expect(phase56PlanningCommandIdempotencyMigration).toContain(
      'CREATE TABLE IF NOT EXISTS "planning_command_idempotency_keys"'
    );
    expect(phase56PlanningCommandIdempotencyMigration).toContain(
      'PRIMARY KEY("tenant_id", "project_id", "idempotency_key")'
    );
    expect(phase56PlanningCommandIdempotencyMigration).toContain(
      'CONSTRAINT "planning_command_idempotency_keys_project_fk"'
    );
    expect(phase56PlanningCommandIdempotencyMigration).toContain(
      'CONSTRAINT "planning_command_idempotency_keys_actor_fk"'
    );
  });
});
