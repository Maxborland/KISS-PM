import { describe, expect, it } from "vitest";

import { createAccessProfile } from "@kiss-pm/access-control";
import {
  buildCrmPipelineLifecycleGraph,
  createTenantUser,
  type CrmPipeline,
  type CrmPipelineStage,
  type CrmPipelineStageAutomationDefinition,
  type CrmPipelineTransitionRule
} from "@kiss-pm/domain";
import { Hono } from "hono";

import type {
  ApiTenantDataSource,
  AuditEventListItem,
  ManagementAuditEventInput
} from "./apiTypes";
import { registerCrmPipelineRoutes } from "./crmPipelineRoutes";
import type { ApiRouteDeps } from "./routeTypes";

const actor = createTenantUser({
  id: "user-alpha-admin",
  tenantId: "tenant-alpha",
  name: "Alpha Admin",
  accessProfileId: "profile-admin"
});

const adminProfile = createAccessProfile({
  id: "profile-admin",
  permissions: [
    "tenant.crm_pipelines.read",
    "tenant.crm_pipelines.manage",
    "tenant.crm_pipeline_rules.manage",
    "tenant.crm_pipeline_automations.manage"
  ]
});

const readerProfile = createAccessProfile({
  id: "profile-reader",
  permissions: ["tenant.crm_pipelines.read"]
});

describe("CRM pipeline routes", () => {
  it("creates, lists and updates pipeline management entities with audit events", async () => {
    const fixture = createRouteFixture(adminProfile);
    const headers = {
      "content-type": "application/json",
      cookie: "kiss_pm_session=test"
    };

    const pipelineResponse = await fixture.app.request("/api/workspace/crm/pipelines", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "pipeline-architecture", name: "Architecture" })
    });
    expect(pipelineResponse.status).toBe(201);

    const intakeStageResponse = await fixture.app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture/stages",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "pipeline-stage-intake", name: "Intake", sortOrder: 10 })
      }
    );
    const wonStageResponse = await fixture.app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture/stages",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "pipeline-stage-won",
          name: "Won",
          sortOrder: 90,
          lifecycleState: "won_closed",
          isFinal: true
        })
      }
    );
    expect(intakeStageResponse.status).toBe(201);
    expect(wonStageResponse.status).toBe(201);

    const ruleResponse = await fixture.app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture/transition-rules",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "pipeline-rule-intake-won",
          fromStageId: "pipeline-stage-intake",
          toStageId: "pipeline-stage-won",
          requiredFields: ["contractValue"],
          requireReason: true
        })
      }
    );
    expect(ruleResponse.status).toBe(201);

    const automationResponse = await fixture.app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture/automations",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "pipeline-automation-handoff",
          stageId: "pipeline-stage-won",
          trigger: "stage_entered",
          actionType: "create_task",
          actionConfig: { title: "Prepare handoff" }
        })
      }
    );
    expect(automationResponse.status).toBe(201);

    const listResponse = await fixture.app.request("/api/workspace/crm/pipelines", {
      headers: { cookie: "kiss_pm_session=test" }
    });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      pipelines: [
        {
          id: "pipeline-architecture",
          lifecycleGraphMetadata: {
            initialStageId: "pipeline-stage-intake",
            finalStageIds: ["pipeline-stage-won"],
            transitions: [
              {
                ruleId: "pipeline-rule-intake-won",
                fromStageId: "pipeline-stage-intake",
                toStageId: "pipeline-stage-won"
              }
            ]
          }
        }
      ]
    });
    expect(fixture.auditEvents.map((event) => event.actionType)).toEqual([
      "crm_pipeline.created",
      "crm_pipeline_stage.created",
      "crm_pipeline_stage.created",
      "crm_pipeline_transition_rule.created",
      "crm_pipeline_stage_automation.created"
    ]);
  });

  it("records denied audit events for forbidden mutations", async () => {
    const fixture = createRouteFixture(readerProfile);
    const response = await fixture.app.request("/api/workspace/crm/pipelines", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "kiss_pm_session=test"
      },
      body: JSON.stringify({ id: "pipeline-denied", name: "Denied" })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(fixture.auditEvents).toEqual([
      expect.objectContaining({
        actionType: "crm_pipeline.create_denied",
        executionResult: { status: "denied", error: "permission_missing" }
      })
    ]);
  });
});

function createRouteFixture(profile = adminProfile) {
  const app = new Hono();
  const auditEvents: AuditEventListItem[] = [];
  const pipelines: CrmPipeline[] = [];
  const stages: CrmPipelineStage[] = [];
  const transitionRules: CrmPipelineTransitionRule[] = [];
  const automations: CrmPipelineStageAutomationDefinition[] = [];
  const now = new Date("2026-06-06T00:00:00.000Z");

  const dataSource: ApiTenantDataSource = {
    async listDevUsers() {
      return [actor];
    },
    async findUserById(userId) {
      return userId === actor.id ? actor : undefined;
    },
    async findTenantById(tenantId) {
      return tenantId === actor.tenantId ? { id: tenantId, name: "Alpha" } : undefined;
    },
    async listUsersByTenantId(tenantId) {
      return tenantId === actor.tenantId ? [actor] : [];
    },
    async listCrmPipelines(tenantId) {
      return pipelines.filter((pipeline) => pipeline.tenantId === tenantId);
    },
    async findCrmPipelineById(tenantId, pipelineId) {
      return pipelines.find((pipeline) => pipeline.tenantId === tenantId && pipeline.id === pipelineId);
    },
    async createCrmPipeline(input) {
      const pipeline = { ...input, createdAt: now, updatedAt: now };
      pipelines.push(pipeline);
      return pipeline;
    },
    async updateCrmPipeline(input) {
      const index = pipelines.findIndex((pipeline) => pipeline.tenantId === input.tenantId && pipeline.id === input.id);
      const pipeline = { ...input, createdAt: pipelines[index]?.createdAt ?? now, updatedAt: now };
      pipelines[index] = pipeline;
      return pipeline;
    },
    async refreshCrmPipelineLifecycleGraph(tenantId, pipelineId) {
      const pipeline = await this.findCrmPipelineById?.(tenantId, pipelineId);
      if (!pipeline) return undefined;
      const lifecycleGraphMetadata = buildCrmPipelineLifecycleGraph({
        pipelineId,
        stages: stages.filter((stage) => stage.tenantId === tenantId && stage.pipelineId === pipelineId),
        transitionRules: transitionRules.filter((rule) => rule.tenantId === tenantId && rule.pipelineId === pipelineId)
      });
      return this.updateCrmPipeline?.({ ...pipeline, lifecycleGraphMetadata });
    },
    async listCrmPipelineStages(tenantId, pipelineId) {
      return stages.filter((stage) => stage.tenantId === tenantId && stage.pipelineId === pipelineId);
    },
    async findCrmPipelineStageById(tenantId, pipelineId, stageId) {
      return stages.find((stage) => stage.tenantId === tenantId && stage.pipelineId === pipelineId && stage.id === stageId);
    },
    async createCrmPipelineStage(input) {
      const stage = { ...input, createdAt: now, updatedAt: now };
      stages.push(stage);
      return stage;
    },
    async updateCrmPipelineStage(input) {
      const index = stages.findIndex((stage) => stage.tenantId === input.tenantId && stage.pipelineId === input.pipelineId && stage.id === input.id);
      const stage = { ...input, createdAt: stages[index]?.createdAt ?? now, updatedAt: now };
      stages[index] = stage;
      return stage;
    },
    async listCrmPipelineTransitionRules(tenantId, pipelineId) {
      return transitionRules.filter((rule) => rule.tenantId === tenantId && rule.pipelineId === pipelineId);
    },
    async findCrmPipelineTransitionRuleById(tenantId, pipelineId, ruleId) {
      return transitionRules.find((rule) => rule.tenantId === tenantId && rule.pipelineId === pipelineId && rule.id === ruleId);
    },
    async createCrmPipelineTransitionRule(input) {
      const rule = { ...input, createdAt: now, updatedAt: now };
      transitionRules.push(rule);
      return rule;
    },
    async updateCrmPipelineTransitionRule(input) {
      const index = transitionRules.findIndex((rule) => rule.tenantId === input.tenantId && rule.pipelineId === input.pipelineId && rule.id === input.id);
      const rule = { ...input, createdAt: transitionRules[index]?.createdAt ?? now, updatedAt: now };
      transitionRules[index] = rule;
      return rule;
    },
    async listCrmPipelineStageAutomationDefinitions(tenantId, pipelineId) {
      return automations.filter((automation) => automation.tenantId === tenantId && automation.pipelineId === pipelineId);
    },
    async findCrmPipelineStageAutomationDefinitionById(tenantId, pipelineId, automationId) {
      return automations.find((automation) => automation.tenantId === tenantId && automation.pipelineId === pipelineId && automation.id === automationId);
    },
    async createCrmPipelineStageAutomationDefinition(input) {
      const automation = { ...input, createdAt: now, updatedAt: now };
      automations.push(automation);
      return automation;
    },
    async updateCrmPipelineStageAutomationDefinition(input) {
      const index = automations.findIndex((automation) => automation.tenantId === input.tenantId && automation.pipelineId === input.pipelineId && automation.id === input.id);
      const automation = { ...input, createdAt: automations[index]?.createdAt ?? now, updatedAt: now };
      automations[index] = automation;
      return automation;
    },
    async appendAuditEvent(input) {
      auditEvents.push({
        ...input,
        sourceSurfaceId: input.sourceSurfaceId ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null
      });
    },
    async withTransaction(operation) {
      return operation(dataSource);
    }
  };

  const deps = {
    dataSource,
    async getSessionActorFromHeaders(cookie: string | null) {
      return cookie ? actor : undefined;
    },
    async getActorProfile() {
      return profile;
    },
    async runDataSourceTransaction<T>(
      operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
    ) {
      return operation(dataSource);
    },
    async appendManagementAuditEvent(
      input: ManagementAuditEventInput,
      auditDataSource = dataSource
    ) {
      const auditEventId = input.auditEventId ?? `audit-${auditEvents.length + 1}`;
      await auditDataSource.appendAuditEvent?.({
        id: auditEventId,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actionType: input.actionType,
        sourceSurfaceId: null,
        sourceWorkflow: input.sourceWorkflow,
        sourceEntity: input.sourceEntity,
        input: input.commandInput,
        beforeState: input.beforeState,
        afterState: input.afterState,
        permissionResult: input.permissionResult,
        executionResult: input.executionResult ?? { status: "succeeded" },
        correlationId: "correlation-test",
        createdAt: now
      });
      return auditEventId;
    }
  } as unknown as ApiRouteDeps;

  registerCrmPipelineRoutes(app, deps);
  return { app, auditEvents };
}
