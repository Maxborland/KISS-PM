import {
  canManageCrmPipelineAutomations,
  canManageCrmPipelineRules,
  canManageCrmPipelines,
  canReadCrmPipelines,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import type { ManagementAuditEventInput } from "./apiTypes";
import {
  parseCrmPipelineBody,
  parseCrmPipelineStageAutomationDefinitionBody,
  parseCrmPipelineStageBody,
  parseCrmPipelineTransitionRuleBody
} from "./crmParsers";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parseCrmPipelineAutomationIdParam,
  parseCrmPipelineIdParam,
  parseCrmPipelineStageIdParam,
  parseCrmPipelineTransitionRuleIdParam
} from "./routeParamParsers";
import type { ApiRouteDeps } from "./routeTypes";

export function registerCrmPipelineRoutes(app: Hono, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.get("/api/workspace/crm/pipelines", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listCrmPipelines) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadCrmPipelines({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({ pipelines: await dataSource.listCrmPipelines(actor.tenantId) });
  });

  app.post("/api/workspace/crm/pipelines", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createCrmPipeline ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageCrmPipelines({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "crm_pipeline.create_denied",
        sourceEntity: { type: "CrmPipeline", id: "unknown" },
        commandInput: { endpoint: "createCrmPipeline" },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCrmPipelineBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const pipeline = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createCrmPipeline) {
        throw new Error("transactional_crm_pipeline_create_not_configured");
      }
      const created = await transactionDataSource.createCrmPipeline(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "crm_pipeline.created",
          sourceEntity: { type: "CrmPipeline", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ pipeline }, 201);
  });

  app.patch("/api/workspace/crm/pipelines/:pipelineId", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findCrmPipelineById ||
      !dataSource.updateCrmPipeline ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const pipelineId = parsedPipelineId.value;
    const decision = canManageCrmPipelines({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "crm_pipeline.update_denied",
        sourceEntity: { type: "CrmPipeline", id: pipelineId },
        commandInput: { endpoint: "updateCrmPipeline", pipelineId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState = await dataSource.findCrmPipelineById(actor.tenantId, pipelineId);
    if (!beforeState) return context.json({ error: "crm_pipeline_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCrmPipelineBody(patchBodyWithExisting(beforeState, body.value), actor.tenantId, beforeState);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const pipeline = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateCrmPipeline) {
        throw new Error("transactional_crm_pipeline_update_not_configured");
      }
      const updated = await transactionDataSource.updateCrmPipeline(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "crm_pipeline.updated",
          sourceEntity: { type: "CrmPipeline", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });

    return context.json({ pipeline });
  });

  app.get("/api/workspace/crm/pipelines/:pipelineId/stages", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findCrmPipelineById || !dataSource.listCrmPipelineStages) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadCrmPipelines({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const pipelineId = parsedPipelineId.value;
    const pipeline = await dataSource.findCrmPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "crm_pipeline_not_found" }, 404);

    return context.json({
      stages: await dataSource.listCrmPipelineStages(actor.tenantId, pipelineId)
    });
  });

  app.post("/api/workspace/crm/pipelines/:pipelineId/stages", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findCrmPipelineById ||
      !dataSource.createCrmPipelineStage ||
      !dataSource.refreshCrmPipelineLifecycleGraph ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const pipelineId = parsedPipelineId.value;
    const decision = canManageCrmPipelines({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "crm_pipeline_stage.create_denied",
        sourceEntity: { type: "CrmPipelineStage", id: "unknown" },
        commandInput: { endpoint: "createCrmPipelineStage", pipelineId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const pipeline = await dataSource.findCrmPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "crm_pipeline_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCrmPipelineStageBody(body.value, actor.tenantId, pipelineId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const stage = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createCrmPipelineStage || !transactionDataSource.refreshCrmPipelineLifecycleGraph) {
        throw new Error("transactional_crm_pipeline_stage_create_not_configured");
      }
      const created = await transactionDataSource.createCrmPipelineStage(parsed.value);
      await transactionDataSource.refreshCrmPipelineLifecycleGraph(actor.tenantId, pipelineId);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "crm_pipeline_stage.created",
          sourceEntity: { type: "CrmPipelineStage", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ stage }, 201);
  });

  app.patch("/api/workspace/crm/pipelines/:pipelineId/stages/:stageId", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);
    const parsedStageId = parseCrmPipelineStageIdParam(context.req.param("stageId"));
    if (!parsedStageId.ok) return context.json({ error: parsedStageId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findCrmPipelineStageById ||
      !dataSource.updateCrmPipelineStage ||
      !dataSource.refreshCrmPipelineLifecycleGraph ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const pipelineId = parsedPipelineId.value;
    const stageId = parsedStageId.value;
    const decision = canManageCrmPipelines({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "crm_pipeline_stage.update_denied",
        sourceEntity: { type: "CrmPipelineStage", id: stageId },
        commandInput: { endpoint: "updateCrmPipelineStage", pipelineId, stageId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState = await dataSource.findCrmPipelineStageById(actor.tenantId, pipelineId, stageId);
    if (!beforeState) return context.json({ error: "crm_pipeline_stage_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCrmPipelineStageBody(patchBodyWithExisting(beforeState, body.value), actor.tenantId, pipelineId, stageId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const stage = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateCrmPipelineStage || !transactionDataSource.refreshCrmPipelineLifecycleGraph) {
        throw new Error("transactional_crm_pipeline_stage_update_not_configured");
      }
      const updated = await transactionDataSource.updateCrmPipelineStage(parsed.value);
      await transactionDataSource.refreshCrmPipelineLifecycleGraph(actor.tenantId, pipelineId);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "crm_pipeline_stage.updated",
          sourceEntity: { type: "CrmPipelineStage", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });

    return context.json({ stage });
  });

  app.get("/api/workspace/crm/pipelines/:pipelineId/transition-rules", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findCrmPipelineById || !dataSource.listCrmPipelineTransitionRules) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadCrmPipelines({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const pipelineId = parsedPipelineId.value;
    const pipeline = await dataSource.findCrmPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "crm_pipeline_not_found" }, 404);
    return context.json({
      transitionRules: await dataSource.listCrmPipelineTransitionRules(actor.tenantId, pipelineId)
    });
  });

  app.post("/api/workspace/crm/pipelines/:pipelineId/transition-rules", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findCrmPipelineById ||
      !dataSource.findCrmPipelineStageById ||
      !dataSource.createCrmPipelineTransitionRule ||
      !dataSource.refreshCrmPipelineLifecycleGraph ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const pipelineId = parsedPipelineId.value;
    const decision = canManageCrmPipelineRules({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "crm_pipeline_transition_rule.create_denied",
        sourceEntity: { type: "CrmPipelineTransitionRule", id: "unknown" },
        commandInput: { endpoint: "createCrmPipelineTransitionRule", pipelineId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const pipeline = await dataSource.findCrmPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "crm_pipeline_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCrmPipelineTransitionRuleBody(body.value, actor.tenantId, pipelineId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      !(await dataSource.findCrmPipelineStageById(actor.tenantId, pipelineId, parsed.value.fromStageId)) ||
      !(await dataSource.findCrmPipelineStageById(actor.tenantId, pipelineId, parsed.value.toStageId))
    ) {
      return context.json({ error: "crm_pipeline_stage_not_found" }, 404);
    }

    const transitionRule = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createCrmPipelineTransitionRule || !transactionDataSource.refreshCrmPipelineLifecycleGraph) {
        throw new Error("transactional_crm_pipeline_transition_rule_create_not_configured");
      }
      const created = await transactionDataSource.createCrmPipelineTransitionRule(parsed.value);
      await transactionDataSource.refreshCrmPipelineLifecycleGraph(actor.tenantId, pipelineId);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "crm_pipeline_transition_rule.created",
          sourceEntity: { type: "CrmPipelineTransitionRule", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ transitionRule }, 201);
  });

  app.patch("/api/workspace/crm/pipelines/:pipelineId/transition-rules/:ruleId", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);
    const parsedRuleId = parseCrmPipelineTransitionRuleIdParam(context.req.param("ruleId"));
    if (!parsedRuleId.ok) return context.json({ error: parsedRuleId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findCrmPipelineStageById ||
      !dataSource.findCrmPipelineTransitionRuleById ||
      !dataSource.updateCrmPipelineTransitionRule ||
      !dataSource.refreshCrmPipelineLifecycleGraph ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const pipelineId = parsedPipelineId.value;
    const ruleId = parsedRuleId.value;
    const decision = canManageCrmPipelineRules({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "crm_pipeline_transition_rule.update_denied",
        sourceEntity: { type: "CrmPipelineTransitionRule", id: ruleId },
        commandInput: { endpoint: "updateCrmPipelineTransitionRule", pipelineId, ruleId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState = await dataSource.findCrmPipelineTransitionRuleById(actor.tenantId, pipelineId, ruleId);
    if (!beforeState) return context.json({ error: "crm_pipeline_transition_rule_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCrmPipelineTransitionRuleBody(patchBodyWithExisting(beforeState, body.value), actor.tenantId, pipelineId, ruleId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      !(await dataSource.findCrmPipelineStageById(actor.tenantId, pipelineId, parsed.value.fromStageId)) ||
      !(await dataSource.findCrmPipelineStageById(actor.tenantId, pipelineId, parsed.value.toStageId))
    ) {
      return context.json({ error: "crm_pipeline_stage_not_found" }, 404);
    }

    const transitionRule = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateCrmPipelineTransitionRule || !transactionDataSource.refreshCrmPipelineLifecycleGraph) {
        throw new Error("transactional_crm_pipeline_transition_rule_update_not_configured");
      }
      const updated = await transactionDataSource.updateCrmPipelineTransitionRule(parsed.value);
      await transactionDataSource.refreshCrmPipelineLifecycleGraph(actor.tenantId, pipelineId);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "crm_pipeline_transition_rule.updated",
          sourceEntity: { type: "CrmPipelineTransitionRule", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });

    return context.json({ transitionRule });
  });

  app.get("/api/workspace/crm/pipelines/:pipelineId/automations", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findCrmPipelineById || !dataSource.listCrmPipelineStageAutomationDefinitions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadCrmPipelines({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const pipelineId = parsedPipelineId.value;
    const pipeline = await dataSource.findCrmPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "crm_pipeline_not_found" }, 404);
    return context.json({
      automations: await dataSource.listCrmPipelineStageAutomationDefinitions(actor.tenantId, pipelineId)
    });
  });

  app.post("/api/workspace/crm/pipelines/:pipelineId/automations", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findCrmPipelineById ||
      !dataSource.findCrmPipelineStageById ||
      !dataSource.createCrmPipelineStageAutomationDefinition ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const pipelineId = parsedPipelineId.value;
    const decision = canManageCrmPipelineAutomations({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "crm_pipeline_stage_automation.create_denied",
        sourceEntity: { type: "CrmPipelineStageAutomationDefinition", id: "unknown" },
        commandInput: { endpoint: "createCrmPipelineStageAutomationDefinition", pipelineId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const pipeline = await dataSource.findCrmPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "crm_pipeline_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCrmPipelineStageAutomationDefinitionBody(body.value, actor.tenantId, pipelineId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!(await dataSource.findCrmPipelineStageById(actor.tenantId, pipelineId, parsed.value.stageId))) {
      return context.json({ error: "crm_pipeline_stage_not_found" }, 404);
    }

    const automation = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createCrmPipelineStageAutomationDefinition) {
        throw new Error("transactional_crm_pipeline_automation_create_not_configured");
      }
      const created = await transactionDataSource.createCrmPipelineStageAutomationDefinition(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "crm_pipeline_stage_automation.created",
          sourceEntity: { type: "CrmPipelineStageAutomationDefinition", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ automation }, 201);
  });

  app.patch("/api/workspace/crm/pipelines/:pipelineId/automations/:automationId", async (context) => {
    const parsedPipelineId = parseCrmPipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) return context.json({ error: parsedPipelineId.error }, 400);
    const parsedAutomationId = parseCrmPipelineAutomationIdParam(context.req.param("automationId"));
    if (!parsedAutomationId.ok) return context.json({ error: parsedAutomationId.error }, 400);

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findCrmPipelineStageById ||
      !dataSource.findCrmPipelineStageAutomationDefinitionById ||
      !dataSource.updateCrmPipelineStageAutomationDefinition ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const pipelineId = parsedPipelineId.value;
    const automationId = parsedAutomationId.value;
    const decision = canManageCrmPipelineAutomations({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "crm_pipeline_stage_automation.update_denied",
        sourceEntity: { type: "CrmPipelineStageAutomationDefinition", id: automationId },
        commandInput: { endpoint: "updateCrmPipelineStageAutomationDefinition", pipelineId, automationId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState = await dataSource.findCrmPipelineStageAutomationDefinitionById(actor.tenantId, pipelineId, automationId);
    if (!beforeState) return context.json({ error: "crm_pipeline_stage_automation_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCrmPipelineStageAutomationDefinitionBody(
      patchBodyWithExisting(beforeState, body.value),
      actor.tenantId,
      pipelineId,
      automationId
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!(await dataSource.findCrmPipelineStageById(actor.tenantId, pipelineId, parsed.value.stageId))) {
      return context.json({ error: "crm_pipeline_stage_not_found" }, 404);
    }

    const automation = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateCrmPipelineStageAutomationDefinition) {
        throw new Error("transactional_crm_pipeline_automation_update_not_configured");
      }
      const updated = await transactionDataSource.updateCrmPipelineStageAutomationDefinition(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "crm_pipeline_stage_automation.updated",
          sourceEntity: { type: "CrmPipelineStageAutomationDefinition", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });

    return context.json({ automation });
  });

  async function getActor(cookie: string | null): Promise<TenantUser | undefined> {
    return getSessionActorFromHeaders(cookie);
  }

  async function appendDeniedAudit(input: {
    actor: TenantUser;
    actionType: string;
    sourceEntity: {
      type: string;
      id: string;
    };
    commandInput: Record<string, unknown>;
    permissionResult: PolicyDecision;
    error: string;
  }) {
    await appendManagementAuditEvent({
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: input.actionType,
      sourceWorkflow: "crm_pipeline_management",
      sourceEntity: input.sourceEntity,
      commandInput: input.commandInput,
      beforeState: null,
      afterState: null,
      permissionResult: input.permissionResult,
      executionResult: {
        status: "denied",
        error: input.error
      }
    });
  }
}

function patchBodyWithExisting<T extends object>(existing: T, body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return { ...existing, ...(body as Record<string, unknown>) };
}

function auditInput(input: {
  actor: TenantUser;
  actionType: string;
  sourceEntity: {
    type: string;
    id: string;
  };
  commandInput: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  permissionResult: PolicyDecision;
}): ManagementAuditEventInput {
  return {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "crm_pipeline_management",
    sourceEntity: input.sourceEntity,
    commandInput: input.commandInput,
    beforeState: input.beforeState,
    afterState: input.afterState,
    permissionResult: input.permissionResult
  };
}
