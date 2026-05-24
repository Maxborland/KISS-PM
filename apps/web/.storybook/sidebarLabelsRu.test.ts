import { describe, expect, it } from "vitest";

import { renderSidebarLabelRu } from "./sidebarLabelsRu";

describe("sidebarLabelsRu", () => {
  it("translates roots, groups, and UI component names", () => {
    expect(renderSidebarLabelRu({ name: "FOUNDATIONS", type: "root" })).toBe("Основы");
    expect(renderSidebarLabelRu({ name: "Views", type: "group" })).toBe("Представления");
    expect(renderSidebarLabelRu({ name: "Button", type: "component" })).toBe("Кнопка");
    expect(renderSidebarLabelRu({ name: "Docs", type: "docs" })).toBe("Документация");
  });
});
