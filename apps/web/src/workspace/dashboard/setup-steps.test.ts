import { describe, expect, it } from "vitest";

import { buildSetupSteps } from "./setup-steps";

describe("buildSetupSteps", () => {
  it("показывает владельцу только реальные шаги и отмечает выполненные по данным API", () => {
    expect(buildSetupSteps({
      permissions: ["tenant.tasks.create", "tenant.opportunities.manage", "tenant.projects.manage"],
      taskCount: 1,
      opportunityCount: 0,
      projectCount: 1,
      firstProjectId: "proj-1"
    })).toEqual([
      // Р7: шаг задачи ведёт в расписание проекта — фактическую поверхность создания, а не в /my-work.
      expect.objectContaining({ id: "task", done: true, href: "/projects/proj-1/schedule" }),
      expect.objectContaining({ id: "deal", done: false, href: "/crm/deals" }),
      expect.objectContaining({ id: "project", done: true, href: "/crm/deals" })
    ]);
  });

  it("без проектов ведёт шаг задачи к активации проекта из сделки (связность цепочки)", () => {
    const steps = buildSetupSteps({
      permissions: ["tenant.tasks.create", "tenant.opportunities.manage", "tenant.projects.manage"],
      taskCount: 0,
      opportunityCount: 0,
      projectCount: 0,
      firstProjectId: null
    });
    expect(steps[0]).toEqual(expect.objectContaining({ id: "task", done: false, href: "/crm/deals" }));
    expect(steps[0]?.description).toContain("активируйте проект");
  });

  it("проект есть, но id не передан — fallback на список проектов, а не битая ссылка", () => {
    expect(buildSetupSteps({
      permissions: ["tenant.tasks.create"],
      taskCount: 0,
      opportunityCount: null,
      projectCount: 2,
      firstProjectId: null
    })).toEqual([expect.objectContaining({ id: "task", done: false, href: "/projects" })]);
  });

  it("не обещает шаг задачи, когда проектов нет и прав активировать проект тоже нет (тупик)", () => {
    expect(buildSetupSteps({
      permissions: ["tenant.tasks.create"],
      taskCount: 0,
      opportunityCount: null,
      projectCount: 0,
      firstProjectId: null
    })).toEqual([]);
  });

  it("не показывает шаг задачи, если проекты не загрузились: честного маршрута к созданию нет", () => {
    expect(buildSetupSteps({
      permissions: ["tenant.tasks.create", "tenant.opportunities.manage", "tenant.projects.manage"],
      taskCount: 0,
      opportunityCount: 0,
      projectCount: null,
      firstProjectId: null
    })).toEqual([expect.objectContaining({ id: "deal", done: false, href: "/crm/deals" })]);
  });

  it("не обещает reader действия, для которых у него нет прав", () => {
    expect(buildSetupSteps({
      permissions: ["tenant.opportunities.read"],
      taskCount: 0,
      opportunityCount: 0,
      projectCount: 0,
      firstProjectId: null
    })).toEqual([]);
  });
});
