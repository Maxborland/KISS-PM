import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sourceFileBudgets = [
  {
    path: "apps/web/src/App.tsx",
    maxLines: 100,
    reason: "App.tsx must stay a thin Next client entrypoint"
  },
  {
    path: "apps/web/src/WorkspaceShell.tsx",
    maxLines: 500,
    reason: "workspace shell orchestration must stay below the next split budget"
  },
  {
    path: "apps/api/src/app.ts",
    maxLines: 500,
    reason: "API composition must delegate route groups instead of owning endpoint bodies"
  },
  {
    path: "apps/api/src/projectIntakeService.ts",
    maxLines: 120,
    reason: "project intake service must stay a facade over focused command modules"
  },
  {
    path: "apps/api/src/projectIntakeService/authorization.ts",
    maxLines: 240,
    reason: "project intake authorization must not absorb command execution logic"
  },
  {
    path: "apps/api/src/projectIntakeService/activateProjectCommand.ts",
    maxLines: 160,
    reason: "project activation command must stay focused until ProjectDraft is introduced"
  },
  {
    path: "packages/persistence/src/repositories.ts",
    maxLines: 580,
    reason: "persistence root must delegate focused repository areas"
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
