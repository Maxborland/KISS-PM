import { describe, expect, it } from "vitest";

import {
  canOpenRuntimePath,
  contextNavForSection,
  dealIdForRuntimePath,
  pathForScreenId,
  RAIL_SECTIONS,
  railSectionsForPermissions,
  screenIdForPath,
  SCREEN_ROUTE_BY_ID
} from "@/shell/navigation-registry";

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

  it("marks dashboard for team topbar and create-export intro actions", () => {
    const dashboard = SCREEN_ROUTE_BY_ID["01-dashboard"];
    expect(dashboard.topbarMode).toBe("team");
    expect(dashboard.pageIntroActions).toBe("create-export");
  });

  it("resolves runtime paths to accepted screen ids", () => {
    expect(screenIdForPath("/dashboard")).toBe("01-dashboard");
    expect(screenIdForPath("/agent")).toBe("20-agent-cockpit");
    expect(screenIdForPath("/my-work")).toBe("02-my-work");
    expect(screenIdForPath("/deals")).toBe("05-deals");
    expect(screenIdForPath("/deals/opportunity-alpha")).toBe("06-deal-card");
    expect(screenIdForPath("/directories/clients")).toBe("08-entities-clients");
    expect(screenIdForPath("/directories/contacts")).toBe("08-entities-contacts");
    expect(screenIdForPath("/directories/products")).toBe("08-entities-products");
    expect(screenIdForPath("/projects/project-alpha")).toBe("07b-project-detail");
    expect(screenIdForPath("/projects/project-alpha/timeline")).toBe("12-project-gantt");
    expect(screenIdForPath("/admin/users")).toBe("09-admin");
    expect(screenIdForPath("/admin/roles")).toBe("09-admin-roles");
    expect(screenIdForPath("/admin/audit")).toBe("17-project-audit");
    expect(screenIdForPath("/settings")).toBe("10-settings");
    expect(screenIdForPath("/login")).toBe("19-login");
  });

  it("keeps ScreenId to runtime path lookup available for Storybook metadata", () => {
    expect(pathForScreenId("01-dashboard")).toBe("/dashboard");
    expect(pathForScreenId("20-agent-cockpit")).toBe("/agent");
    expect(pathForScreenId("05-deals")).toBe("/deals");
    expect(pathForScreenId("06-deal-card")).toBe("/deals/:dealId");
    expect(pathForScreenId("08-entities-clients")).toBe("/directories/clients");
    expect(pathForScreenId("08-entities-contacts")).toBe("/directories/contacts");
    expect(pathForScreenId("08-entities-products")).toBe("/directories/products");
    expect(pathForScreenId("07b-project-detail")).toBe("/projects/:projectId");
    expect(pathForScreenId("12-project-gantt")).toBe("/projects/:projectId/timeline");
    expect(pathForScreenId("09-admin")).toBe("/admin/users");
    expect(pathForScreenId("09-admin-roles")).toBe("/admin/roles");
    expect(pathForScreenId("17-project-audit")).toBe("/admin/audit");
  });

  it("provides real hrefs for primary rail entries", () => {
    expect(RAIL_SECTIONS.map((section) => section.href)).toEqual([
      "/dashboard",
      "/my-work",
      "/deals",
      "/projects",
      "/directories/clients",
      "/reports",
      "/settings"
    ]);
    expect(RAIL_SECTIONS.map((section) => section.href).some((href) => href.includes("/demo"))).toBe(false);
  });

  it("hides non-beta runtime paths from navigation until they are API-backed", () => {
    expect(canOpenRuntimePath("/showcase/spacing", ["tenant.projects.read"])).toBe(false);
    expect(canOpenRuntimePath("/projects/demo", ["tenant.projects.read"])).toBe(false);
    expect(canOpenRuntimePath("/projects/demo/gantt", ["tenant.project_plan.read"])).toBe(false);
    expect(canOpenRuntimePath("/deals/demo/DEAL-101", ["tenant.opportunities.read", "tenant.deal_stages.read"])).toBe(false);
    expect(canOpenRuntimePath("/settings", ["tenant.workspace_config.read"])).toBe(false);
  });

  it("extracts real deal ids from dynamic runtime paths", () => {
    expect(dealIdForRuntimePath("/deals/opportunity-alpha")).toBe("opportunity-alpha");
    expect(dealIdForRuntimePath("/deals/demo/DEAL-101")).toBeNull();
    expect(dealIdForRuntimePath("/deals/:dealId")).toBeNull();
  });

  it("allows real deal detail paths only for opportunity and deal stage readers", () => {
    expect(canOpenRuntimePath("/deals/opportunity-alpha", ["tenant.opportunities.read"])).toBe(false);
    expect(
      canOpenRuntimePath("/deals/opportunity-alpha", ["tenant.opportunities.read", "tenant.deal_stages.read"])
    ).toBe(true);
  });

  it("allows real project detail paths for project readers", () => {
    expect(canOpenRuntimePath("/projects/project-alpha", ["tenant.projects.read"])).toBe(true);
    expect(canOpenRuntimePath("/projects/project-alpha", [])).toBe(false);
  });

  it("allows real project timeline paths only for project plan readers", () => {
    expect(canOpenRuntimePath("/projects/project-alpha/timeline", ["tenant.project_plan.read"])).toBe(true);
    expect(canOpenRuntimePath("/projects/project-alpha/timeline", ["tenant.projects.read"])).toBe(false);
    expect(canOpenRuntimePath("/projects/demo/gantt", ["tenant.project_plan.read"])).toBe(false);
  });

  it("allows audit runtime path only for audit readers", () => {
    expect(canOpenRuntimePath("/admin/audit", ["tenant.audit_events.read"])).toBe(true);
    expect(canOpenRuntimePath("/admin/audit", ["tenant.workspace_config.read"])).toBe(false);
  });

  it("allows admin users runtime path only for user readers", () => {
    expect(canOpenRuntimePath("/admin/users", ["tenant.users.read"])).toBe(true);
    expect(canOpenRuntimePath("/admin/users", ["tenant.workspace_config.read"])).toBe(false);
  });

  it("allows admin roles runtime path only for access profile readers", () => {
    expect(canOpenRuntimePath("/admin/roles", ["tenant.access_profiles.read"])).toBe(true);
    expect(canOpenRuntimePath("/admin/roles", ["tenant.users.read"])).toBe(false);
  });

  it("allows clients runtime path only for client readers", () => {
    expect(canOpenRuntimePath("/directories/clients", ["tenant.clients.read"])).toBe(true);
    expect(canOpenRuntimePath("/directories/clients", ["tenant.projects.read"])).toBe(false);
  });

  it("allows contacts runtime path only for contact readers", () => {
    expect(canOpenRuntimePath("/directories/contacts", ["tenant.contacts.read"])).toBe(true);
    expect(canOpenRuntimePath("/directories/contacts", ["tenant.clients.read"])).toBe(false);
  });

  it("allows products runtime path only for product readers", () => {
    expect(canOpenRuntimePath("/directories/products", ["tenant.products.read"])).toBe(true);
    expect(canOpenRuntimePath("/directories/products", ["tenant.contacts.read"])).toBe(false);
  });

  it("exposes the workspace agent as an overview surface", () => {
    const agent = SCREEN_ROUTE_BY_ID["20-agent-cockpit"];
    expect(agent.railSection).toBe("overview");
    expect(agent.contextActiveItem).toBe("Агент");
    expect(agent.requiredPermissions).toEqual(["tenant.projects.read"]);
    expect(
      contextNavForSection("overview", "Агент", ["tenant.projects.read"]).flatMap((group) =>
        group.items.map((item) => [item.label, item.href])
      )
    ).toContainEqual(["Агент", "/agent"]);
  });

  it("filters protected rail entries for restricted runtime users", () => {
    expect(railSectionsForPermissions(["tenant.projects.read"]).map((section) => section.href)).toEqual([
      "/dashboard",
      "/my-work",
      "/projects"
    ]);

    expect(
      railSectionsForPermissions([
        "tenant.projects.read",
        "tenant.opportunities.read",
        "tenant.deal_stages.read",
        "tenant.clients.read",
        "tenant.contacts.read",
        "tenant.products.read",
        "tenant.workspace_config.read"
      ]).map((section) => section.href)
    ).toEqual(["/dashboard", "/my-work", "/deals", "/projects", "/directories/clients"]);
  });

  it("requires both opportunities and deal stages for the deals route", () => {
    expect(railSectionsForPermissions(["tenant.opportunities.read"]).map((section) => section.href)).not.toContain(
      "/deals"
    );
    expect(
      railSectionsForPermissions(["tenant.opportunities.read", "tenant.deal_stages.read"]).map(
        (section) => section.href
      )
    ).toContain("/deals");
  });

  it("filters protected context links for restricted runtime users", () => {
    expect(
      contextNavForSection("projects", "Все проекты", ["tenant.projects.read"]).flatMap((group) =>
        group.items.map((item) => item.href)
      ).filter(Boolean)
    ).toEqual(["/projects"]);

    expect(
      contextNavForSection("directories", "Клиенты", ["tenant.clients.read"]).flatMap((group) =>
        group.items.map((item) => item.href ?? null)
      )
    ).toEqual(["/directories/clients"]);

    expect(
      contextNavForSection("directories", "Контакты", ["tenant.contacts.read"]).flatMap((group) =>
        group.items.map((item) => item.href ?? null)
      )
    ).toEqual(["/directories/contacts"]);

    expect(
      contextNavForSection("directories", "Продукты", ["tenant.products.read"]).flatMap((group) =>
        group.items.map((item) => item.href ?? null)
      )
    ).toEqual(["/directories/products"]);

    expect(
      contextNavForSection("settings", "Рабочая область", ["tenant.workspace_config.read"]).flatMap(
        (group) => group.items.map((item) => item.href ?? null)
      )
    ).toEqual([]);

    expect(
      contextNavForSection("settings", "Пользователи", ["tenant.users.read"]).flatMap((group) =>
        group.items.map((item) => item.href ?? null)
      )
    ).toEqual(["/admin/users"]);

    expect(
      contextNavForSection("settings", "Роли", ["tenant.access_profiles.read"]).flatMap((group) =>
        group.items.map((item) => item.href ?? null)
      )
    ).toEqual(["/admin/roles"]);

    expect(
      contextNavForSection("settings", "Аудит", ["tenant.audit_events.read"]).flatMap((group) =>
        group.items.map((item) => item.href ?? null)
      )
    ).toEqual(["/admin/audit"]);
  });

  it("builds current project context links from the real runtime project id", () => {
    expect(
      contextNavForSection(
        "projects",
        "Ресурсы",
        [
          "tenant.projects.read",
          "tenant.project_plan.read",
          "tenant.project_resources.read",
          "tenant.audit_events.read"
        ],
        { projectId: "project-alpha" }
      ).flatMap((group) => group.items.map((item) => [item.label, item.href, item.active]))
    ).toEqual([
      ["Все проекты", "/projects", false],
      ["Карточка", "/projects/project-alpha", false],
      ["Гант", "/projects/project-alpha/timeline", false],
      ["Ресурсы", "/projects/project-alpha/resources", true],
      ["Аудит", "/admin/audit", false]
    ]);

    expect(
      contextNavForSection("projects", "Карточка", ["tenant.projects.read"], {
        projectId: "project-alpha"
      }).flatMap((group) => group.items.map((item) => item.href))
    ).toEqual(["/projects", "/projects/project-alpha"]);
  });

  it("does not expose disabled or demo context navigation entries in beta runtime", () => {
    const permissions = [
      "tenant.projects.read",
      "tenant.project_plan.read",
      "tenant.project_resources.read",
      "tenant.opportunities.read",
      "tenant.deal_stages.read",
      "tenant.clients.read",
      "tenant.contacts.read",
      "tenant.products.read",
      "tenant.users.read",
      "tenant.access_profiles.read",
      "tenant.audit_events.read",
      "tenant.workspace_config.read"
    ];
    const hrefs = (["overview", "tasks", "crm", "projects", "directories", "reports", "settings"] as const)
      .flatMap((section) => contextNavForSection(section, "", permissions))
      .flatMap((group) => group.items.map((item) => item.href));

    expect(hrefs.every(Boolean)).toBe(true);
    expect(hrefs.some((href) => href?.includes("/demo"))).toBe(false);
    expect(hrefs.some((href) => href === "/tasks/new")).toBe(false);
    expect(hrefs.some((href) => href === "/showcase/spacing")).toBe(false);
  });
});
