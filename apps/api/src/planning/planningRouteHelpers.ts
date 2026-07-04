import type { AccessProfile } from "@kiss-pm/access-control";
import type { PlanningCommand, ScenarioProposal, TenantUser, ValidationIssue } from "@kiss-pm/domain";
import type { Handler } from "hono";
import { createHash } from "node:crypto";

import type { PlanningReadDataPort } from "../apiDataPorts";
import type { ApiTenantDataSource, ManagementAuditDataSource, ManagementAuditEventInput } from "../apiTypes";
import {
  parsePlanningScenarioRunIdParam,
  parsePlanningSolverProposalIdParam,
  parsePlanningSolverRunIdParam,
  parseProjectIdParam,
  parseSavedViewIdParam,
  type RouteParamParseResult
} from "../routeParamParsers";

export type PlanningRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

export function errorResponseBody<T extends { ok?: false; status?: number; error: string }>(
  result: T
): Omit<T, "ok" | "status"> {
  const { ok: _ok, status: _status, ...body } = result;
  return body;
}

function parseRequiredRouteParam(
  context: Parameters<Handler>[0],
  parser: (value: unknown) => RouteParamParseResult,
  ...keys: string[]
): RouteParamParseResult {
  for (const key of keys) {
    const value = context.req.param(key);
    if (value !== undefined) return parser(value);
  }
  return parser(undefined);
}

export function parseProjectRouteParam(context: Parameters<Handler>[0]): RouteParamParseResult {
  return parseRequiredRouteParam(context, parseProjectIdParam, "projectId");
}

export function parseScenarioProposalRouteParam(context: Parameters<Handler>[0]): RouteParamParseResult {
  return parseRequiredRouteParam(
    context,
    parsePlanningScenarioRunIdParam,
    "scenarioId",
    "proposalId"
  );
}

export function parseSavedViewRouteParam(context: Parameters<Handler>[0]): RouteParamParseResult {
  return parseRequiredRouteParam(context, parseSavedViewIdParam, "viewId");
}

export function parseSolverRunRouteParam(context: Parameters<Handler>[0]): RouteParamParseResult {
  return parseRequiredRouteParam(context, parsePlanningSolverRunIdParam, "runId");
}

export function parseSolverProposalRouteParam(context: Parameters<Handler>[0]): RouteParamParseResult {
  return parseRequiredRouteParam(context, parsePlanningSolverProposalIdParam, "proposalId");
}

export function hashJson(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function serializeScenarioProposal(proposal: ScenarioProposal): Record<string, unknown> {
  return {
    id: proposal.id,
    profile: proposal.profile,
    conflictEffect: proposal.conflictEffect,
    planDelta: proposal.planDelta,
    explainability: proposal.explainability
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function appendPlanningAuditIfConfigured(
  deps: PlanningRouteDeps,
  input: ManagementAuditEventInput,
  auditDataSource?: ManagementAuditDataSource
): Promise<string> {
  if (!(auditDataSource ?? deps.dataSource).appendAuditEvent) {
    throw new Error("audit_not_configured");
  }
  return deps.appendManagementAuditEvent(input, auditDataSource);
}

export function auditActionForCommand(command: PlanningCommand): string {
  if (command.type === "task.delete_or_archive") {
    return command.payload.mode === "delete" ? "planning.task.deleted" : "planning.task.archived";
  }

  const actionByCommand: Record<Exclude<PlanningCommand["type"], "task.delete_or_archive">, string> = {
    "task.create": "planning.task.created",
    "task.update_identity": "planning.task.updated",
    "task.update_schedule": "planning.task.updated",
    "task.update_work_model": "planning.task.updated",
    "task.update_status": "planning.task.status_changed",
    "task.update_progress": "planning.task.updated",
    "task.move_wbs": "planning.task.updated",
    "dependency.upsert": "planning.dependency.upserted",
    "dependency.delete": "planning.dependency.deleted",
    "assignment.upsert": "planning.assignment.upserted",
    "assignment.delete": "planning.assignment.deleted",
    "assignment.allocations.replace": "planning.assignment_allocations.replaced",
    "baseline.capture": "planning.baseline.captured",
    "calendar.exception.upsert": "planning.calendar_exception.upserted",
    "constraint.update": "planning.constraint.updated",
    "resource.reserve": "planning.resource_reserved",
    "risk.accept_overload": "planning.overload_risk_accepted",
    "project.deadline.move": "planning.task.updated",
    "project.settings.update": "project.settings.update.applied",
    "task.update_custom_field": "task.update_custom_field.applied"
  };
  return actionByCommand[command.type];
}

export function summarizeSnapshot(snapshot: {
  projectId: string;
  planVersion: number;
  tasks: unknown[];
  assignments: unknown[];
  dependencies: unknown[];
}): Record<string, unknown> {
  return {
    projectId: snapshot.projectId,
    planVersion: snapshot.planVersion,
    taskCount: snapshot.tasks.length,
    assignmentCount: snapshot.assignments.length,
    dependencyCount: snapshot.dependencies.length
  };
}

export async function validateCommandDataSourcePreconditions(
  dataSource: PlanningReadDataPort,
  tenantId: string,
  command: PlanningCommand
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const statusId =
    command.type === "task.create"
      ? command.payload.statusId
      : command.type === "task.update_status"
        ? command.payload.statusId
        : null;
  if (statusId && dataSource.listTaskStatuses) {
    const status = (await dataSource.listTaskStatuses(tenantId)).find(
      (candidate) => candidate.id === statusId && candidate.status === "active"
    );
    if (!status) {
      issues.push({
        code: "planning_command_invalid",
        severity: "error",
        message: "Команда ссылается на неизвестный или архивированный статус задачи",
        entity: null
      });
    }
  }

  const resourceIds = resourceIdsForCommand(command);
  if (resourceIds.length > 0 && dataSource.listWorkspaceUsers) {
    const activeResourceIds = new Set(
      (await dataSource.listWorkspaceUsers(tenantId))
        .filter((user) => user.status !== "inactive")
        .map((user) => user.id)
    );
    const invalidResourceIds = resourceIds.filter((resourceId) => !activeResourceIds.has(resourceId));
    if (invalidResourceIds.length > 0) {
      issues.push({
        code: "planning_command_invalid",
        severity: "error",
        message: "Команда ссылается на неизвестный или неактивный ресурс",
        entity: null
      });
    }
  }

  return issues;
}

function resourceIdsForCommand(command: PlanningCommand): string[] {
  const resourceIds =
    command.type === "task.create"
      ? command.payload.assignments.map((assignment) => assignment.resourceId)
      : command.type === "assignment.upsert" || command.type === "resource.reserve"
        ? [command.payload.resourceId]
        : command.type === "calendar.exception.upsert" && command.payload.resourceId
          ? [command.payload.resourceId]
          : [];
  return [...new Set(resourceIds)];
}
