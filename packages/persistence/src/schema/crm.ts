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
import { positions, tenantUsers, tenants } from "./core";

export const clients = pgTable(
  "clients",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "clients_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("clients_tenant_id_idx").on(table.tenantId),
    uniqueIndex("clients_tenant_id_name_uidx").on(table.tenantId, table.name)
  ]
);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    telegram: text("telegram"),
    role: text("role"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "contacts_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "contacts_client_fk",
      columns: [table.tenantId, table.clientId],
      foreignColumns: [clients.tenantId, clients.id]
    }).onDelete("cascade"),
    index("contacts_tenant_id_idx").on(table.tenantId),
    index("contacts_tenant_client_id_idx").on(table.tenantId, table.clientId),
    uniqueIndex("contacts_tenant_id_client_id_id_uidx").on(
      table.tenantId,
      table.clientId,
      table.id
    ),
    uniqueIndex("contacts_tenant_id_email_uidx").on(table.tenantId, table.email)
  ]
);

export const products = pgTable(
  "products",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    type: text("type").notNull(),
    unit: text("unit").notNull(),
    price: integer("price").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "products_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("products_tenant_id_idx").on(table.tenantId),
    uniqueIndex("products_tenant_id_name_uidx").on(table.tenantId, table.name),
    uniqueIndex("products_tenant_id_sku_uidx").on(table.tenantId, table.sku),
    check("products_type_chk", sql`${table.type} in ('service', 'goods')`),
    check("products_price_chk", sql`${table.price} > 0`)
  ]
);

export const projectTypes = pgTable(
  "project_types",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "project_types_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("project_types_tenant_id_idx").on(table.tenantId),
    uniqueIndex("project_types_tenant_id_name_uidx").on(table.tenantId, table.name)
  ]
);

// Воронки продаж (CRM): тенант может вести несколько параллельных воронок (мультиворонки).
// Каноническая first-class модель — crm_pipelines/crm_pipeline_stages/crm_pipeline_transition_rules;
// обогащена операционными полями (is_default/sort_order/description) и runtime-гвардами переходов.

export const crmPipelines = pgTable(
  "crm_pipelines",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("active"),
    lifecycleGraphMetadata: jsonb("lifecycle_graph_metadata")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "crm_pipelines_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("crm_pipelines_tenant_id_idx").on(table.tenantId),
    uniqueIndex("crm_pipelines_tenant_id_name_uidx").on(table.tenantId, table.name),
    // sort_order — порядок отображения воронок, НЕ уникальный (две воронки могут делить позицию;
    // unique тут давал бы 500 при создании второй воронки с дефолтным sort_order).
    index("crm_pipelines_tenant_id_sort_order_idx").on(
      table.tenantId,
      table.sortOrder
    ),
    check("crm_pipelines_status_chk", sql`${table.status} in ('active', 'archived')`)
  ]
);

export const crmPipelineStages = pgTable(
  "crm_pipeline_stages",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    pipelineId: text("pipeline_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("active"),
    lifecycleState: text("lifecycle_state").notNull().default("open"),
    isFinal: boolean("is_final").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "crm_pipeline_stages_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "crm_pipeline_stages_pipeline_fk",
      columns: [table.tenantId, table.pipelineId],
      foreignColumns: [crmPipelines.tenantId, crmPipelines.id]
    }).onDelete("cascade"),
    index("crm_pipeline_stages_tenant_pipeline_idx").on(table.tenantId, table.pipelineId),
    uniqueIndex("crm_pipeline_stages_tenant_pipeline_id_uidx").on(
      table.tenantId,
      table.pipelineId,
      table.id
    ),
    uniqueIndex("crm_pipeline_stages_tenant_pipeline_sort_order_uidx").on(
      table.tenantId,
      table.pipelineId,
      table.sortOrder
    ),
    uniqueIndex("crm_pipeline_stages_tenant_pipeline_name_uidx").on(
      table.tenantId,
      table.pipelineId,
      table.name
    ),
    check("crm_pipeline_stages_status_chk", sql`${table.status} in ('active', 'archived')`),
    check(
      "crm_pipeline_stages_lifecycle_state_chk",
      sql`${table.lifecycleState} in ('open', 'won_closed', 'lost_rejected')`
    ),
    check(
      "crm_pipeline_stages_final_lifecycle_state_chk",
      sql`(${table.isFinal} = false and ${table.lifecycleState} = 'open') or (${table.isFinal} = true and ${table.lifecycleState} in ('won_closed', 'lost_rejected'))`
    )
  ]
);

export const crmPipelineTransitionRules = pgTable(
  "crm_pipeline_transition_rules",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    pipelineId: text("pipeline_id").notNull(),
    fromStageId: text("from_stage_id").notNull(),
    toStageId: text("to_stage_id").notNull(),
    requiredPermission: text("required_permission"),
    requiredFields: jsonb("required_fields").$type<string[]>().notNull(),
    requireReason: boolean("require_reason").notNull().default(false),
    // Runtime-гварды перехода (мультиворонки): применяются при перемещении сделки по /opportunities/:id/stage.
    requireFeasibilityOk: boolean("require_feasibility_ok").notNull().default(false),
    minProbability: integer("min_probability"),
    guardNote: text("guard_note"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "crm_pipeline_transition_rules_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "crm_pipeline_transition_rules_pipeline_fk",
      columns: [table.tenantId, table.pipelineId],
      foreignColumns: [crmPipelines.tenantId, crmPipelines.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "crm_pipeline_transition_rules_from_stage_fk",
      columns: [table.tenantId, table.pipelineId, table.fromStageId],
      foreignColumns: [
        crmPipelineStages.tenantId,
        crmPipelineStages.pipelineId,
        crmPipelineStages.id
      ]
    }).onDelete("cascade"),
    foreignKey({
      name: "crm_pipeline_transition_rules_to_stage_fk",
      columns: [table.tenantId, table.pipelineId, table.toStageId],
      foreignColumns: [
        crmPipelineStages.tenantId,
        crmPipelineStages.pipelineId,
        crmPipelineStages.id
      ]
    }).onDelete("cascade"),
    index("crm_pipeline_transition_rules_tenant_pipeline_idx").on(
      table.tenantId,
      table.pipelineId
    ),
    uniqueIndex("crm_pipeline_transition_rules_edge_uidx").on(
      table.tenantId,
      table.pipelineId,
      table.fromStageId,
      table.toStageId
    ),
    check("crm_pipeline_transition_rules_status_chk", sql`${table.status} in ('active', 'archived')`),
    check(
      "crm_pipeline_transition_rules_not_self_chk",
      sql`${table.fromStageId} <> ${table.toStageId}`
    )
  ]
);

export const crmPipelineStageAutomationDefinitions = pgTable(
  "crm_pipeline_stage_automation_definitions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    pipelineId: text("pipeline_id").notNull(),
    stageId: text("stage_id").notNull(),
    trigger: text("trigger").notNull(),
    actionType: text("action_type").notNull(),
    actionConfig: jsonb("action_config").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "crm_pipeline_stage_automation_definitions_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "crm_pipeline_stage_automation_definitions_pipeline_fk",
      columns: [table.tenantId, table.pipelineId],
      foreignColumns: [crmPipelines.tenantId, crmPipelines.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "crm_pipeline_stage_automation_definitions_stage_fk",
      columns: [table.tenantId, table.pipelineId, table.stageId],
      foreignColumns: [
        crmPipelineStages.tenantId,
        crmPipelineStages.pipelineId,
        crmPipelineStages.id
      ]
    }).onDelete("cascade"),
    index("crm_pipeline_stage_automation_definitions_tenant_stage_idx").on(
      table.tenantId,
      table.pipelineId,
      table.stageId
    ),
    check(
      "crm_pipeline_stage_automation_definitions_trigger_chk",
      sql`${table.trigger} in ('stage_entered', 'stage_left')`
    ),
    check(
      "crm_pipeline_stage_automation_definitions_status_chk",
      sql`${table.status} in ('active', 'archived')`
    )
  ]
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: text("client_id"),
    primaryContactId: text("primary_contact_id"),
    ownerUserId: text("owner_user_id"),
    projectTypeId: text("project_type_id"),
    stageId: text("stage_id"),
    pipelineId: text("pipeline_id"),
    clientName: text("client_name").notNull(),
    contactName: text("contact_name").notNull(),
    title: text("title").notNull(),
    projectType: text("project_type").notNull(),
    description: text("description"),
    plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
    plannedFinish: timestamp("planned_finish", { withTimezone: true }).notNull(),
    contractValue: integer("contract_value").notNull(),
    plannedHourlyRate: integer("planned_hourly_rate").notNull(),
    plannedHours: integer("planned_hours").notNull(),
    probability: integer("probability").notNull(),
    status: text("status").notNull(),
    templateId: text("template_id"),
    feasibilityStatus: text("feasibility_status"),
    feasibilityResult: jsonb("feasibility_result").$type<Record<string, unknown> | null>(),
    feasibilityCheckedAt: timestamp("feasibility_checked_at", { withTimezone: true }),
    customFieldValues: jsonb("custom_field_values")
      .$type<Record<string, string>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "opportunities_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "opportunities_client_fk",
      columns: [table.tenantId, table.clientId],
      foreignColumns: [clients.tenantId, clients.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunities_primary_contact_client_fk",
      columns: [table.tenantId, table.clientId, table.primaryContactId],
      foreignColumns: [contacts.tenantId, contacts.clientId, contacts.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunities_project_type_fk",
      columns: [table.tenantId, table.projectTypeId],
      foreignColumns: [projectTypes.tenantId, projectTypes.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunities_stage_fk",
      columns: [table.tenantId, table.stageId],
      foreignColumns: [crmPipelineStages.tenantId, crmPipelineStages.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunities_pipeline_fk",
      columns: [table.tenantId, table.pipelineId],
      foreignColumns: [crmPipelines.tenantId, crmPipelines.id]
    }).onDelete("restrict"),
    index("opportunities_tenant_id_idx").on(table.tenantId),
    index("opportunities_status_idx").on(table.status),
    index("opportunities_owner_user_id_idx").on(table.tenantId, table.ownerUserId),
    index("opportunities_stage_id_idx").on(table.tenantId, table.stageId),
    index("opportunities_pipeline_id_idx").on(table.tenantId, table.pipelineId)
  ]
);

export const opportunityDemands = pgTable(
  "opportunity_demands",
  {
    tenantId: text("tenant_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    positionId: text("position_id").notNull(),
    requiredHours: integer("required_hours").notNull()
  },
  (table) => [
    primaryKey({
      name: "opportunity_demands_pkey",
      columns: [table.tenantId, table.opportunityId, table.positionId]
    }),
    foreignKey({
      name: "opportunity_demands_opportunity_fk",
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [opportunities.tenantId, opportunities.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "opportunity_demands_position_fk",
      columns: [table.tenantId, table.positionId],
      foreignColumns: [positions.tenantId, positions.id]
    }).onDelete("restrict"),
    index("opportunity_demands_tenant_id_idx").on(table.tenantId)
  ]
);

export const crmActivities = pgTable(
  "crm_activities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    type: text("type").notNull(),
    title: text("title"),
    body: text("body"),
    status: text("status"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    assigneeUserId: text("assignee_user_id"),
    authorUserId: text("author_user_id").notNull(),
    fileUrl: text("file_url"),
    fileSizeBytes: integer("file_size_bytes"),
    mimeType: text("mime_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "crm_activities_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "crm_activities_author_user_fk",
      columns: [table.tenantId, table.authorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "crm_activities_assignee_user_fk",
      columns: [table.tenantId, table.assigneeUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("crm_activities_tenant_entity_created_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    index("crm_activities_tenant_assignee_idx").on(
      table.tenantId,
      table.assigneeUserId
    ),
    check(
      "crm_activities_entity_type_chk",
      sql`${table.entityType} in ('opportunity', 'client', 'contact', 'product')`
    ),
    check(
      "crm_activities_type_chk",
      sql`${table.type} in ('comment', 'task', 'file')`
    ),
    check(
      "crm_activities_payload_chk",
      sql`(
        (${table.type} = 'comment' and ${table.status} is null and ${table.body} is not null)
        or
        (${table.type} = 'task' and ${table.status} in ('todo', 'done') and ${table.title} is not null)
        or
        (${table.type} = 'file' and ${table.status} is null and ${table.title} is not null and ${table.fileUrl} is not null)
      )`
    )
  ]
);
