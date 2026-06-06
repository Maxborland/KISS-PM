import { describe, expect, it } from "vitest";

import { createKissPmOpenApiDocument } from "./apiDocs/openApiDocument";

describe("CRM pipeline API contract schemas", () => {
  it("publishes first-class pipeline, stage, rule and automation schemas", () => {
    const document = createKissPmOpenApiDocument();
    const schemas = document.components.schemas;

    expect(schemas.CrmPipeline.required).toEqual([
      "id",
      "tenantId",
      "name",
      "status",
      "lifecycleGraphMetadata",
      "createdAt",
      "updatedAt"
    ]);
    expect(schemas.CrmPipelineStage.required).toEqual([
      "id",
      "tenantId",
      "pipelineId",
      "name",
      "sortOrder",
      "status",
      "lifecycleState",
      "isFinal",
      "createdAt",
      "updatedAt"
    ]);
    expect(schemas.CrmPipelineTransitionRule.required).toEqual([
      "id",
      "tenantId",
      "pipelineId",
      "fromStageId",
      "toStageId",
      "requiredPermission",
      "requiredFields",
      "requireReason",
      "status",
      "createdAt",
      "updatedAt"
    ]);
    expect(schemas.CrmPipelineStageAutomationDefinition.required).toEqual([
      "id",
      "tenantId",
      "pipelineId",
      "stageId",
      "trigger",
      "actionType",
      "actionConfig",
      "status",
      "createdAt",
      "updatedAt"
    ]);
  });

  it("documents lifecycle graph metadata separate from legacy flat deal stages", () => {
    const document = createKissPmOpenApiDocument();
    const schemas = document.components.schemas;

    expect(schemas.CrmPipelineLifecycleGraph.required).toEqual([
      "pipelineId",
      "initialStageId",
      "finalStageIds",
      "stages",
      "transitions"
    ]);
    expect(schemas.DealStage.required).toEqual([
      "id",
      "tenantId",
      "name",
      "sortOrder",
      "status",
      "createdAt",
      "updatedAt"
    ]);
  });

  it("publishes first-class pipeline management routes", () => {
    const document = createKissPmOpenApiDocument() as {
      paths: Record<string, Record<string, { responses?: Record<number, unknown>; requestBody?: unknown }>>;
    };

    expect(document.paths["/api/workspace/crm/pipelines"]?.get?.responses?.[200]).toBeDefined();
    expect(document.paths["/api/workspace/crm/pipelines"]?.post?.requestBody).toBeDefined();
    expect(document.paths["/api/workspace/crm/pipelines/{pipelineId}"]?.patch?.requestBody).toBeDefined();
    expect(document.paths["/api/workspace/crm/pipelines/{pipelineId}/stages"]?.post?.requestBody).toBeDefined();
    expect(document.paths["/api/workspace/crm/pipelines/{pipelineId}/transition-rules"]?.post?.requestBody).toBeDefined();
    expect(document.paths["/api/workspace/crm/pipelines/{pipelineId}/automations"]?.post?.requestBody).toBeDefined();
  });
});
