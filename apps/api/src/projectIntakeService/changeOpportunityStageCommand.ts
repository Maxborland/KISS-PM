import { evaluateStageTransition } from "@kiss-pm/domain";
import type { TenantUser } from "@kiss-pm/domain";
import { authorizeOpportunityStageChange } from "./authorization";
import { isFinalOpportunityStatus } from "./opportunityStatus";
import type {
  ChangeOpportunityStageResult,
  ProjectIntakeServiceDeps
} from "./types";

export async function changeOpportunityStage(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
    stageId: string;
  }
): Promise<ChangeOpportunityStageResult> {
  const authorization = await authorizeOpportunityStageChange(deps, input);
  if (!authorization.ok) return authorization;

  const opportunity = await deps.dataSource.findOpportunityById!(
    input.actor.tenantId,
    input.opportunityId
  );
  if (!opportunity) return { ok: false, status: 404, error: "opportunity_not_found" };
  if (isFinalOpportunityStatus(opportunity.status)) {
    return { ok: false, status: 409, error: "opportunity_stage_locked" };
  }

  const stage = await deps.dataSource.findDealStageById!(
    input.actor.tenantId,
    input.stageId
  );
  if (!stage || stage.status !== "active") {
    return { ok: false, status: 404, error: "deal_stage_not_found" };
  }

  // Мультиворонки: проверка правил перехода ВНУТРИ воронки сделки.
  // Исходную воронку берём из текущей стадии сделки; если её нет (сделка без
  // стадии, метод/правила не настроены) — переход разрешён (back-compat).
  const currentStage = opportunity.stageId
    ? await deps.dataSource.findDealStageById!(input.actor.tenantId, opportunity.stageId)
    : undefined;
  const sourcePipelineId = currentStage?.pipelineId ?? null;
  const transitions =
    sourcePipelineId && deps.dataSource.listStageTransitions
      ? await deps.dataSource.listStageTransitions(input.actor.tenantId, sourcePipelineId)
      : [];
  const decision = evaluateStageTransition({
    opportunity: {
      finalized: false,
      stageId: opportunity.stageId ?? null,
      pipelineId: sourcePipelineId,
      probability: opportunity.probability,
      feasibilityStatus: opportunity.feasibilityStatus ?? null
    },
    targetStage: { id: stage.id, pipelineId: stage.pipelineId ?? null },
    transitions: transitions.map((transition) => ({
      fromStageId: transition.fromStageId,
      toStageId: transition.toStageId,
      requireFeasibilityOk: transition.requireFeasibilityOk,
      minProbability: transition.minProbability
    }))
  });
  if (!decision.allowed) {
    // Условия перехода (вероятность/реализуемость) → 422; остальное (запрет
    // перехода, кросс-воронка, финал) → 409.
    const status =
      decision.reason === "condition_probability" ||
      decision.reason === "condition_feasibility"
        ? 422
        : 409;
    return { ok: false, status, error: decision.reason };
  }

  const opportunityAfterChange = await deps.runDataSourceTransaction(
    async (transactionDataSource) => {
      if (!transactionDataSource.updateOpportunityStage) {
        throw new Error("transactional_opportunity_stage_not_configured");
      }

      const updated = await transactionDataSource.updateOpportunityStage({
        tenantId: input.actor.tenantId,
        opportunityId: opportunity.id,
        stageId: stage.id,
        // Мультиворонки: синхронизируем воронку сделки с воронкой целевой стадии.
        pipelineId: stage.pipelineId ?? null
      });
      if (!updated) {
        return undefined;
      }
      await deps.appendManagementAuditEvent(
        {
          tenantId: input.actor.tenantId,
          actorUserId: input.actor.id,
          actionType: "opportunity.stage_updated",
          sourceWorkflow: "crm_intake",
          sourceEntity: {
            type: "Opportunity",
            id: opportunity.id
          },
          commandInput: {
            opportunityId: opportunity.id,
            stageId: stage.id
          },
          beforeState: opportunity,
          afterState: updated,
          permissionResult: authorization.decision
        },
        transactionDataSource
      );

      return updated;
    }
  );

  if (!opportunityAfterChange) {
    return { ok: false, status: 409, error: "opportunity_stage_locked" };
  }

  return { ok: true, status: 200, opportunity: opportunityAfterChange };
}
