import {
  canApplyPlanningScenarios,
  canCreateTasks,
  canExecuteManagementActions,
  canManageControlSignals,
  canManageCorrectiveActions,
  canManageKpiDefinitions,
  canManageProjectPlan,
  canManageProjectResources,
  canManageProjects,
  canPreviewPlanningScenarios,
  canReadControlSignals,
  canReadProjects,
  canReadProjectPlan,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  controlSurfaceActionRegistry,
  type ControlSignal,
  type TenantUser
} from "@kiss-pm/domain";
import type { TaskRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource, ProjectRecord } from "./apiTypes";
import { parseProjectIdParam } from "./routeParamParsers";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";

export function registerAgentContextRoutes(app: ApiApp, deps: ApiRouteDeps) {
  app.get("/api/workspace/projects/:projectId/agent-context", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadProjectContext({ actor, profile });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);

    if (!deps.dataSource.listProjects || !deps.dataSource.listProjectTasks) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const project = await findReadableProject(
      deps.dataSource,
      actor.tenantId,
      projectId.value
    );
    if (!project) return context.json({ error: "project_not_found" }, 404);

    const planReadDecision = canReadProjectPlan({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    const controlReadDecision = canReadControlSignals({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });

    const [tasks, snapshot, signals] = await Promise.all([
      deps.dataSource.listProjectTasks(actor.tenantId, project.id),
      planReadDecision.allowed
        ? deps.dataSource.getPlanSnapshot?.(actor.tenantId, project.id)
        : Promise.resolve(undefined),
      controlReadDecision.allowed
        ? deps.dataSource.listControlSignals?.(actor.tenantId, project.id) ?? Promise.resolve([])
        : Promise.resolve([])
    ]);

    return context.json({
      snapshot: buildProjectAgentContextSnapshot({
        actor,
        profile,
        project,
        tasks,
        planningSnapshot: snapshot,
        signals
      })
    });
  });
}

function buildProjectAgentContextSnapshot(input: {
  actor: TenantUser;
  profile: AccessProfile;
  project: ProjectRecord;
  tasks: TaskRecord[];
  planningSnapshot: {
    planVersion: number;
    tasks: unknown[];
    assignments: unknown[];
    dependencies: unknown[];
    resources: unknown[];
    baselines: unknown[];
    capturedAt: string;
  } | undefined;
  signals: ControlSignal[];
}) {
  const attentionItems = input.signals
    .filter((signal) => signal.status === "open" || signal.status === "acknowledged")
    .map((signal) => ({
      id: signal.id,
      severity: signal.severity,
      status: signal.status,
      sourceEntity: signal.sourceEntity,
      sourceMetric: signal.sourceMetric,
      explanation: signal.explanation,
      ownerUserId: signal.ownerUserId,
      updatedAt: signal.updatedAt,
      allowedActions: filterAllowedActionsForProfile(
        signal.allowedActions,
        input.actor,
        input.profile
      )
    }))
    .sort(compareAttentionItems);
  const allowedActionIdentifiers = uniqueSorted(
    attentionItems.flatMap((item) => item.allowedActions)
  );

  return {
    schemaVersion: 1,
    kind: "project_agent_context_snapshot",
    deterministic: true,
    route: {
      path: "/api/workspace/projects/:projectId/agent-context",
      method: "GET",
      entityType: "Project",
      entityId: input.project.id,
      tenantId: input.project.tenantId
    },
    actor: {
      id: input.actor.id,
      tenantId: input.actor.tenantId,
      name: input.actor.name,
      accessProfileId: input.actor.accessProfileId,
      accessProfile: {
        id: input.profile.id,
        grantedPermissions: [...input.profile.permissions].sort()
      }
    },
    safety: {
      readOnly: true,
      noDirectMutation: true,
      directMutationAllowed: false
    },
    project: summarizeProject(input.project),
    tasks: {
      total: input.tasks.length,
      items: input.tasks.map(summarizeTask).sort(compareTaskSummaries)
    },
    planning: input.planningSnapshot
      ? {
          available: true,
          planVersion: input.planningSnapshot.planVersion,
          capturedAt: input.planningSnapshot.capturedAt,
          taskCount: input.planningSnapshot.tasks.length,
          assignmentCount: input.planningSnapshot.assignments.length,
          dependencyCount: input.planningSnapshot.dependencies.length,
          resourceCount: input.planningSnapshot.resources.length,
          baselineCount: input.planningSnapshot.baselines.length,
          validationIssueCount: 0
        }
      : {
          available: false,
          planVersion: null,
          capturedAt: null,
          taskCount: 0,
          assignmentCount: 0,
          dependencyCount: 0,
          resourceCount: 0,
          baselineCount: 0,
          validationIssueCount: 0
        },
    control: {
      attentionItems,
      allowedActionIdentifiers
    }
  };
}

async function findReadableProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  return (await dataSource.listProjects?.(tenantId))?.find(
    (project) =>
      project.id === projectId &&
      (project.status === "active" || project.status === "paused")
  );
}

function canReadProjectContext(input: {
  actor: TenantUser;
  profile: AccessProfile;
}): PolicyDecision {
  return canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
}

function filterAllowedActionsForProfile(
  actions: string[],
  actor: TenantUser,
  profile: AccessProfile
): string[] {
  return actions.filter((action) => {
    const registry = controlSurfaceActionRegistry[action as keyof typeof controlSurfaceActionRegistry];
    if (!registry) return true;
    return registry.requiredPermissions.every(
      (permission) => decisionForPermission(permission, actor, profile).allowed
    );
  });
}

function decisionForPermission(
  permission: string,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const input = { actor, profile, targetTenantId: actor.tenantId };
  if (permission === "tenant.project_plan.read") return canReadProjectPlan(input);
  if (permission === "tenant.project_plan.manage") return canManageProjectPlan(input);
  if (permission === "tenant.project_resources.manage") return canManageProjectResources(input);
  if (permission === "tenant.planning_scenarios.preview") return canPreviewPlanningScenarios(input);
  if (permission === "tenant.planning_scenarios.apply") return canApplyPlanningScenarios(input);
  if (permission === "tenant.corrective_actions.manage") return canManageCorrectiveActions(input);
  if (permission === "tenant.management_actions.execute") return canExecuteManagementActions(input);
  if (permission === "tenant.control_signals.manage") return canManageControlSignals(input);
  if (permission === "tenant.tasks.create") return canCreateTasks(input);
  if (permission === "tenant.projects.manage") return canManageProjects(input);
  if (permission === "tenant.kpi_definitions.manage") return canManageKpiDefinitions(input);
  return { allowed: false, reason: "permission_missing" };
}

function summarizeProject(project: ProjectRecord) {
  return {
    id: project.id,
    tenantId: project.tenantId,
    title: project.title,
    clientName: project.clientName,
    status: project.status,
    sourceType: project.sourceType,
    sourceOpportunityId: project.sourceOpportunityId,
    plannedStart: dateOnly(project.plannedStart),
    plannedFinish: dateOnly(project.plannedFinish),
    contractValue: project.contractValue,
    plannedHours: project.plannedHours,
    activatedAt: dateTimeOrNull(project.activatedAt),
    closedAt: dateTimeOrNull(project.closedAt)
  };
}

function summarizeTask(task: TaskRecord) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    statusId: task.statusId,
    statusName: task.statusName,
    statusCategory: task.statusCategory,
    priority: task.priority,
    plannedStart: dateOnly(task.plannedStart),
    plannedFinish: dateOnly(task.plannedFinish),
    plannedWork: task.plannedWork,
    actualWork: task.actualWork,
    progress: task.progress,
    ownerUserId: task.ownerUserId
  };
}

function compareTaskSummaries(
  left: ReturnType<typeof summarizeTask>,
  right: ReturnType<typeof summarizeTask>
): number {
  return (
    left.plannedStart.localeCompare(right.plannedStart) ||
    left.plannedFinish.localeCompare(right.plannedFinish) ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  );
}

function compareAttentionItems(
  left: { severity: string; updatedAt: string; id: string },
  right: { severity: string; updatedAt: string; id: string }
): number {
  return (
    severityRank(left.severity) - severityRank(right.severity) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function severityRank(severity: string): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dateTimeOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
