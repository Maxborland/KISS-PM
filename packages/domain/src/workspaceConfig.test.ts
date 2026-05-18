import { describe, expect, it } from "vitest";

import {
  isWorkspaceConfigFieldType,
  isWorkspaceConfigId,
  isWorkspaceConfigStatus,
  isWorkspaceConfigSystemKey,
  isWorkspaceConfigSystemKeyInput,
  isWorkspaceConfigTenantLabel,
  isWorkspaceConfigTenantLabelInput,
  workspaceConfigDescriptionMaxLength,
  workspaceConfigIdMaxLength,
  workspaceConfigLabelMaxLength,
  workspaceConfigSystemKeyMaxLength
} from "./index";

describe("workspace config domain validation", () => {
  it("accepts canonical IDs and rejects unsafe IDs", () => {
    expect(isWorkspaceConfigId("field-project_priority-1")).toBe(true);
    expect(isWorkspaceConfigId("FieldProject")).toBe(false);
    expect(isWorkspaceConfigId("field project")).toBe(false);
    expect(isWorkspaceConfigId(`a${"x".repeat(workspaceConfigIdMaxLength)}`)).toBe(
      false
    );
  });

  it("accepts stable system keys with the same boundary used by API and UI", () => {
    expect(isWorkspaceConfigSystemKey("project_priority")).toBe(true);
    expect(isWorkspaceConfigSystemKey(" project_priority ")).toBe(false);
    expect(
      isWorkspaceConfigSystemKey(`a${"x".repeat(workspaceConfigSystemKeyMaxLength - 1)}`)
    ).toBe(true);
    expect(
      isWorkspaceConfigSystemKey(`a${"x".repeat(workspaceConfigSystemKeyMaxLength)}`)
    ).toBe(false);
    expect(isWorkspaceConfigSystemKey("1_project")).toBe(false);
    expect(isWorkspaceConfigSystemKey("ProjectPriority")).toBe(false);
  });

  it("keeps raw system key input compatibility separate from normalized validation", () => {
    expect(isWorkspaceConfigSystemKeyInput(" project_priority ")).toBe(true);
    expect(
      isWorkspaceConfigSystemKeyInput(
        ` ${`a${"x".repeat(workspaceConfigSystemKeyMaxLength - 1)}`} `
      )
    ).toBe(false);
  });

  it("validates normalized tenant labels by length", () => {
    expect(isWorkspaceConfigTenantLabel("Приоритет проекта")).toBe(true);
    expect(isWorkspaceConfigTenantLabel(" Приоритет проекта ")).toBe(false);
    expect(isWorkspaceConfigTenantLabel("   ")).toBe(false);
    expect(isWorkspaceConfigTenantLabel("x".repeat(workspaceConfigLabelMaxLength))).toBe(
      true
    );
    expect(
      isWorkspaceConfigTenantLabel("x".repeat(workspaceConfigLabelMaxLength + 1))
    ).toBe(false);
  });

  it("keeps raw tenant label input compatibility separate from normalized validation", () => {
    expect(isWorkspaceConfigTenantLabelInput(" Приоритет проекта ")).toBe(true);
    expect(isWorkspaceConfigTenantLabelInput("   ")).toBe(false);
  });

  it("keeps allowed field types and statuses explicit", () => {
    expect(isWorkspaceConfigFieldType("text")).toBe(true);
    expect(isWorkspaceConfigFieldType("number")).toBe(true);
    expect(isWorkspaceConfigFieldType("date")).toBe(true);
    expect(isWorkspaceConfigFieldType("select")).toBe(true);
    expect(isWorkspaceConfigFieldType("money")).toBe(false);

    expect(isWorkspaceConfigStatus("draft")).toBe(true);
    expect(isWorkspaceConfigStatus("active")).toBe(true);
    expect(isWorkspaceConfigStatus("archived")).toBe(false);
  });

  it("publishes the description max length used by template forms and parsers", () => {
    expect(workspaceConfigDescriptionMaxLength).toBe(1000);
  });
});
