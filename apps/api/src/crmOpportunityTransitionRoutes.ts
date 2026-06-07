import { canManageOpportunities, type PolicyDecision } from "@kiss-pm/access-control";
import { decideCrmPipelineTransition, type TenantUser } from "@kiss-pm/domain";
import type { Context, Hono } from "hono";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import { parseCrmOpportunityPipelineTransitionBody } from "./crmParsers";
import { readLimitedJsonBody } from "./jsonBody";
import { parseOpportunityIdParam } from "./routeParamParsers";
import type { ApiRouteDeps } from "./routeTypes";

type AuditInput = Omit<ManagementAuditEventInput, "tenantId" | "actorUserId" | "sourceWorkflow"> & {
  actor: TenantUser;
};

export function registerCrmOpportunityTransitionRoutes(app: Hono, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.post("/api/workspace/opportunities/:opportunityId/pipeline-transition", async (context) => {
    const parsedOpportunityId = parseOpportunityIdParam(context.req.param("opportunityId"));
    if (!parsedOpportunityId.ok) return context.json({ error: parsedOpportunityId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findOpportunityById ||
      !dataSource.findCrmPipelineById ||
      !dataSource.findCrmPipelineStageById ||
      !dataSource.listCrmPipelineTransitionRules ||
      !dataSource.transitionOpportunityCrmPipelineStage ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const policyDecision = canManageOpportunities({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!policyDecision.allowed) {
      await audit({
        actor,
        actionType: "crm_opportunity_pipeline.transition_denied",
        sourceEntity: { type: "Opportunity", id: parsedOpportunityId.value },
        commandInput: { opportunityId: parsedOpportunityId.value },
        beforeState: null,
        afterState: null,
        permissionResult: policyDecision,
        executionResult: { status: "denied", reason: policyDecision.reason }
      });
      return context.json({ error: policyDecision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsedBody = parseCrmOpportunityPipelineTransitionBody(body.value);
    if (!parsedBody.ok) return context.json({ error: parsedBody.error }, 400);

    const opportunity = await dataSource.findOpportunityById(
      actor.tenantId,
      parsedOpportunityId.value
    );
    if (!opportunity) return context.json({ error: "opportunity_not_found" }, 404);
    if (!opportunity.crmPipelineId || !opportunity.crmPipelineStageId) {
      return denyDomain(context, {
        actor,
        opportunity,
        policyDecision,
        commandInput: parsedBody.value,
        reason: "crm_pipeline_state_not_initialized"
      });
    }

    const [currentPipeline, currentStage, targetStage, transitionRules] = await Promise.all([
      dataSource.findCrmPipelineById(actor.tenantId, opportunity.crmPipelineId),
      dataSource.findCrmPipelineStageById(
        actor.tenantId,
        opportunity.crmPipelineId,
        opportunity.crmPipelineStageId
      ),
      dataSource.findCrmPipelineStageById(
        actor.tenantId,
        opportunity.crmPipelineId,
        parsedBody.value.targetStageId
      ),
      dataSource.listCrmPipelineTransitionRules(actor.tenantId, opportunity.crmPipelineId)
    ]);

    if (!currentPipeline || currentPipeline.status !== "active") {
      return denyDomain(context, {
        actor,
        opportunity,
        policyDecision,
        commandInput: parsedBody.value,
        reason: "crm_pipeline_not_active"
      });
    }
    if (!currentStage) return context.json({ error: "crm_pipeline_current_stage_not_found" }, 409);
    if (!targetStage) return context.json({ error: "crm_pipeline_target_stage_not_found" }, 404);

    const decision = decideCrmPipelineTransition({
      currentStage,
      targetStage,
      transitionRules,
      actorPermissions: profile.permissions,
      providedFields: opportunityFieldsForTransition(opportunity),
      reason: parsedBody.value.reason
    });
    if (!decision.ok) {
      const deniedInput = {
        actor,
        opportunity,
        policyDecision,
        commandInput: parsedBody.value,
        reason: decision.reason
      };
      return denyDomain(
        context,
        "missingFields" in decision
          ? { ...deniedInput, details: { missingFields: decision.missingFields } }
          : deniedInput
      );
    }

    const transitioned = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.transitionOpportunityCrmPipelineStage) {
        throw new Error("transactional_crm_opportunity_transition_not_configured");
      }
      if (!transactionDataSource.appendAuditEvent) {
        throw new Error("transactional_audit_not_configured");
      }
      const updated = await transactionDataSource.transitionOpportunityCrmPipelineStage({
        tenantId: actor.tenantId,
        opportunityId: opportunity.id,
        pipelineId: opportunity.crmPipelineId!,
        currentStageId: opportunity.crmPipelineStageId!,
        targetStageId: parsedBody.value.targetStageId
      });
      if (!updated) return undefined;

      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "crm_opportunity_pipeline.transitioned",
          sourceWorkflow: "crm_opportunity_pipeline_transition",
          sourceEntity: { type: "Opportunity", id: opportunity.id },
          commandInput: { ...parsedBody.value, ruleId: decision.ruleId },
          beforeState: opportunity,
          afterState: updated,
          permissionResult: policyDecision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return updated;
    });
    if (!transitioned) {
      return denyDomain(context, {
        actor,
        opportunity,
        policyDecision,
        commandInput: parsedBody.value,
        reason: "crm_opportunity_pipeline_transition_conflict"
      });
    }

    return context.json({ opportunity: transitioned, transition: decision });
  });

  async function audit(input: AuditInput) {
    await appendManagementAuditEvent({
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      sourceWorkflow: "crm_opportunity_pipeline_transition",
      actionType: input.actionType,
      sourceEntity: input.sourceEntity,
      commandInput: input.commandInput,
      beforeState: input.beforeState,
      afterState: input.afterState,
      permissionResult: input.permissionResult,
      ...(input.executionResult ? { executionResult: input.executionResult } : {})
    });
  }

  async function denyDomain(
    context: Context,
    input: {
      actor: TenantUser;
      opportunity: Record<string, unknown>;
      policyDecision: PolicyDecision;
      commandInput: Record<string, unknown>;
      reason: string;
      details?: Record<string, unknown>;
    }
  ) {
    await audit({
      actor: input.actor,
      actionType: "crm_opportunity_pipeline.transition_denied",
      sourceEntity: { type: "Opportunity", id: String(input.opportunity.id) },
      commandInput: input.commandInput,
      beforeState: input.opportunity,
      afterState: null,
      permissionResult: input.policyDecision,
      executionResult: { status: "denied", reason: input.reason, ...input.details }
    });
    return context.json({ error: input.reason, ...(input.details ?? {}) }, 409);
  }
}

function opportunityFieldsForTransition(opportunity: Record<string, unknown>) {
  const customFieldValues =
    opportunity.customFieldValues && typeof opportunity.customFieldValues === "object"
      ? (opportunity.customFieldValues as Record<string, unknown>)
      : {};

  return {
    ...customFieldValues,
    id: opportunity.id,
    tenantId: opportunity.tenantId,
    clientId: opportunity.clientId,
    primaryContactId: opportunity.primaryContactId,
    ownerUserId: opportunity.ownerUserId,
    projectTypeId: opportunity.projectTypeId,
    stageId: opportunity.stageId,
    crmPipelineId: opportunity.crmPipelineId,
    crmPipelineStageId: opportunity.crmPipelineStageId,
    crmPipelineStateUpdatedAt: opportunity.crmPipelineStateUpdatedAt,
    clientName: opportunity.clientName,
    contactName: opportunity.contactName,
    title: opportunity.title,
    projectType: opportunity.projectType,
    description: opportunity.description,
    plannedStart: opportunity.plannedStart,
    plannedFinish: opportunity.plannedFinish,
    contractValue: opportunity.contractValue,
    plannedHourlyRate: opportunity.plannedHourlyRate,
    plannedHours: opportunity.plannedHours,
    probability: opportunity.probability,
    status: opportunity.status,
    templateId: opportunity.templateId,
    feasibilityStatus: opportunity.feasibilityStatus,
    feasibilityResult: opportunity.feasibilityResult,
    feasibilityCheckedAt: opportunity.feasibilityCheckedAt,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
    demand: opportunity.demand,
    customFieldValues: opportunity.customFieldValues
  };
}
