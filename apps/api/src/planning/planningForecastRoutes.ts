import {
  buildResourceLoadMatrix,
  calculatePlan,
  createPlanForecast,
  maxPlanDate,
  proposeAutoPlanningSolutions
} from "@kiss-pm/domain";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import { readLimitedJsonBody } from "../jsonBody";
import {
  appendPlanningAuditIfConfigured,
  errorResponseBody,
  parsePlanningForecastRunRouteParam,
  parseProjectRouteParam,
  requireReadablePlanningProject,
  summarizeSnapshot,
  type PlanningRouteDeps
} from "./planningRouteHelpers";
import { PLANNING_ENGINE_VERSION } from "./planningConstants";
import { canReadPlanningReadModel } from "./planningRouteAuth";

type ForecastRunEnvelope = {
  clientPlanVersion: number;
};

export function registerPlanningForecastRoutes(app: Hono, deps: PlanningRouteDeps): void {
  app.post("/api/workspace/projects/:projectId/planning/forecast-runs", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);

    const parsed = parseForecastRunEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);

    const projectId = parsedProjectId.value;
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.getPlanSnapshot ||
        !transactionDataSource.createPlanningForecastRun ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501 as const, error: "persistence_not_configured" };
      }

      const readableProject = await requireReadablePlanningProject(
        transactionDataSource,
        actor.tenantId,
        projectId
      );
      if (!readableProject.ok) return readableProject;

      const snapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!snapshot) return { ok: false as const, status: 404 as const, error: "project_not_found" };
      if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "plan_version_conflict",
          currentPlanVersion: snapshot.planVersion
        };
      }

      const calculatedPlan = calculatePlan(snapshot, {
        calculatedAt: snapshot.capturedAt,
        engineVersion: PLANNING_ENGINE_VERSION
      });
      const targetFinish = snapshot.project.deadline
        ? maxPlanDate(snapshot.project.plannedFinish, snapshot.project.deadline)
        : snapshot.project.plannedFinish;
      const horizonFinish = maxPlanDate(
        targetFinish,
        calculatedPlan.projectFinish ?? snapshot.project.plannedFinish
      );
      const resourceLoad = buildResourceLoadMatrix({
        plan: calculatedPlan,
        resources: snapshot.resources,
        assignments: snapshot.assignments,
        assignmentAllocations: snapshot.assignmentAllocations,
        calendars: snapshot.calendars,
        calendarExceptions: snapshot.calendarExceptions,
        reservations: snapshot.reservations,
        rangeStart: snapshot.project.plannedStart,
        rangeFinish: horizonFinish,
        granularities: ["day"]
      });
      const autoSolverRun = proposeAutoPlanningSolutions({
        mode: "repair",
        snapshot,
        targetDeadline: snapshot.project.deadline,
        calculatedAt: snapshot.capturedAt,
        engineVersion: PLANNING_ENGINE_VERSION
      });
      const forecast = createPlanForecast({
        snapshot,
        calculatedPlan,
        resourceLoad,
        autoSolverRun
      });
      const run = await transactionDataSource.createPlanningForecastRun({
        id: `planning-forecast-${randomUUID()}`,
        tenantId: actor.tenantId,
        projectId,
        clientPlanVersion: snapshot.planVersion,
        engineVersion: forecast.engineMetadata.engineVersion,
        health: forecast.health,
        managerSummary: forecast.managerSummary,
        riskDrivers: forecast.riskDrivers,
        recommendations: forecast.recommendations,
        engineMetadata: forecast.engineMetadata,
        engineDebug: null,
        actorUserId: actor.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });

      await appendPlanningAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "planning.forecast.run_created",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: {
            runId: run.id,
            clientPlanVersion: parsed.value.clientPlanVersion
          },
          beforeState: summarizeSnapshot(snapshot),
          afterState: null,
          permissionResult: readDecision,
          executionResult: {
            status: "created",
            health: run.health
          }
        },
        transactionDataSource
      );

      return { ok: true as const, run };
    });

    if (!result.ok) return context.json(errorResponseBody(result), result.status);
    return context.json(serializePlanningForecastRun(result.run));
  });

  app.get("/api/workspace/projects/:projectId/planning/forecast-runs/:runId", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);
    const parsedRunId = parsePlanningForecastRunRouteParam(context);
    if (!parsedRunId.ok) return context.json({ error: parsedRunId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);

    if (!deps.dataSource.findPlanningForecastRun) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const projectId = parsedProjectId.value;
    const readableProject = await requireReadablePlanningProject(deps.dataSource, actor.tenantId, projectId);
    if (!readableProject.ok) return context.json(errorResponseBody(readableProject), readableProject.status);

    const run = await deps.dataSource.findPlanningForecastRun(actor.tenantId, projectId, parsedRunId.value);
    if (!run) return context.json({ error: "planning_forecast_run_not_found" }, 404);

    return context.json(serializePlanningForecastRun(run));
  });
}

function parseForecastRunEnvelope(value: unknown):
  | { ok: true; value: ForecastRunEnvelope }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "invalid_request" };
  const clientPlanVersion = (value as { clientPlanVersion?: unknown }).clientPlanVersion;
  if (typeof clientPlanVersion !== "number" || !Number.isInteger(clientPlanVersion) || clientPlanVersion <= 0) {
    return { ok: false, error: "invalid_client_plan_version" };
  }
  return { ok: true, value: { clientPlanVersion } };
}

function serializePlanningForecastRun(run: {
  id: string;
  projectId: string;
  clientPlanVersion: number;
  engineVersion: string;
  health: string;
  managerSummary: string;
  riskDrivers: unknown[];
  recommendations: unknown[];
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    runId: run.id,
    projectId: run.projectId,
    clientPlanVersion: run.clientPlanVersion,
    engineVersion: run.engineVersion,
    health: run.health,
    managerSummary: run.managerSummary,
    riskDrivers: run.riskDrivers,
    recommendations: run.recommendations,
    expiresAt: run.expiresAt.toISOString(),
    createdAt: run.createdAt.toISOString()
  };
}
