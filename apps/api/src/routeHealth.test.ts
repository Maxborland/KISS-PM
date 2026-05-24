import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const apiRoot = dirname(fileURLToPath(import.meta.url));

function lineCount(relativePath: string): number {
  return readFileSync(join(apiRoot, relativePath), "utf8").split("\n").length;
}

describe("API route health budgets", () => {
  it.each([
    { path: "projectWorkRoutes.ts", maxLines: 390 },
    { path: "attachmentRoutes.ts", maxLines: 350 },
    { path: "searchRoutes.ts", maxLines: 60 }
  ])("$path stays thin after workspace extraction", ({ path, maxLines }) => {
    expect(lineCount(path), `${path} should be <= ${maxLines} lines`).toBeLessThanOrEqual(maxLines);
  });

  it.each([
    { path: "project-work/taskCreateCommands.ts", maxLines: 310 },
    { path: "project-work/taskLifecycleCommands.ts", maxLines: 290 },
    { path: "project-work/taskStatusWorkspace.ts", maxLines: 250 },
    { path: "project-work/taskReadWorkspace.ts", maxLines: 240 },
    { path: "project-work/taskCommandGuards.ts", maxLines: 190 },
    { path: "project-work/taskUpdateCommands.ts", maxLines: 180 },
    { path: "project-work/taskCreateSupport.ts", maxLines: 180 },
    { path: "project-work/taskPreflightGuards.ts", maxLines: 150 },
    { path: "project-work/taskCommandTypes.ts", maxLines: 90 },
    { path: "project-work/taskCommandWorkspace.ts", maxLines: 90 },
    { path: "project-work/taskCommentCommands.ts", maxLines: 90 },
    { path: "project-work/taskCommandActivities.ts", maxLines: 70 }
  ])("$path stays within its extracted module budget", ({ path, maxLines }) => {
    expect(lineCount(path), `${path} should be <= ${maxLines} lines`).toBeLessThanOrEqual(maxLines);
  });

  it.each([
    { path: "attachments/attachmentWorkspace.ts", maxLines: 150 },
    { path: "attachments/fileAttachmentHandlers.ts", maxLines: 190 },
    { path: "attachments/attachmentCollectionHandlers.ts", maxLines: 120 },
    { path: "attachments/attachmentAudit.ts", maxLines: 110 },
    { path: "attachments/attachExternalReference.ts", maxLines: 100 },
    { path: "search/workspaceSearch.ts", maxLines: 60 },
    { path: "search/workspaceSearchSources.ts", maxLines: 290 },
    { path: "search/searchScoring.ts", maxLines: 40 },
    { path: "search/searchQuery.ts", maxLines: 30 },
    { path: "search/searchRouting.ts", maxLines: 20 },
    { path: "search/searchTypes.ts", maxLines: 40 }
  ])("$path stays within its workspace module budget", ({ path, maxLines }) => {
    expect(lineCount(path), `${path} should be <= ${maxLines} lines`).toBeLessThanOrEqual(maxLines);
  });
});
