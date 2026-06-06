import {
  createDatabase,
  createPostgresTenantDataSource,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import { createApp } from "./app";
import { createVideoProvider, type VideoProvider } from "./videoProvider";

type TestApp = ReturnType<typeof createApp>;

export const communicationRealtimeDatabaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

export const communicationRealtimeSeed: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    {
      id: "access-profile-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: [
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.opportunities.read",
        "tenant.opportunities.manage",
        "tenant.communications.read",
        "tenant.communications.manage",
        "tenant.project_activation.manage",
        "tenant.tasks.create",
        "tenant.tasks.edit",
        "tenant.audit_events.read"
      ]
    },
    {
      id: "access-profile-reader",
      tenantId: "tenant-alpha",
      name: "Участник",
      permissions: ["tenant.projects.read"]
    },
    {
      id: "access-profile-denied",
      tenantId: "tenant-alpha",
      name: "Без доступа",
      permissions: []
    }
  ],
  positions: [
    { id: "position-manager", tenantId: "tenant-alpha", name: "Руководитель" },
    { id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" }
  ],
  clients: [{ id: "client-romashka", tenantId: "tenant-alpha", name: "ООО Ромашка" }],
  projectTypes: [
    { id: "project-type-implementation", tenantId: "tenant-alpha", name: "Внедрение" }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-admin",
      positionId: "position-manager",
      password: "admin12345"
    },
    {
      id: "user-alpha-reader",
      tenantId: "tenant-alpha",
      email: "reader@kiss-pm.local",
      name: "Роман Участник",
      accessProfileId: "access-profile-reader",
      positionId: "position-engineer",
      password: "reader12345"
    },
    {
      id: "user-alpha-denied",
      tenantId: "tenant-alpha",
      email: "denied@kiss-pm.local",
      name: "Дина Без Прав",
      accessProfileId: "access-profile-denied",
      password: "denied12345"
    }
  ]
};

export function createCommunicationRealtimeTestApp(
  client: PostgresClient,
  videoProvider: VideoProvider = createVideoProvider({
    kind: "livekit",
    url: "https://livekit.kiss.local",
    apiKey: "livekit-key",
    apiSecret: "livekit-secret",
    tokenTtlSeconds: 120
  })
): TestApp {
  return createApp({
    dataSource: createPostgresTenantDataSource(createDatabase(client)),
    videoProvider
  });
}

export async function seedCommunicationRealtimeScenario(client: PostgresClient): Promise<void> {
  await truncateCommunicationRealtimeState(client);
  await seedTenantDataset(
    createDatabase(client),
    communicationRealtimeSeed,
    new Date("2026-05-25T00:00:00.000Z")
  );
  await createActiveCommunicationProject(client);
}

export async function loginCommunicationRealtimeUser(
  app: TestApp,
  email: string,
  password: string
): Promise<string> {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (response.status !== 200) {
    throw new Error(`communication_realtime_login_failed:${email}:${response.status}`);
  }
  return response.headers.get("set-cookie") ?? "";
}

export async function createActiveCommunicationProject(client: PostgresClient): Promise<void> {
  const dataSource = createPostgresTenantDataSource(createDatabase(client));
  const opportunity = await dataSource.createOpportunity({
    id: "opportunity-alpha",
    tenantId: "tenant-alpha",
    clientId: "client-romashka",
    primaryContactId: null,
    projectTypeId: "project-type-implementation",
    stageId: null,
    clientName: "ООО Ромашка",
    contactName: "Ирина Клиент",
    title: "Внедрение KISS PM",
    projectType: "Внедрение",
    description: null,
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 1000000,
    plannedHourlyRate: 5000,
    plannedHours: 200,
    probability: 80,
    status: "ready_to_activate",
    templateId: null,
    demand: [{ positionId: "position-engineer", requiredHours: 80 }]
  });
  const draft = await dataSource.createProjectDraftFromOpportunity({
    id: "project-alpha",
    tenantId: "tenant-alpha",
    sourceOpportunityId: opportunity.id,
    clientId: opportunity.clientId,
    projectTypeId: opportunity.projectTypeId,
    title: opportunity.title,
    clientName: opportunity.clientName,
    status: "draft",
    plannedStart: opportunity.plannedStart,
    plannedFinish: opportunity.plannedFinish,
    contractValue: opportunity.contractValue,
    plannedHours: opportunity.plannedHours,
    templateId: null,
    demand: opportunity.demand
  });
  await dataSource.activateProjectDraft({ tenantId: "tenant-alpha", projectId: draft.id });
  await dataSource.createProjectDraftFromOpportunity({
    id: "project-other",
    tenantId: "tenant-alpha",
    sourceOpportunityId: "opportunity-alpha",
    clientId: opportunity.clientId,
    projectTypeId: opportunity.projectTypeId,
    title: "Другой проект",
    clientName: opportunity.clientName,
    status: "draft",
    plannedStart: opportunity.plannedStart,
    plannedFinish: opportunity.plannedFinish,
    contractValue: opportunity.contractValue,
    plannedHours: opportunity.plannedHours,
    templateId: null,
    demand: opportunity.demand
  }).catch(() => undefined);
}

export async function createCommunicationExternalReferenceAttachment(
  client: PostgresClient,
  input: {
    attachmentId: string;
    entityType: "project" | "communication_channel";
    entityId: string;
  }
): Promise<string> {
  const dataSource = createPostgresTenantDataSource(createDatabase(client));
  const referenceId = `reference-${input.attachmentId}`;
  await dataSource.createExternalReference({
    id: referenceId,
    tenantId: "tenant-alpha",
    connectorType: "manual_link",
    externalId: null,
    url: `https://files.kiss.local/${input.attachmentId}`,
    title: input.attachmentId,
    metadata: {},
    createdByUserId: "user-alpha-admin"
  });
  const attachment = await dataSource.createEntityAttachment({
    id: input.attachmentId,
    tenantId: "tenant-alpha",
    entityType: input.entityType,
    entityId: input.entityId,
    assetId: null,
    externalReferenceId: referenceId,
    relationType: "recording",
    sourceActivityType: null,
    sourceActivityId: null,
    createdByUserId: "user-alpha-admin"
  });
  return attachment.id;
}

export async function truncateCommunicationRealtimeState(client: PostgresClient): Promise<void> {
  await client`TRUNCATE message_stickers, sticker_assets, sticker_packs, message_reactions, communication_channel_members, communication_channels, call_recordings, call_participant_states, call_events, call_sessions, call_rooms, meeting_action_items, meeting_notes, meeting_external_links, meeting_participants, meetings, notification_preferences, user_notifications, conversation_read_states, message_mentions, discussion_messages, conversations, entity_attachments, external_references, file_assets, audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignment_allocations, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
}

export function communicationJsonHeaders(cookie: string) {
  return {
    "content-type": "application/json",
    "x-kiss-pm-action": "same-origin",
    cookie
  };
}
