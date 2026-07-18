import type { Handler, Hono } from "hono";

import { canApplyPlanningScenarios } from "@kiss-pm/access-control";

import { readLimitedJsonBody } from "../jsonBody";
import { parseScenarioRejectEnvelope } from "../planningParsers";
import { requireCapabilities } from "../dataSourceCapabilities";
import { canReadPlanningReadModel } from "./planningRouteAuth";
import { denyPlanningAction, respondFromFailedResult } from "./planningRouteResponders";
import {
  appendPlanningAuditIfConfigured,
  parseProjectRouteParam,
  parseScenarioProposalRouteParam,
  type PlanningRouteDeps
} from "./planningRouteHelpers";

/**
 * Явное отклонение persisted scenario run (reject-flow): до этого статус «отклонён»
 * существовал только неявно (истечение TTL). RBAC как у preview/apply: право применения
 * (canApplyPlanningScenarios) + право чтения план-модели (canReadPlanningReadModel).
 * Отклонённый run нельзя
 * применить (409 scenario_rejected в apply), повторный reject — 409. План не мутирует,
 * версия плана не растёт; факт отклонения фиксируется аудитом planning.scenario.rejected.
 */
export function registerPlanningScenarioRejectRoute(app: Hono, deps: PlanningRouteDeps) {
  const rejectScenarioProposal: Handler = async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);
    const parsedScenarioRunId = parseScenarioProposalRouteParam(context);
    if (!parsedScenarioRunId.ok) return context.json({ error: parsedScenarioRunId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseScenarioRejectEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = canApplyPlanningScenarios({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      return await denyPlanningAction(deps, context, {
        actor,
        projectId: parsedProjectId.value,
        actionType: "planning.scenario_denied",
        decision,
        commandInput: { scenarioRunId: parsedScenarioRunId.value, intent: "reject" }
      });
    }
    // Как preview/apply: без права чтения план-модели нельзя и отклонять — иначе
    // actor c apply-без-read мог бы инвалидировать любой известный ему scenario id.
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      return await denyPlanningAction(deps, context, {
        actor,
        projectId: parsedProjectId.value,
        actionType: "planning.scenario_denied",
        decision: readDecision,
        commandInput: { scenarioRunId: parsedScenarioRunId.value, intent: "reject" }
      });
    }

    const result = await deps.runDataSourceTransaction(async (rawStore) => {
      const transactionDataSource = requireCapabilities(rawStore, [
        "findPlanningScenarioRun",
        "markPlanningScenarioRunRejected",
        "appendAuditEvent",
        "lockTenantResourcePlanning"
      ]);
      if (!transactionDataSource) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }

      const projectId = parsedProjectId.value;
      // Тот же tenant-lock, что у apply: сериализует гонку apply↔reject одного run,
      // иначе run мог бы оказаться одновременно применённым и отклонённым.
      await transactionDataSource.lockTenantResourcePlanning(actor.tenantId);
      const scenarioRun = await transactionDataSource.findPlanningScenarioRun(
        actor.tenantId,
        projectId,
        parsedScenarioRunId.value
      );
      // Не найден = и «нет такого», и «чужой project/tenant» — единый ответ,
      // существование чужих run'ов не раскрываем (как в apply).
      if (!scenarioRun) return { ok: false as const, status: 404, error: "scenario_not_found" };
      if (scenarioRun.appliedAt) {
        return { ok: false as const, status: 409, error: "planning_scenario_already_applied" };
      }
      if (scenarioRun.rejectedAt) {
        return { ok: false as const, status: 409, error: "planning_scenario_already_rejected" };
      }

      const rejectedAt = new Date();
      await transactionDataSource.markPlanningScenarioRunRejected({
        tenantId: actor.tenantId,
        projectId,
        scenarioRunId: scenarioRun.id,
        rejectedAt,
        rejectedReason: parsed.value.reason
      });
      await appendPlanningAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "planning.scenario.rejected",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: { scenarioRunId: scenarioRun.id, reason: parsed.value.reason },
          beforeState: { planVersion: scenarioRun.planVersion },
          afterState: {
            rejectedAt: rejectedAt.toISOString(),
            rejectedReason: parsed.value.reason
          },
          permissionResult: decision
        },
        transactionDataSource
      );
      return {
        ok: true as const,
        body: { scenarioRunId: scenarioRun.id, rejectedAt: rejectedAt.toISOString() }
      };
    });

    if (!result.ok) return respondFromFailedResult(context, result);
    return context.json(result.body);
  };

  app.post(
    "/api/workspace/projects/:projectId/planning/scenarios/:scenarioId/reject",
    rejectScenarioProposal
  );
}
