import { describe, expect, it } from "vitest";

import { createAccessProfile, type AccessProfile } from "@kiss-pm/access-control";
import {
  createTenantUser,
  type CrmPipeline,
  type CrmPipelineStage,
  type CrmPipelineTransitionRule
} from "@kiss-pm/domain";
import { Hono } from "hono";

import type {
  ApiTenantDataSource,
  AuditEventListItem,
  ManagementAuditEventInput,
  OpportunityRecord
} from "./apiTypes";
import { registerCrmOpportunityTransitionRoutes } from "./crmOpportunityTransitionRoutes";
import type { ApiRouteDeps } from "./routeTypes";

type DataSourceTransaction<T> = (dataSource: ApiTenantDataSource) => Promise<T>;

const actor = createTenantUser({
  id: "user-alpha-admin",
  tenantId: "tenant-alpha",
  name: "Alpha Admin",
  accessProfileId: "profile-admin"
});

const adminProfile = createAccessProfile({
  id: "profile-admin",
  permissions: ["tenant.opportunities.manage", "tenant.project_activation.manage"]
});

const readerProfile = createAccessProfile({
  id: "profile-reader",
  permissions: ["tenant.opportunities.read"]
});

describe("CRM opportunity transition routes", () => {
  it("records denied audit when base opportunity RBAC is missing", async () => {
    const fixture = createFixture(readerProfile);
    const response = await fixture.app.request(
      "/api/workspace/opportunities/opportunity-alpha/pipeline-transition",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "kiss_pm_session=test" },
        body: JSON.stringify({ targetStageId: "pipeline-stage-qualified" })
      }
    );

    expect(response.status).toBe(403);
    expect(fixture.auditEvents).toHaveLength(1);
    expect(fixture.auditEvents[0]).toMatchObject({
      actionType: "crm_opportunity_pipeline.transition_denied",
      executionResult: { status: "denied", reason: "permission_missing" }
    });
  });

  it("records domain-denied audit when transition rules require a reason", async () => {
    const fixture = createFixture(adminProfile, {
      transitionRules: [{ ...transitionRule, requireReason: true }]
    });
    const response = await fixture.app.request(
      "/api/workspace/opportunities/opportunity-alpha/pipeline-transition",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "kiss_pm_session=test" },
        body: JSON.stringify({ targetStageId: "pipeline-stage-qualified" })
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "transition_reason_required" });
    expect(fixture.auditEvents).toHaveLength(1);
    expect(fixture.auditEvents[0]).toMatchObject({
      actionType: "crm_opportunity_pipeline.transition_denied",
      sourceEntity: { type: "Opportunity", id: "opportunity-alpha" },
      executionResult: { status: "denied", reason: "transition_reason_required" }
    });
    expect(fixture.opportunity.crmPipelineStageId).toBe("pipeline-stage-intake");
  });

  it("records domain-denied audit when the current CRM pipeline has been archived", async () => {
    const fixture = createFixture(adminProfile, {
      pipeline: { ...pipeline, status: "archived" }
    });
    const response = await fixture.app.request(
      "/api/workspace/opportunities/opportunity-alpha/pipeline-transition",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "kiss_pm_session=test" },
        body: JSON.stringify({ targetStageId: "pipeline-stage-qualified" })
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "crm_pipeline_not_active" });
    expect(fixture.auditEvents).toHaveLength(1);
    expect(fixture.auditEvents[0]).toMatchObject({
      actionType: "crm_opportunity_pipeline.transition_denied",
      sourceEntity: { type: "Opportunity", id: "opportunity-alpha" },
      beforeState: {
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-intake"
      },
      executionResult: { status: "denied", reason: "crm_pipeline_not_active" }
    });
    expect(fixture.opportunity.crmPipelineStageId).toBe("pipeline-stage-intake");
  });

  it("transitions CRM pipeline state in a transaction and audits success", async () => {
    const fixture = createFixture(adminProfile, {
      transitionRules: [
        {
          ...transitionRule,
          requiredPermission: "tenant.project_activation.manage",
          requiredFields: ["contractValue"]
        }
      ]
    });
    const response = await fixture.app.request(
      "/api/workspace/opportunities/opportunity-alpha/pipeline-transition",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "kiss_pm_session=test" },
        body: JSON.stringify({
          targetStageId: "pipeline-stage-qualified",
          reason: "Qualified by PM"
        })
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-alpha",
        stageId: "deal-stage-legacy",
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-qualified"
      },
      transition: {
        ok: true,
        ruleId: "pipeline-rule-intake-qualified",
        fromStageId: "pipeline-stage-intake",
        toStageId: "pipeline-stage-qualified"
      }
    });
    expect(fixture.auditEvents).toHaveLength(1);
    expect(fixture.auditEvents[0]).toMatchObject({
      actionType: "crm_opportunity_pipeline.transitioned",
      beforeState: { crmPipelineStageId: "pipeline-stage-intake" },
      afterState: { crmPipelineStageId: "pipeline-stage-qualified" },
      executionResult: { status: "succeeded" }
    });
  });

  it("accepts required ordinary opportunity fields when they are present", async () => {
    const fixture = createFixture(adminProfile, {
      opportunity: {
        description: "Board-approved implementation scope",
        templateId: "template-enterprise"
      },
      transitionRules: [
        {
          ...transitionRule,
          requiredFields: [
            "title",
            "description",
            "clientName",
            "contactName",
            "templateId",
            "status"
          ]
        }
      ]
    });
    const response = await fixture.app.request(
      "/api/workspace/opportunities/opportunity-alpha/pipeline-transition",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "kiss_pm_session=test" },
        body: JSON.stringify({ targetStageId: "pipeline-stage-qualified" })
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-alpha",
        crmPipelineStageId: "pipeline-stage-qualified"
      },
      transition: {
        ok: true,
        ruleId: "pipeline-rule-intake-qualified"
      }
    });
    expect(fixture.auditEvents).toHaveLength(1);
    expect(fixture.auditEvents[0]).toMatchObject({
      actionType: "crm_opportunity_pipeline.transitioned",
      executionResult: { status: "succeeded" }
    });
  });

  it("records domain-denied audit when the atomic transition loses the current-state race", async () => {
    const fixture = createFixture(adminProfile, { transitionConflict: true });
    const response = await fixture.app.request(
      "/api/workspace/opportunities/opportunity-alpha/pipeline-transition",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "kiss_pm_session=test" },
        body: JSON.stringify({ targetStageId: "pipeline-stage-qualified" })
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "crm_opportunity_pipeline_transition_conflict"
    });
    expect(fixture.auditEvents).toHaveLength(1);
    expect(fixture.auditEvents[0]).toMatchObject({
      actionType: "crm_opportunity_pipeline.transition_denied",
      beforeState: { crmPipelineStageId: "pipeline-stage-intake" },
      executionResult: {
        status: "denied",
        reason: "crm_opportunity_pipeline_transition_conflict"
      }
    });
    expect(fixture.opportunity.crmPipelineStageId).toBe("pipeline-stage-intake");
  });
});

const now = new Date("2026-06-06T00:00:00.000Z");

const pipeline: CrmPipeline = {
  id: "pipeline-sales",
  tenantId: "tenant-alpha",
  name: "Sales",
  status: "active",
  lifecycleGraphMetadata: {
    pipelineId: "pipeline-sales",
    initialStageId: "pipeline-stage-intake",
    finalStageIds: [],
    stages: [],
    transitions: []
  },
  createdAt: now,
  updatedAt: now
};

const currentStage: CrmPipelineStage = {
  id: "pipeline-stage-intake",
  tenantId: "tenant-alpha",
  pipelineId: "pipeline-sales",
  name: "Intake",
  sortOrder: 10,
  status: "active",
  lifecycleState: "open",
  isFinal: false,
  createdAt: now,
  updatedAt: now
};

const targetStage: CrmPipelineStage = {
  ...currentStage,
  id: "pipeline-stage-qualified",
  name: "Qualified",
  sortOrder: 20
};

const transitionRule: CrmPipelineTransitionRule = {
  id: "pipeline-rule-intake-qualified",
  tenantId: "tenant-alpha",
  pipelineId: "pipeline-sales",
  fromStageId: "pipeline-stage-intake",
  toStageId: "pipeline-stage-qualified",
  requiredPermission: null,
  requiredFields: [],
  requireReason: false,
  status: "active",
  createdAt: now,
  updatedAt: now
};

function createOpportunity(): OpportunityRecord {
  return {
    id: "opportunity-alpha",
    tenantId: "tenant-alpha",
    clientId: null,
    primaryContactId: null,
    ownerUserId: null,
    projectTypeId: null,
    stageId: "deal-stage-legacy",
    crmPipelineId: "pipeline-sales",
    crmPipelineStageId: "pipeline-stage-intake",
    crmPipelineStateUpdatedAt: now,
    clientName: "Client",
    contactName: "Contact",
    title: "Opportunity",
    projectType: "Implementation",
    description: null,
    plannedStart: now,
    plannedFinish: now,
    contractValue: 100000,
    plannedHourlyRate: 5000,
    plannedHours: 20,
    probability: 60,
    status: "new",
    templateId: null,
    feasibilityStatus: null,
    feasibilityResult: null,
    feasibilityCheckedAt: null,
    createdAt: now,
    updatedAt: now,
    demand: [],
    customFieldValues: {}
  };
}

function createFixture(
  profile: AccessProfile,
  overrides: {
    pipeline?: CrmPipeline;
    transitionRules?: CrmPipelineTransitionRule[];
    transitionConflict?: boolean;
    opportunity?: Partial<OpportunityRecord>;
  } = {}
) {
  const app = new Hono();
  const auditEvents: AuditEventListItem[] = [];
  let opportunity = { ...createOpportunity(), ...overrides.opportunity };
  const transitionRules = overrides.transitionRules ?? [transitionRule];
  const dataSource: ApiTenantDataSource = {
    async listDevUsers() { return []; },
    async findUserById() { return actor; },
    async findTenantById() { return { id: "tenant-alpha", name: "Alpha" }; },
    async listUsersByTenantId() { return [actor]; },
    async findCrmPipelineById(_tenantId, pipelineId) {
      const currentPipeline = overrides.pipeline ?? pipeline;
      return pipelineId === currentPipeline.id ? currentPipeline : undefined;
    },
    async findOpportunityById() { return opportunity; },
    async findCrmPipelineStageById(_tenantId, _pipelineId, stageId) {
      if (stageId === currentStage.id) return currentStage;
      if (stageId === targetStage.id) return targetStage;
      return undefined;
    },
    async listCrmPipelineTransitionRules() { return transitionRules; },
    async transitionOpportunityCrmPipelineStage(input) {
      if (overrides.transitionConflict) return undefined;
      if (
        opportunity.crmPipelineId !== input.pipelineId ||
        opportunity.crmPipelineStageId !== input.currentStageId
      ) {
        return undefined;
      }
      opportunity = {
        ...opportunity,
        crmPipelineStageId: input.targetStageId,
        crmPipelineStateUpdatedAt: new Date("2026-06-06T01:00:00.000Z")
      };
      return opportunity;
    },
    async appendAuditEvent(input) {
      auditEvents.push({ ...input, sourceSurfaceId: input.sourceSurfaceId ?? null, sourceWorkflow: input.sourceWorkflow ?? null });
    },
    async withTransaction<T>(operation: DataSourceTransaction<T>) {
      return operation(dataSource);
    }
  };

  const deps = {
    dataSource,
    getSessionActorFromHeaders: async () => actor,
    getActorProfile: async () => profile,
    runDataSourceTransaction: async <T>(operation: DataSourceTransaction<T>) =>
      operation(dataSource),
    appendManagementAuditEvent: async (input: ManagementAuditEventInput, auditDataSource = dataSource) => {
      await auditDataSource.appendAuditEvent?.({
        id: `audit-${auditEvents.length + 1}`,
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
        correlationId: "corr-test",
        createdAt: now
      });
      return `audit-${auditEvents.length}`;
    }
  } as unknown as ApiRouteDeps;

  registerCrmOpportunityTransitionRoutes(app, deps);
  return { app, auditEvents, get opportunity() { return opportunity; } };
}
