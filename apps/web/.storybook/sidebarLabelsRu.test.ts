import { describe, expect, it } from "vitest";

import { renderSidebarLabelRu } from "./sidebarLabelsRu";

describe("sidebarLabelsRu", () => {
  it("translates roots, groups, and UI component names", () => {
    expect(renderSidebarLabelRu({ name: "FOUNDATIONS", type: "root" })).toBe("Основы");
    expect(renderSidebarLabelRu({ name: "Primitives", type: "root" })).toBe("Примитивы");
    expect(renderSidebarLabelRu({ name: "Widgets", type: "group" })).toBe("Виджеты");
    expect(renderSidebarLabelRu({ name: "ResourceMatrix", type: "group" })).toBe("Матрица ресурсов");
    expect(renderSidebarLabelRu({ name: "Regression", type: "group" })).toBe("Регрессии");
    expect(renderSidebarLabelRu({ name: "Button", type: "component" })).toBe("Кнопка");
    expect(renderSidebarLabelRu({ name: "Docs", type: "docs" })).toBe("Документация");
  });
});
