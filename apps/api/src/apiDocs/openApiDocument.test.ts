import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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

  it("documents the planning revert request, result, and errors with strict schemas", () => {
    const document = createTestDocument();
    const operation = document.paths[
      "/api/workspace/projects/{projectId}/planning/revert-last"
    ]?.post as unknown as JsonOperation;
    const schemas = document.components.schemas as Record<string, JsonSchema>;

    expect(operation.requestBody.content["application/json"]?.schema.$ref).toBe(
      "#/components/schemas/PlanningRevertRequest"
    );
    expect(operation.responses["200"]?.content["application/json"]?.schema.$ref).toBe(
      "#/components/schemas/PlanningRevertResponse"
    );
    for (const status of ["400", "401", "403", "404", "409", "413", "415", "501"]) {
      expect(operation.responses[status]?.content["application/json"]?.schema.$ref).toBe(
        "#/components/schemas/PlanningRevertErrorResponse"
      );
    }

    expect(schemas.PlanningRevertRequest).toMatchObject({
      required: ["targetCommitId", "clientPlanVersion", "idempotencyKey"],
      additionalProperties: false
    });
    expect(schemas.PlanningRevertResponse).toMatchObject({
      required: ["reverted", "applied", "newPlanVersion", "auditEventId", "readModel"],
      additionalProperties: false
    });
    expect(schemas.PlanningRevertResponse?.properties?.reverted).toEqual({
      type: "string",
      minLength: 1
    });
    expect(schemas.PlanningRevertErrorResponse).toMatchObject({
      required: ["error"],
      additionalProperties: false
    });
    const errorCodes = schemas.PlanningRevertErrorResponse?.properties?.error as
      | { enum?: string[] }
      | undefined;
    expect(errorCodes?.enum).toContain("same_origin_action_required");
  });

  it("keeps Saved View create, rename, and delete contracts in the API document", () => {
    const document = createTestDocument();
    const path = document.paths[
      "/api/workspace/projects/{projectId}/planning/saved-views/{viewId}"
    ];
    const rename = path?.patch as unknown as JsonOperation;
    const remove = path?.delete as unknown as JsonOperation;
    const schemas = document.components.schemas as Record<string, JsonSchema>;

    expect(rename.requestBody.content["application/json"]?.schema.$ref).toBe(
      "#/components/schemas/PlanningSavedViewRenameRequest"
    );
    expect(remove.requestBody.content["application/json"]?.schema.$ref).toBe(
      "#/components/schemas/PlanningSavedViewDeleteRequest"
    );
    expect(schemas.PlanningSavedViewCreateRequest?.required).toEqual([
      "name",
      "payload",
      "clientRequestId"
    ]);
    expect(schemas.PlanningSavedViewRenameRequest).toMatchObject({
      required: ["name", "clientRequestId"],
      additionalProperties: false
    });
    expect(schemas.PlanningSavedViewDeleteRequest).toMatchObject({
      required: ["clientRequestId"],
      additionalProperties: false
    });
  });
});

type JsonOperation = {
  requestBody: {
    content: Record<string, { schema: { $ref: string } }>;
  };
  responses: Record<string, { content: Record<string, { schema: { $ref: string } }> }>;
};

type JsonSchema = {
  required?: string[];
  properties?: Record<string, unknown>;
  additionalProperties?: boolean;
};

type TestOpenApiDocument = ReturnType<typeof createKissPmOpenApiDocument> & {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId: string;
        requestBody?: unknown;
        parameters?: Array<{ name: string; required?: boolean }>;
      }
    >
  >;
};

function createTestDocument(): TestOpenApiDocument {
  return createKissPmOpenApiDocument() as TestOpenApiDocument;
}

function listImplementedRoutes(rootDir: string) {
  const files = listSourceFiles(rootDir);
  const routes: string[] = [];
  const routePattern = /app\.(get|post|put|patch|delete)\(\s*(?:["']([^"']+)["']|(\w+))/g;

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const routeConstants = resolveRouteConstants(text);
    for (const match of text.matchAll(routePattern)) {
      const method = match[1];
      const path = match[2] ?? routeConstants.get(match[3] ?? "");
      if (!method || !path) continue;
      routes.push(`${method.toLowerCase()} ${path}`);
    }
  }

  return routes;
}

function resolveRouteConstants(text: string): Map<string, string> {
  const constants = new Map<string, string>();
  for (const match of text.matchAll(/const\s+(\w+)\s*=\s*["']([^"']+)["']\s*;/g)) {
    if (match[1] && match[2]) constants.set(match[1], match[2]);
  }

  for (const match of text.matchAll(/const\s+(\w+)\s*=\s*`([^`]+)`\s*;/g)) {
    const name = match[1];
    const template = match[2];
    if (!name || !template) continue;
    const resolved = template.replace(/\$\{(\w+)\}/g, (_, dependency: string) =>
      constants.get(dependency) ?? "${" + dependency + "}"
    );
    if (!resolved.includes("${")) constants.set(name, resolved);
  }
  return constants;
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
