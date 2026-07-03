import type { PolicyDecision } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Context } from "hono";

import { appendPlanningAuditIfConfigured, errorResponseBody, type PlanningRouteDeps } from "./planningRouteHelpers";

type FailedTransactionResult = { ok: false; status: number; error: string } & Record<string, unknown>;

/**
 * Единый маппинг проваленного результата транзакции → HTTP-ответ. 409 сохраняет доп-поля
 * (currentPlanVersion и т.п.) через errorResponseBody; остальные статусы отдают только error.
 * Заменяет три копипаст-лестницы (apply-command / apply-command-batch / auto-solver apply) — политика
 * «как сериализуется какой статус» теперь в одном месте.
 */
export function respondFromFailedResult(context: Context, result: FailedTransactionResult) {
  if (result.status === 501) return context.json({ error: result.error }, 501);
  if (result.status === 404) return context.json({ error: result.error }, 404);
  if (result.status === 409) return context.json(errorResponseBody(result), 409);
  return context.json({ error: result.error }, 400);
}

/**
 * Отклонённое планировочное действие: единообразно пишет audit-событие (executionResult: denied) и
 * возвращает 403. Раньше каждый deny-путь копипастил ~13 строк аудита, а batch read-deny пропускал
 * аудит вовсе — теперь любой отказ auditable-by-construction (комплаенс-инвариант в сигнатуре, не в prose).
 */
export async function denyPlanningAction(
  deps: PlanningRouteDeps,
  context: Context,
  input: {
    actor: TenantUser;
    projectId: string;
    actionType: "planning.command_denied" | "planning.scenario_denied";
    decision: PolicyDecision;
    commandInput: Record<string, unknown>;
  }
) {
  await appendPlanningAuditIfConfigured(deps, {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "planning",
    sourceEntity: { type: "Project", id: input.projectId },
    commandInput: input.commandInput,
    beforeState: null,
    afterState: null,
    permissionResult: input.decision,
    executionResult: { status: "denied" }
  });
  return context.json({ error: input.decision.reason }, 403);
}
