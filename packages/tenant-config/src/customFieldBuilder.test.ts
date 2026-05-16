import { describe, expect, it } from "vitest";

import {
  createCustomFieldDefinition,
  createCustomFieldRegistry,
  publishCustomFieldDefinitionPreview,
  previewCustomFieldDefinitionPublish
} from "./index";
import type { CustomFieldDefinitionDraft } from "./index";

function emptyRegistry() {
  return createCustomFieldRegistry({
    tenantId: "tenant-a",
    version: 1,
    definitions: [],
    updatedAt: "2026-08-01T00:00:00.000Z"
  });
}

const draft: CustomFieldDefinitionDraft = {
  id: "cf-project-risk-level",
  targetEntityType: "project",
  key: "risk_level",
  label: "Уровень риска",
  valueType: "single_select",
  required: false,
  active: true,
  validationRules: { options: ["low", "medium", "high"] },
  visibilityRules: [{ surfaceKey: "portfolio.control", visible: true }],
  permissionRules: { readPermissionKey: "project.read", writePermissionKey: "custom_field.write" },
  bindingFlags: {
    usableInFilters: true,
    usableInControlSurfaces: true,
    usableInKpiSourceBindings: false
  }
};

describe("custom field definition builder", () => {
  it("previews a tenant-scoped project custom field publish without mutating the registry", () => {
    const registry = emptyRegistry();

    const preview = previewCustomFieldDefinitionPublish(registry, {
      id: "preview-custom-field-1",
      actorId: "tenant-admin-a",
      expectedRegistryVersion: 1,
      draft,
      affectedRuntimeSurfaces: ["portfolio.control"],
      createdAt: "2026-08-01T00:01:00.000Z"
    });

    expect(preview).toMatchObject({
      id: "preview-custom-field-1",
      tenantId: "tenant-a",
      mutatesState: false,
      before: { registryVersion: 1, definitionCount: 0 },
      after: { registryVersion: 2, definitionCount: 1 },
      definition: {
        id: "cf-project-risk-level",
        key: "risk_level",
        targetEntityType: "project",
        version: 1
      },
      affectedRuntimeSurfaces: ["portfolio.control"]
    });
    expect(registry.version).toBe(1);
    expect(registry.definitions).toEqual([]);
  });

  it("publishes only from a fresh preview and returns audit evidence", () => {
    const registry = emptyRegistry();
    const preview = previewCustomFieldDefinitionPublish(registry, {
      id: "preview-custom-field-1",
      actorId: "tenant-admin-a",
      expectedRegistryVersion: 1,
      draft,
      affectedRuntimeSurfaces: ["portfolio.control"],
      createdAt: "2026-08-01T00:01:00.000Z"
    });

    const result = publishCustomFieldDefinitionPreview(registry, {
      preview,
      expectedRegistryVersion: 1,
      auditEventId: "audit-custom-field-1",
      publishedAt: "2026-08-01T00:02:00.000Z"
    });

    expect(result.registry).toMatchObject({
      tenantId: "tenant-a",
      version: 2,
      definitions: [expect.objectContaining({ key: "risk_level", version: 1 })]
    });
    expect(result.audit).toEqual({
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      auditEventId: "audit-custom-field-1",
      commandType: "custom_field.publish",
      definitionId: "cf-project-risk-level",
      beforeRegistryVersion: 1,
      afterRegistryVersion: 2,
      publishedAt: "2026-08-01T00:02:00.000Z"
    });
    expect(registry.definitions).toEqual([]);

    expect(() =>
      publishCustomFieldDefinitionPreview(result.registry, {
        preview,
        expectedRegistryVersion: 2,
        auditEventId: "audit-stale",
        publishedAt: "2026-08-01T00:03:00.000Z"
      })
    ).toThrow("custom field preview is stale");
  });

  it("rejects duplicates, non-project fields, unsafe bindings, and invalid select options", () => {
    const registry = createCustomFieldRegistry({
      tenantId: "tenant-a",
      version: 2,
      definitions: [
        createCustomFieldDefinition({
          ...draft,
          tenantId: "tenant-a",
          version: 1,
          updatedAt: "2026-08-01T00:00:00.000Z"
        })
      ],
      updatedAt: "2026-08-01T00:00:00.000Z"
    });

    expect(() =>
      previewCustomFieldDefinitionPublish(registry, {
        id: "preview-duplicate",
        actorId: "tenant-admin-a",
        expectedRegistryVersion: 2,
        draft,
        affectedRuntimeSurfaces: ["portfolio.control"],
        createdAt: "2026-08-01T00:01:00.000Z"
      })
    ).toThrow("Duplicate custom field key for project: risk_level");

    expect(() =>
      previewCustomFieldDefinitionPublish(emptyRegistry(), {
        id: "preview-task",
        actorId: "tenant-admin-a",
        expectedRegistryVersion: 1,
        draft: { ...draft, targetEntityType: "task" },
        affectedRuntimeSurfaces: ["portfolio.control"],
        createdAt: "2026-08-01T00:01:00.000Z"
      })
    ).toThrow("custom field builder supports project fields only");

    expect(() =>
      previewCustomFieldDefinitionPublish(emptyRegistry(), {
        id: "preview-no-surface",
        actorId: "tenant-admin-a",
        expectedRegistryVersion: 1,
        draft: {
          ...draft,
          bindingFlags: { ...draft.bindingFlags, usableInControlSurfaces: false }
        },
        affectedRuntimeSurfaces: ["portfolio.control"],
        createdAt: "2026-08-01T00:01:00.000Z"
      })
    ).toThrow("custom field must be usable in control surfaces");

    expect(() =>
      previewCustomFieldDefinitionPublish(emptyRegistry(), {
        id: "preview-no-options",
        actorId: "tenant-admin-a",
        expectedRegistryVersion: 1,
        draft: { ...draft, validationRules: { options: [] } },
        affectedRuntimeSurfaces: ["portfolio.control"],
        createdAt: "2026-08-01T00:01:00.000Z"
      })
    ).toThrow("custom field select options must not be empty");
  });
});
