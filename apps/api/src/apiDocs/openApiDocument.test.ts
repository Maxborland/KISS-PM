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
});

type TestOpenApiDocument = ReturnType<typeof createKissPmOpenApiDocument> & {
  paths: Record<string, Record<string, { operationId: string; requestBody?: unknown }>>;
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
