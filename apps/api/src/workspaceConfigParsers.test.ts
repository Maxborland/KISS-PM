import { describe, expect, it } from "vitest";
import {
  getStringField,
  parseCustomFieldDefinitionBody,
  parseProjectTemplateBody
} from "./workspaceConfigParsers";

describe("workspace config parsers", () => {
  it("normalizes valid custom field input for the current tenant", () => {
    expect(
      parseCustomFieldDefinitionBody(
        {
          id: "field-project-priority",
          systemKey: "project_priority",
          tenantLabel: " Приоритет проекта ",
          targetEntity: "project",
          fieldType: "select",
          required: true,
          status: "active"
        },
        "tenant-alpha"
      )
    ).toEqual({
      ok: true,
      value: {
        id: "field-project-priority",
        tenantId: "tenant-alpha",
        systemKey: "project_priority",
        tenantLabel: "Приоритет проекта",
        targetEntity: "project",
        fieldType: "select",
        required: true,
        status: "active"
      }
    });
  });

  it("allows opportunity custom fields for the deal CRUD baseline", () => {
    expect(
      parseCustomFieldDefinitionBody(
        {
          id: "field-opportunity-budget-model",
          systemKey: "opportunity_budget_model",
          tenantLabel: "Экономическая модель сделки",
          targetEntity: "opportunity",
          fieldType: "text",
          required: false,
          status: "active"
        },
        "tenant-alpha"
      )
    ).toMatchObject({
      ok: true,
      value: {
        targetEntity: "opportunity",
        systemKey: "opportunity_budget_model"
      }
    });
  });

  it("rejects invalid custom field system keys and labels", () => {
    expect(
      parseCustomFieldDefinitionBody(
        {
          id: "field-invalid",
          systemKey: "Invalid Key",
          tenantLabel: "Некорректный ключ",
          targetEntity: "project",
          fieldType: "text"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_system_key" });

    expect(
      parseCustomFieldDefinitionBody(
        {
          id: "field-too-long-label",
          systemKey: "too_long_label",
          tenantLabel: "x".repeat(121),
          targetEntity: "project",
          fieldType: "text"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_tenant_label" });

    expect(
      parseCustomFieldDefinitionBody(
        {
          id: "field-hidden-label",
          systemKey: "hidden_label",
          tenantLabel: "Приоритет\nX-Audit: spoof",
          targetEntity: "project",
          fieldType: "text"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_tenant_label" });
  });

  it("normalizes project template description and keeps immutable path id", () => {
    expect(
      parseProjectTemplateBody(
        {
          systemKey: "implementation",
          tenantLabel: " Внедрение ",
          description: "",
          status: "active"
        },
        "tenant-alpha",
        "template-implementation"
      )
    ).toEqual({
      ok: true,
      value: {
        id: "template-implementation",
        tenantId: "tenant-alpha",
        systemKey: "implementation",
        tenantLabel: "Внедрение",
        description: null,
        status: "active"
      }
    });
  });

  it("rejects unsafe project template labels and descriptions", () => {
    expect(
      parseProjectTemplateBody(
        {
          systemKey: "implementation",
          tenantLabel: "Внедрение\u0000hidden",
          status: "active"
        },
        "tenant-alpha",
        "template-implementation"
      )
    ).toEqual({ ok: false, error: "invalid_tenant_label" });

    expect(
      parseProjectTemplateBody(
        {
          systemKey: "implementation",
          tenantLabel: "Внедрение",
          description: "Описание\u0000hidden",
          status: "active"
        },
        "tenant-alpha",
        "template-implementation"
      )
    ).toEqual({ ok: false, error: "invalid_description" });
  });

  it("returns undefined for absent string fields and trimmed values for present fields", () => {
    expect(getStringField({ label: "  Значение  " }, "label")).toBe("Значение");
    expect(getStringField({}, "label")).toBeUndefined();
    expect(getStringField({ label: 42 }, "label")).toBeUndefined();
  });
});
