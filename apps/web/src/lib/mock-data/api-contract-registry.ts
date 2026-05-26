/**
 * Карта сущностей mock-data → web API types → backend route → Storybook.
 * Используется health-тестом и документацией Phase 3 (API Contract).
 */

export type ApiContractEntry = {
  entity: string;
  webType: string;
  fixtureKey: keyof import("./fixture-bundle").FixtureBundle;
  fixtureExport: string;
  method: "GET";
  route: string;
  responseKey: string;
  stories: string[];
};

export const API_CONTRACT_ENTRIES: ApiContractEntry[] = [
  {
    entity: "Opportunity",
    webType: "Opportunity",
    fixtureKey: "opportunities",
    fixtureExport: "MOCK_OPPORTUNITIES",
    method: "GET",
    route: "/api/workspace/opportunities",
    responseKey: "opportunities",
    stories: ["views-screens--deals", "views-screens--deal-card"]
  },
  {
    entity: "Project",
    webType: "Project",
    fixtureKey: "projects",
    fixtureExport: "MOCK_PROJECTS",
    method: "GET",
    route: "/api/workspace/projects",
    responseKey: "projects",
    stories: ["views-screens--projects-list", "views-screens--project-gantt"]
  },
  {
    entity: "Task",
    webType: "Task",
    fixtureKey: "tasks",
    fixtureExport: "MOCK_TASKS",
    method: "GET",
    route: "/api/workspace/projects/:projectId/tasks",
    responseKey: "tasks",
    stories: ["views-screens--my-work", "views-screens--create-task-modal"]
  },
  {
    entity: "ControlReadModel",
    webType: "KpiDefinition | KpiEvaluation | ControlSignal | …",
    fixtureKey: "controlSignals",
    fixtureExport: "MOCK_CONTROL_SIGNALS",
    method: "GET",
    route: "/api/workspace/projects/:projectId/control/read-model",
    responseKey: "signals",
    stories: ["views-screens--project-kpi"]
  },
  {
    entity: "Client",
    webType: "Client",
    fixtureKey: "clients",
    fixtureExport: "MOCK_CLIENTS",
    method: "GET",
    route: "/api/workspace/clients",
    responseKey: "clients",
    stories: ["views-screens--entities-clients"]
  },
  {
    entity: "Contact",
    webType: "Contact",
    fixtureKey: "contacts",
    fixtureExport: "MOCK_CONTACTS",
    method: "GET",
    route: "/api/workspace/contacts",
    responseKey: "contacts",
    stories: ["views-screens--entities-contacts"]
  },
  {
    entity: "Product",
    webType: "Product",
    fixtureKey: "products",
    fixtureExport: "MOCK_PRODUCTS",
    method: "GET",
    route: "/api/workspace/products",
    responseKey: "products",
    stories: ["views-screens--entities-products"]
  },
  {
    entity: "DealStage",
    webType: "DealStage",
    fixtureKey: "dealStages",
    fixtureExport: "MOCK_DEAL_STAGES",
    method: "GET",
    route: "/api/workspace/deal-stages",
    responseKey: "dealStages",
    stories: ["views-screens--deals"]
  },
  {
    entity: "ProjectType",
    webType: "ProjectType",
    fixtureKey: "projectTypes",
    fixtureExport: "MOCK_PROJECT_TYPES",
    method: "GET",
    route: "/api/workspace/project-types",
    responseKey: "projectTypes",
    stories: ["views-screens--projects-list"]
  },
  {
    entity: "WorkspaceUser",
    webType: "WorkspaceUser",
    fixtureKey: "workspaceUsers",
    fixtureExport: "MOCK_WORKSPACE_USERS",
    method: "GET",
    route: "/api/workspace/users",
    responseKey: "users",
    stories: ["views-screens--admin", "widgets-resource-matrix--default"]
  },
  {
    entity: "Position",
    webType: "Position",
    fixtureKey: "positions",
    fixtureExport: "MOCK_POSITIONS",
    method: "GET",
    route: "/api/workspace/positions",
    responseKey: "positions",
    stories: ["views-screens--admin"]
  },
  {
    entity: "TaskStatus",
    webType: "TaskStatus",
    fixtureKey: "taskStatuses",
    fixtureExport: "MOCK_TASK_STATUSES",
    method: "GET",
    route: "/api/workspace/task-statuses",
    responseKey: "taskStatuses",
    stories: ["views-screens--my-work"]
  },
  {
    entity: "CustomFieldDefinition",
    webType: "CustomFieldDefinition",
    fixtureKey: "customFields",
    fixtureExport: "MOCK_CUSTOM_FIELDS",
    method: "GET",
    route: "/api/workspace/config/custom-fields",
    responseKey: "customFields",
    stories: ["views-screens--settings"]
  },
  {
    entity: "ProjectTemplate",
    webType: "ProjectTemplate",
    fixtureKey: "projectTemplates",
    fixtureExport: "MOCK_PROJECT_TEMPLATES",
    method: "GET",
    route: "/api/workspace/config/project-templates",
    responseKey: "projectTemplates",
    stories: ["views-screens--settings"]
  },
  {
    entity: "KpiDefinition",
    webType: "KpiDefinition",
    fixtureKey: "kpiDefinitions",
    fixtureExport: "MOCK_KPI_DEFINITIONS",
    method: "GET",
    route: "/api/tenant/current/kpi-definitions",
    responseKey: "definitions",
    stories: ["views-screens--project-kpi"]
  },
  {
    entity: "AccessProfile",
    webType: "AccessProfile",
    fixtureKey: "accessProfiles",
    fixtureExport: "MOCK_ACCESS_PROFILES",
    method: "GET",
    route: "/api/tenant/current/access-profiles",
    responseKey: "accessProfiles",
    stories: ["views-screens--admin"]
  },
  {
    entity: "OrgStructureSnapshot",
    webType: "OrgStructureSnapshot",
    fixtureKey: "orgStructure",
    fixtureExport: "MOCK_ORG_STRUCTURE",
    method: "GET",
    route: "/api/tenant/current/org-structure",
    responseKey: "orgStructure",
    stories: ["views-screens--admin"]
  },
  {
    entity: "AuditEvent",
    webType: "AuditEvent",
    fixtureKey: "auditEvents",
    fixtureExport: "MOCK_AUDIT_EVENTS",
    method: "GET",
    route: "/api/tenant/current/audit-events",
    responseKey: "auditEvents",
    stories: ["views-screens--project-audit"]
  },
  {
    entity: "ProductionCalendar",
    webType: "ProductionCalendar",
    fixtureKey: "productionCalendar",
    fixtureExport: "MOCK_PRODUCTION_CALENDAR",
    method: "GET",
    route: "/api/tenant/current/production-calendar",
    responseKey: "(root)",
    stories: ["widgets-resource-matrix--default"]
  },
  {
    entity: "Absence",
    webType: "Absence",
    fixtureKey: "absences",
    fixtureExport: "MOCK_ABSENCES",
    method: "GET",
    route: "/api/tenant/current/absences",
    responseKey: "absences",
    stories: ["widgets-resource-matrix--default"]
  },
  {
    entity: "ScheduledTask",
    webType: "ScheduledTask",
    fixtureKey: "scheduledTasks",
    fixtureExport: "MOCK_SCHEDULED_TASKS",
    method: "GET",
    route: "/api/tenant/current/scheduled-tasks",
    responseKey: "tasks",
    stories: ["views-screens--my-work-list-mode"]
  }
];

export { STORYBOOK_MSW_HANDLER_PATHS as API_CONTRACT_MSW_ROUTES } from "./storybook-msw-routes";
