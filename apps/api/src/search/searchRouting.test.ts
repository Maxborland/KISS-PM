import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { routeForEntity } from "./searchRouting";

const appRouterRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../web/src/app"
);

function segments(relativePath: string): string[] {
  return readdirSync(join(appRouterRoot, relativePath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

describe("routeForEntity", () => {
  // Регрессия: вложения и fallback вели на `/knowledge/documents/:id`,
  // `/knowledge/decisions/:id`, `/knowledge/action-items/:id` — таких сегментов в
  // роутере НЕТ, каждый переход давал 404 Next.js.
  it("routes knowledge entities into the project knowledge surface, not a missing detail page", () => {
    expect(routeForEntity("document", "doc-1", { projectId: "project-1" })).toBe(
      "/projects/project-1/knowledge?document=doc-1"
    );
    expect(routeForEntity("decision", "dec-1", { projectId: "project-1" })).toBe(
      "/projects/project-1/knowledge?decision=dec-1"
    );
    expect(
      routeForEntity("knowledge_action_item", "ai-1", { projectId: "project-1" })
    ).toBe("/projects/project-1/knowledge?actionItem=ai-1");
  });

  it("proves the knowledge surface has no detail segment to link to", () => {
    expect(segments("projects/[id]/knowledge")).toEqual([]);
    expect(segments(".")).not.toContain("knowledge");
  });

  it("falls back to the project list when a knowledge item has no project context", () => {
    expect(routeForEntity("document", "doc-1")).toBe("/projects");
    expect(routeForEntity("document", "doc-1", { projectId: null })).toBe("/projects");
  });

  it("emits only real app-router segments for the remaining entity types", () => {
    expect(routeForEntity("project", "project-1")).toBe("/projects/project-1");
    expect(routeForEntity("task", "task-1")).toBe("/tasks/task-1");
    expect(routeForEntity("opportunity", "deal-1")).toBe("/crm/deals/deal-1");
    expect(routeForEntity("client", "client-1")).toBe("/crm/clients?entity=client-1");
    expect(routeForEntity("contact", "contact-1")).toBe("/crm/contacts?entity=contact-1");
    expect(routeForEntity("product", "product-1")).toBe("/crm/products");
    expect(routeForEntity("unknown_entity", "x")).toBe("/");

    expect(segments("tasks")).toContain("[id]");
    expect(segments("crm/deals")).toContain("[id]");
  });

  it("encodes ids so a slash cannot forge an extra path segment", () => {
    expect(routeForEntity("task", "task/42")).toBe("/tasks/task%2F42");
    expect(routeForEntity("document", "doc/1", { projectId: "p/1" })).toBe(
      "/projects/p%2F1/knowledge?document=doc%2F1"
    );
  });
});
