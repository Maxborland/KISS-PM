import { describe, expect, it } from "vitest";

import {
  getPaletteCommands,
  paletteRouteForSearchResult
} from "./workspace-commands";

describe("workspace palette command registry", () => {
  it("fails closed while session permissions are loading", () => {
    expect(getPaletteCommands({ loaded: false, permissions: null })).toEqual({ navigation: [], actions: [] });
    expect(getPaletteCommands({ loaded: true, permissions: null })).toEqual({ navigation: [], actions: [] });
  });

  it("shows the real create-deal action only with manage and its readable CRM context", () => {
    const reader = getPaletteCommands({
      loaded: true,
      permissions: ["tenant.projects.read", "tenant.project_plan.read"]
    });
    expect(reader.navigation.map((item) => item.label)).toEqual(["Агент", "Мои задачи", "Проекты", "Дашборд"]);
    expect(reader.actions).toEqual([]);

    const admin = getPaletteCommands({
      loaded: true,
      permissions: [
        "tenant.opportunities.manage",
        "tenant.opportunities.read",
        "tenant.deal_stages.read",
        "tenant.clients.read",
        "tenant.contacts.read",
        "tenant.products.read",
        "tenant.project_types.read",
        "tenant.crm_pipelines.read"
      ]
    });
    expect(admin.actions.map((item) => item.label)).toEqual(["Создать сделку"]);
    expect(admin.actions[0]?.href).toBe("/crm/deals?create=deal");

    const manageWithoutReadableContext = getPaletteCommands({
      loaded: true,
      permissions: ["tenant.opportunities.manage", "tenant.opportunities.read"]
    });
    expect(manageWithoutReadableContext.actions).toEqual([]);

    const readableWithoutManage = getPaletteCommands({
      loaded: true,
      permissions: admin.actions[0]?.requiresAll ?? []
    });
    expect(readableWithoutManage.actions).toEqual([]);
  });

  // Регрессия: палитра больше НЕ переписывает маршрут — единственный владелец
  // маршрутизации сущностей это API (apps/api/src/search/searchRouting.ts). Раньше
  // тут переписывались task/opportunity, и вложения с дайджестом уведомлений
  // получали другой маршрут, чем палитра.
  it("passes the API-supplied route through untouched for every entity type", () => {
    expect(paletteRouteForSearchResult({
      id: "task:task/42",
      type: "task",
      entityId: "task/42",
      route: "/tasks/task%2F42"
    })).toBe("/tasks/task%2F42");
    expect(paletteRouteForSearchResult({
      id: "opportunity:deal/42",
      type: "opportunity",
      entityId: "deal/42",
      route: "/crm/deals/deal%2F42"
    })).toBe("/crm/deals/deal%2F42");
    expect(paletteRouteForSearchResult({
      id: "document:doc-1",
      type: "document",
      entityId: "doc-1",
      route: "/projects/project-1/knowledge?document=doc-1"
    })).toBe("/projects/project-1/knowledge?document=doc-1");
    expect(paletteRouteForSearchResult({
      id: "project:project-1",
      type: "project",
      entityId: "project-1",
      route: "/projects/project-1"
    })).toBe("/projects/project-1");
  });
});
