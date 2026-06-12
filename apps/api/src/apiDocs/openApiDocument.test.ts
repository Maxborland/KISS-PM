import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { callEventTypes } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";
import {
  createKissPmOpenApiDocument,
  listAllKnownApiRoutes,
  listDocumentedApiRoutes
} from "./openApiDocument";

describe("OpenAPI route inventory", () => {
  it("documents every implemented Hono route", () => {
    const actualRoutes = listImplementedRoutes(join(process.cwd(), "apps/api/src"));
    const documentedRoutes = new Set(
      listAllKnownApiRoutes().map((route) => `${route.method} ${route.path}`)
    );

    expect(actualRoutes.filter((route) => !documentedRoutes.has(route)).sort()).toEqual([]);
    expect([...documentedRoutes].filter((route) => !actualRoutes.includes(route)).sort()).toEqual(
      []
    );
  });

  it("omits test-hook routes from the public OpenAPI document", () => {
    const document = createTestDocument();

    expect(
      document.paths["/api/workspace/projects/{projectId}/planning/test/bump-plan-version"]
    ).toBeUndefined();
    expect(
      listDocumentedApiRoutes().some((route) => route.path.includes("/planning/test/"))
    ).toBe(false);
  });

  it("omits dev-only routes from the public OpenAPI document", () => {
    const document = createTestDocument();

    expect(document.paths["/api/session/dev-users"]).toBeUndefined();
    expect(document.paths["/api/session/dev-login"]).toBeUndefined();
    expect(document.paths["/api/tenant/current"]?.get).toBeUndefined();
    expect(listDocumentedApiRoutes().some((route) => route.auth === "dev")).toBe(false);
  });

  it("documents scheduled task assignee as a required query parameter", () => {
    const document = createTestDocument();
    const scheduledTasksOperation = document.paths["/api/tenant/current/scheduled-tasks"]?.get;
    const assigneeParam = scheduledTasksOperation?.parameters?.find(
      (parameter) => parameter.name === "assigneeUserId"
    );

    expect(assigneeParam?.required).toBe(true);
  });

  it("keeps operation IDs unique", () => {
    const document = createTestDocument();
    const operationIds = Object.values(document.paths).flatMap((pathItem) =>
      Object.values(pathItem).map((operation) => operation.operationId)
    );

    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(operationIds).toContain("get_health_live");
    expect(operationIds).toContain("get_api_health_live");
  });

  it("does not require request bodies for schema-less mutations", () => {
    const document = createTestDocument();

    expect(document.paths["/api/auth/logout"]?.post?.requestBody).toBeUndefined();
    expect(
      document.paths["/api/workspace/projects/{projectId}/control/evaluate"]?.post?.requestBody
    ).toBeUndefined();
    expect(document.paths["/api/auth/login"]?.post?.requestBody).toBeDefined();
  });

  it("documents opportunity pipeline transition request and success schemas", () => {
    const document = createTestDocument();
    const operation =
      document.paths["/api/workspace/opportunities/{opportunityId}/pipeline-transition"]?.post;

    expect(
      operation?.requestBody?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/OpportunityPipelineTransitionRequest");
    expect(
      operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/OpportunityPipelineTransitionResponse");

    const requestSchema = document.components.schemas.OpportunityPipelineTransitionRequest;
    expect(requestSchema.required).toEqual(["targetStageId"]);
    expect(Object.keys(requestSchema.properties)).toEqual(["targetStageId", "reason"]);
    expect(requestSchema.properties.targetStageId).toMatchObject({ type: "string", minLength: 1 });

    const responseSchema = document.components.schemas.OpportunityPipelineTransitionResponse;
    expect(responseSchema.required).toEqual(["opportunity", "transition"]);
    expect(responseSchema.properties.opportunity).toEqual({ $ref: "#/components/schemas/Opportunity" });
    expect(responseSchema.properties.transition).toEqual({
      $ref: "#/components/schemas/CrmPipelineTransitionDecision"
    });
  });

  it("documents project activation request parser shape", () => {
    const document = createTestDocument();
    const operation =
      document.paths["/api/workspace/opportunities/{opportunityId}/activate"]?.post;

    expect(
      operation?.requestBody?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/ProjectActivationRequest");

    const requestSchema = document.components.schemas.ProjectActivationRequest as any;
    expect(requestSchema.required).toBeUndefined();
    expect(Object.keys(requestSchema.properties)).toEqual(["id", "acceptedRiskReason"]);
    expect(requestSchema.properties.id).toMatchObject({ type: "string", minLength: 1 });
    expect(requestSchema.properties.acceptedRiskReason).toEqual({
      type: ["string", "null"],
      maxLength: 500
    });
    expect(requestSchema.properties.projectId).toBeUndefined();
    expect(requestSchema.properties.templateId).toBeUndefined();
    expect(requestSchema.properties.plannedStart).toBeUndefined();
    expect(requestSchema.properties.plannedFinish).toBeUndefined();
  });

  it("documents writable opportunity CRM pipeline state fields", () => {
    const document = createTestDocument();
    const schema = document.components.schemas.OpportunityWriteRequest;

    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.crmPipelineId).toEqual({ type: ["string", "null"], minLength: 1 });
    expect(schema.properties.crmPipelineStageId).toEqual({
      type: ["string", "null"],
      minLength: 1
    });
  });

  it("documents opportunity response CRM pipeline state fields", () => {
    const document = createTestDocument();
    const schema = document.components.schemas.Opportunity;

    expect(schema.properties.crmPipelineId).toEqual({ type: ["string", "null"], minLength: 1 });
    expect(schema.properties.crmPipelineStageId).toEqual({
      type: ["string", "null"],
      minLength: 1
    });
    expect(schema.properties.crmPipelineStateUpdatedAt).toEqual({
      type: ["string", "null"],
      format: "date-time"
    });
  });

  it("documents the workspace admin read model contract", () => {
    const document = createTestDocument();

    expect(
      document.paths["/api/workspace/admin/read-model"]?.get?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema
    ).toEqual({ $ref: "#/components/schemas/WorkspaceAdminReadModelResponse" });
    expect(document.components.schemas.WorkspaceAdminReadModelResponse).toEqual({
      type: "object",
      required: ["users", "positions", "accessRoles", "permissionCatalogue", "customFields"],
      properties: {
        users: { type: "array", items: { $ref: "#/components/schemas/WorkspaceUser" } },
        positions: { type: "array", items: { $ref: "#/components/schemas/Position" } },
        accessRoles: { type: "array", items: { $ref: "#/components/schemas/AccessProfile" } },
        permissionCatalogue: {
          type: "array",
          items: { type: "string", minLength: 1 }
        },
        customFields: { type: "array", items: { $ref: "#/components/schemas/CustomField" } }
      }
    });
  });

  it("documents project lifecycle status contract", () => {
    const document = createTestDocument();
    const operation = document.paths["/api/workspace/projects/{projectId}/status"]?.patch;

    expect(
      operation?.requestBody?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/ProjectStatusUpdateRequest");
    expect(
      operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/ProjectResponse");

    const projectStatusSchema = document.components.schemas.ProjectStatus;
    expect(projectStatusSchema).toEqual({
      type: "string",
      enum: ["draft", "active", "paused", "closed", "cancelled"]
    });

    const requestSchema = document.components.schemas.ProjectStatusUpdateRequest;
    expect(requestSchema.required).toEqual(["status"]);
    expect(requestSchema.properties.status.enum).toEqual([
      "active",
      "paused"
    ]);
    expect(document.components.schemas.Project.properties.status).toEqual({
      $ref: "#/components/schemas/ProjectStatus"
    });
  });

  it("documents the shared call event type enum from the domain contract", () => {
    const document = createTestDocument();

    expect(document.components.schemas.CallEvent.properties.eventType).toEqual({
      type: "string",
      enum: [...callEventTypes]
    });
  });

  it("documents project resource pool contract", () => {
    const document = createTestDocument();
    const readOperation = document.paths["/api/workspace/projects/{projectId}/resource-pool"]?.get;
    const replaceOperation = document.paths["/api/workspace/projects/{projectId}/resource-pool"]?.put;

    expect(
      readOperation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/ProjectResourcePoolResponse");
    expect(
      replaceOperation?.requestBody?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/ProjectResourcePoolReplaceRequest");
    expect(
      replaceOperation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/ProjectResourcePoolResponse");

    const roleSchema = document.components.schemas.ProjectResourcePoolRole;
    expect(roleSchema.enum).toEqual(["project_manager", "resource", "observer"]);

    const replaceSchema = document.components.schemas.ProjectResourcePoolReplaceRequest;
    expect(replaceSchema.required).toEqual(["members"]);
    expect(replaceSchema.properties.members.items).toEqual({ $ref: "#/components/schemas/ProjectResourcePoolMemberWrite" });
  });



  it("documents typed Gantt planning saved view payloads", () => {
    const document = createTestDocument();

    expect(document.components.schemas.PlanningSavedView.properties.payload).toEqual({
      $ref: "#/components/schemas/PlanningSavedViewPayload"
    });
    expect(document.components.schemas.PlanningSavedViewCreateRequest.properties.payload).toEqual({
      $ref: "#/components/schemas/PlanningSavedViewPayload"
    });
    expect(document.components.schemas.PlanningSavedViewPayload.oneOf).toEqual([
      { $ref: "#/components/schemas/GanttSavedViewPayload" }
    ]);
    expect(document.components.schemas.GanttSavedViewPayload.required).toEqual([
      "viewKind",
      "zoom",
      "visibleColumns",
      "columnWidths",
      "collapsedTaskIds",
      "selectedTaskIds",
      "scrollPosition",
      "filters",
      "baselineOverlayEnabled"
    ]);
  });

  it("documents explicit planning baseline comparison schemas", () => {
    const document = createTestDocument();
    const comparisonSchema = document.components.schemas.PlanningBaselineComparison;

    expect(comparisonSchema.required).toEqual(["baselineId", "capturedAt", "tasks", "assignments", "resources"]);
    expect(comparisonSchema.properties.tasks.items).toEqual({
      $ref: "#/components/schemas/PlanningBaselineTaskComparison"
    });
    expect(comparisonSchema.properties.assignments.items).toEqual({
      $ref: "#/components/schemas/PlanningBaselineAssignmentComparison"
    });
    expect(comparisonSchema.properties.resources.items).toEqual({
      $ref: "#/components/schemas/PlanningBaselineResourceComparison"
    });

    expect(document.components.schemas.PlanningBaselineAssignmentSnapshot.required).toEqual([
      "assignmentId",
      "taskId",
      "resourceId",
      "role",
      "unitsPermille",
      "workMinutes"
    ]);
  });
});

type TestOpenApiDocument = ReturnType<typeof createKissPmOpenApiDocument> & {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId: string;
        requestBody?: {
          content?: Record<string, { schema?: { $ref?: string } }>;
        };
        responses?: Record<
          string,
          {
            content?: Record<string, { schema?: { $ref?: string } }>;
          }
        >;
        parameters?: Array<{ name: string; required?: boolean }>;
      }
    >
  >;
  components: {
    schemas: Record<string, any>;
  };
};

function createTestDocument(): TestOpenApiDocument {
  return createKissPmOpenApiDocument() as TestOpenApiDocument;
}

function listImplementedRoutes(rootDir: string) {
  const files = listSourceFiles(rootDir);
  const routes: string[] = [];
  const routePattern = /app\.(get|post|put|patch|delete)\(\s*["']([^"']+)/g;

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(routePattern)) {
      const method = match[1];
      const path = match[2];
      if (!method || !path) continue;
      routes.push(`${method.toLowerCase()} ${path}`);
    }
  }

  return routes;
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }
    if (path.endsWith(".ts") && !path.endsWith(".test.ts") && !path.endsWith(".db.test.ts")) {
      files.push(path);
    }
  }

  return files;
}
