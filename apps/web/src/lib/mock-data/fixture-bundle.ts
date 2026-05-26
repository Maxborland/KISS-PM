import type {
  Absence,
  AccessProfile,
  ActionExecution,
  AuditEvent,
  Client,
  Contact,
  ControlSignal,
  CorrectiveAction,
  CustomFieldDefinition,
  DealStage,
  KpiDefinition,
  KpiEvaluation,
  Opportunity,
  OrgStructureSnapshot,
  PlanBaseline,
  Position,
  Product,
  ProductionCalendar,
  Project,
  ProjectTemplate,
  ProjectType,
  ScheduledTask,
  Task,
  TaskActivity,
  TaskStatus,
  WorkspaceUser
} from "@/lib/api-types";

import {
  MOCK_ABSENCES,
  MOCK_PLAN_BASELINES,
  MOCK_PRODUCTION_CALENDAR
} from "./capacity";
import {
  MOCK_ACTION_EXECUTIONS,
  MOCK_AUDIT_EVENTS,
  MOCK_CONTROL_SIGNALS,
  MOCK_CORRECTIVE_ACTIONS,
  MOCK_KPI_DEFINITIONS,
  MOCK_KPI_EVALUATIONS
} from "./control";
import {
  MOCK_CLIENTS,
  MOCK_CONTACTS,
  MOCK_DEAL_STAGES,
  MOCK_PRODUCTS,
  MOCK_PROJECT_TYPES
} from "./crm";
import { MOCK_OPPORTUNITIES } from "./deals";
import { MOCK_ORG_STRUCTURE } from "./org-structure";
import { MOCK_PROJECTS } from "./projects";
import { MOCK_SCHEDULED_TASKS, MOCK_TASK_ACTIVITIES, MOCK_TASKS } from "./tasks";
import type { ScenarioName } from "./scenarios";
import { MOCK_ACCESS_PROFILES, MOCK_POSITIONS, MOCK_WORKSPACE_USERS } from "./users";
import { MOCK_CUSTOM_FIELDS, MOCK_PROJECT_TEMPLATES, MOCK_TASK_STATUSES } from "./workspace-config";

/** Снимок типизированных фикстур для MSW и сценариев Storybook. */
export type FixtureBundle = {
  opportunities: Opportunity[];
  projects: Project[];
  tasks: Task[];
  taskActivities: TaskActivity[];
  scheduledTasks: ScheduledTask[];
  workspaceUsers: WorkspaceUser[];
  positions: Position[];
  clients: Client[];
  contacts: Contact[];
  products: Product[];
  projectTypes: ProjectType[];
  dealStages: DealStage[];
  orgStructure: OrgStructureSnapshot;
  customFields: CustomFieldDefinition[];
  projectTemplates: ProjectTemplate[];
  taskStatuses: TaskStatus[];
  kpiDefinitions: KpiDefinition[];
  kpiEvaluations: KpiEvaluation[];
  controlSignals: ControlSignal[];
  correctiveActions: CorrectiveAction[];
  actionExecutions: ActionExecution[];
  auditEvents: AuditEvent[];
  productionCalendar: ProductionCalendar;
  absences: Absence[];
  planBaselines: PlanBaseline[];
  accessProfiles: AccessProfile[];
};

function baseBundle(): FixtureBundle {
  return {
    opportunities: MOCK_OPPORTUNITIES,
    projects: MOCK_PROJECTS,
    tasks: MOCK_TASKS,
    taskActivities: MOCK_TASK_ACTIVITIES,
    scheduledTasks: MOCK_SCHEDULED_TASKS,
    workspaceUsers: MOCK_WORKSPACE_USERS,
    positions: MOCK_POSITIONS,
    clients: MOCK_CLIENTS,
    contacts: MOCK_CONTACTS,
    products: MOCK_PRODUCTS,
    projectTypes: MOCK_PROJECT_TYPES,
    dealStages: MOCK_DEAL_STAGES,
    orgStructure: MOCK_ORG_STRUCTURE,
    customFields: MOCK_CUSTOM_FIELDS,
    projectTemplates: MOCK_PROJECT_TEMPLATES,
    taskStatuses: MOCK_TASK_STATUSES,
    kpiDefinitions: MOCK_KPI_DEFINITIONS,
    kpiEvaluations: MOCK_KPI_EVALUATIONS,
    controlSignals: MOCK_CONTROL_SIGNALS,
    correctiveActions: MOCK_CORRECTIVE_ACTIONS,
    actionExecutions: MOCK_ACTION_EXECUTIONS,
    auditEvents: MOCK_AUDIT_EVENTS,
    productionCalendar: MOCK_PRODUCTION_CALENDAR,
    absences: MOCK_ABSENCES,
    planBaselines: MOCK_PLAN_BASELINES,
    accessProfiles: MOCK_ACCESS_PROFILES
  };
}

function withLateDeadlines(bundle: FixtureBundle): FixtureBundle {
  const lateFinish = "2026-04-01T00:00:00.000Z";
  return {
    ...bundle,
    tasks: bundle.tasks.map((task) => ({
      ...task,
      plannedFinish: lateFinish,
      statusCategory: task.statusCategory === "done" ? task.statusCategory : "in_progress",
      priority: task.priority === "critical" ? task.priority : "high"
    })),
    projects: bundle.projects.map((project) =>
      project.status === "active"
        ? { ...project, plannedFinish: lateFinish }
        : project
    )
  };
}

function withOverloadSignals(bundle: FixtureBundle): FixtureBundle {
  const seed = bundle.controlSignals[0];
  if (!seed) return bundle;
  const extraSignal: ControlSignal = {
    ...seed,
    id: "signal-overload-1",
    severity: "critical",
    explanation: "Перегруз команды разработки выше 110% на май.",
    status: "open"
  };
  return {
    ...bundle,
    controlSignals: [...bundle.controlSignals, extraSignal],
    kpiEvaluations: bundle.kpiEvaluations.map((item) => ({
      ...item,
      severity: "critical",
      calculatedValue: Math.max(item.calculatedValue, 110)
    }))
  };
}

/** Фикстуры с учётом сценария (default — полный набор mock-data). */
export function getFixtureBundle(scenario: ScenarioName): FixtureBundle {
  const bundle = baseBundle();

  switch (scenario) {
    case "empty":
      return {
        ...bundle,
        opportunities: [],
        projects: [],
        tasks: [],
        taskActivities: [],
        scheduledTasks: [],
        clients: [],
        contacts: [],
        products: [],
        controlSignals: [],
        correctiveActions: [],
        kpiEvaluations: [],
        auditEvents: []
      };
    case "overload":
      return withOverloadSignals(bundle);
    case "late":
      return withLateDeadlines(bundle);
    case "loading":
    case "error":
    case "forbidden":
    case "default":
    default:
      return bundle;
  }
}
