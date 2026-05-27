import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listDocumentedApiRoutes } from "./openApiDocument";

describe("OpenAPI route inventory", () => {
  it("documents every implemented Hono route", () => {
    const actualRoutes = listImplementedRoutes(join(process.cwd(), "apps/api/src"));
    const documentedRoutes = new Set(
      listDocumentedApiRoutes().map((route) => `${route.method} ${route.path}`)
    );

    expect(actualRoutes.filter((route) => !documentedRoutes.has(route)).sort()).toEqual([]);
    expect([...documentedRoutes].filter((route) => !actualRoutes.includes(route)).sort()).toEqual(
      []
    );
  });
});

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
