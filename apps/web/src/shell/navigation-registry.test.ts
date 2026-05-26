import { describe, expect, it } from "vitest";

import { SCREEN_ROUTE_BY_ID } from "@/shell/navigation-registry";

describe("navigation-registry", () => {
  it("highlights CRM for deals, not inbox", () => {
    const deals = SCREEN_ROUTE_BY_ID["05-deals"];
    expect(deals.railSection).toBe("crm");
    expect(deals.contextActiveItem).toBe("Сделки");
    expect(deals.contextActiveItem).not.toBe("Входящие");
  });

  it("highlights projects for gantt and resources, not reports", () => {
    expect(SCREEN_ROUTE_BY_ID["12-project-gantt"].railSection).toBe("projects");
    expect(SCREEN_ROUTE_BY_ID["13-project-resources"].railSection).toBe("projects");
    expect(SCREEN_ROUTE_BY_ID["12-project-gantt"].railSection).not.toBe("reports");
    expect(SCREEN_ROUTE_BY_ID["13-project-resources"].contextActiveItem).toBe("Ресурсы");
  });

  it("aligns breadcrumbs with page title for projects list", () => {
    const meta = SCREEN_ROUTE_BY_ID["07-projects-list"];
    expect(meta.pageTitle).toBe("Проекты");
    expect(meta.breadcrumb.at(-1)?.label).toBe("Проекты");
    expect(meta.breadcrumb.at(-1)?.current).toBe(true);
  });
});
