import { describe, expect, it } from "vitest";

import { buildSetupSteps } from "./setup-steps";

describe("buildSetupSteps", () => {
  it("показывает владельцу только реальные шаги и отмечает выполненные по данным API", () => {
    expect(buildSetupSteps({
      permissions: ["tenant.tasks.create", "tenant.opportunities.manage", "tenant.projects.manage"],
      taskCount: 1,
      opportunityCount: 0,
      projectCount: 0
    })).toEqual([
      expect.objectContaining({ id: "task", done: true, href: "/my-work" }),
      expect.objectContaining({ id: "deal", done: false, href: "/crm/deals" }),
      expect.objectContaining({ id: "project", done: false, href: "/crm/deals" })
    ]);
  });

  it("не обещает reader действия, для которых у него нет прав", () => {
    expect(buildSetupSteps({
      permissions: ["tenant.opportunities.read"],
      taskCount: 0,
      opportunityCount: 0,
      projectCount: 0
    })).toEqual([]);
  });
});
