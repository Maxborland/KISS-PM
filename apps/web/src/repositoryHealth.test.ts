import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sourceFileBudgets = [
  {
    path: "apps/web/src/App.tsx",
    maxLines: 1900,
    reason: "workspace shell must stay decomposed into focused components"
  },
  {
    path: "apps/api/src/app.ts",
    maxLines: 1600,
    reason: "API composition must delegate auth/session, parsers and config routes"
  },
  {
    path: "apps/web/src/styles.css",
    maxLines: 1800,
    reason: "style system should stay tokenized and sectioned"
  }
] as const;

function countLines(relativePath: string): number {
  const content = readFileSync(join(process.cwd(), relativePath), "utf8");

  return content.split(/\r?\n/).length;
}

describe("repository health guardrails", () => {
  it.each(sourceFileBudgets)("$path stays below the god-file budget", (file) => {
    expect(countLines(file.path), file.reason).toBeLessThanOrEqual(file.maxLines);
  });
});
