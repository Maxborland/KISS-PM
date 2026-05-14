import { describe, expect, it } from "vitest";

import { createProjectProcessTemplateDraft, ProjectCoreModelError } from "./index";

describe("project process template draft", () => {
  it("creates a tenant-owned deterministic process template draft with matching metadata", () => {
    const template = createProjectProcessTemplateDraft({
      id: "process-template-implementation",
      tenantId: "tenant-a",
      key: "implementation.fixed_scope",
      label: "Внедрение с фиксированным объемом",
      categoryKeys: ["implementation"],
      typologyKeys: ["fixed_scope"],
      requiredScopeHintKeys: ["integrations_count"],
      optionalScopeHintKeys: ["modules_count"],
      baseConfidence: 0.6,
      priority: 10,
      active: true,
      version: 1,
      assumptions: [
        {
          code: "standard_delivery_model",
          message: "Используется стандартная модель поставки для внедрения."
        }
      ],
      updatedAt: "2026-05-14T19:20:00+07:00"
    });

    expect(template).toEqual({
      id: "process-template-implementation",
      tenantId: "tenant-a",
      key: "implementation.fixed_scope",
      label: "Внедрение с фиксированным объемом",
      categoryKeys: ["implementation"],
      typologyKeys: ["fixed_scope"],
      requiredScopeHintKeys: ["integrations_count"],
      optionalScopeHintKeys: ["modules_count"],
      baseConfidence: 0.6,
      priority: 10,
      active: true,
      version: 1,
      assumptions: [
        {
          code: "standard_delivery_model",
          message: "Используется стандартная модель поставки для внедрения."
        }
      ],
      updatedAt: "2026-05-14T19:20:00+07:00"
    });
  });

  it("validates stable keys, unique scope hints, and confidence bounds", () => {
    expect(() =>
      createProjectProcessTemplateDraft({
        id: "process-template-bad-key",
        tenantId: "tenant-a",
        key: "Внедрение",
        label: "Внедрение",
        categoryKeys: ["implementation"],
        typologyKeys: ["fixed_scope"],
        requiredScopeHintKeys: [],
        optionalScopeHintKeys: [],
        baseConfidence: 0.6,
        priority: 1,
        active: true,
        version: 1,
        assumptions: [],
        updatedAt: "2026-05-14T19:20:00+07:00"
      })
    ).toThrow("projectProcessTemplate.key must be a stable system key");

    expect(() =>
      createProjectProcessTemplateDraft({
        id: "process-template-duplicate-hints",
        tenantId: "tenant-a",
        key: "implementation.fixed_scope",
        label: "Внедрение",
        categoryKeys: ["implementation"],
        typologyKeys: ["fixed_scope"],
        requiredScopeHintKeys: ["integrations_count"],
        optionalScopeHintKeys: ["integrations_count"],
        baseConfidence: 0.6,
        priority: 1,
        active: true,
        version: 1,
        assumptions: [],
        updatedAt: "2026-05-14T19:20:00+07:00"
      })
    ).toThrow("projectProcessTemplate scope hint keys must be unique");

    try {
      createProjectProcessTemplateDraft({
        id: "process-template-bad-confidence",
        tenantId: "tenant-a",
        key: "implementation.fixed_scope",
        label: "Внедрение",
        categoryKeys: ["implementation"],
        typologyKeys: ["fixed_scope"],
        requiredScopeHintKeys: [],
        optionalScopeHintKeys: [],
        baseConfidence: 1.1,
        priority: 1,
        active: true,
        version: 1,
        assumptions: [],
        updatedAt: "2026-05-14T19:20:00+07:00"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectCoreModelError);
      expect((error as ProjectCoreModelError).code).toBe("validation_error");
    }

    expect(() =>
      createProjectProcessTemplateDraft({
        id: "process-template-empty-categories",
        tenantId: "tenant-a",
        key: "implementation.fixed_scope",
        label: "Внедрение",
        categoryKeys: [],
        typologyKeys: ["fixed_scope"],
        requiredScopeHintKeys: [],
        optionalScopeHintKeys: [],
        baseConfidence: 0.6,
        priority: 1,
        active: true,
        version: 1,
        assumptions: [],
        updatedAt: "2026-05-14T19:20:00+07:00"
      })
    ).toThrow("projectProcessTemplate.categoryKeys must not be empty");

    expect(() =>
      createProjectProcessTemplateDraft({
        id: "process-template-bad-assumption",
        tenantId: "tenant-a",
        key: "implementation.fixed_scope",
        label: "Внедрение",
        categoryKeys: ["implementation"],
        typologyKeys: ["fixed_scope"],
        requiredScopeHintKeys: [],
        optionalScopeHintKeys: [],
        baseConfidence: 0.6,
        priority: 1,
        active: true,
        version: 1,
        assumptions: [null] as never,
        updatedAt: "2026-05-14T19:20:00+07:00"
      })
    ).toThrow("projectProcessTemplate.assumption must be an object");
  });
});
