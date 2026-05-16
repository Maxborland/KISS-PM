import { describe, expect, it } from "vitest";

import {
  bindCustomProjectFieldsToControlSurfaceDefinition,
  createControlSurfaceDefinition,
  createControlSurfaceReadModel
} from "./index";

const definition = createControlSurfaceDefinition({
  id: "portfolio-control",
  tenantId: "tenant-a",
  key: "portfolio.control",
  label: "Контроль портфеля",
  version: 1,
  status: "active",
  surfaceType: "portfolio",
  dataSource: { type: "project", key: "portfolio", entityTypes: ["project"], traceKeys: ["project.id"] },
  view: {
    id: "portfolio-control-view",
    tenantId: "tenant-a",
    surfaceDefinitionId: "portfolio-control",
    key: "default",
    label: "По умолчанию",
    viewType: "table",
    version: 1,
    fields: [
      {
        id: "field-project",
        key: "project_label",
        label: "Проект",
        entityType: "project",
        valueType: "text",
        visible: true,
        sortable: true,
        filterable: true
      }
    ],
    widgets: [],
    actionSlots: [],
    drilldowns: [],
    savedViews: [],
    permissionRequirements: { read: "control.surface:read", actions: [] }
  },
  updatedAt: "2026-08-01T00:00:00.000Z"
});

const field = {
  id: "cf-project-risk-level",
  tenantId: "tenant-a",
  targetEntityType: "project" as const,
  key: "risk_level",
  label: "Уровень риска",
  valueType: "single_select" as const,
  required: false,
  active: true,
  version: 1,
  validationRules: { options: ["low", "medium", "high"] },
  visibilityRules: [{ surfaceKey: "portfolio.control", visible: true }],
  permissionRules: { readPermissionKey: "project.read", writePermissionKey: "custom_field.write" },
  bindingFlags: {
    usableInFilters: true,
    usableInControlSurfaces: true,
    usableInKpiSourceBindings: false
  },
  updatedAt: "2026-08-01T00:00:00.000Z"
};

describe("custom field control-surface binding", () => {
  it("adds visible project custom fields to a control-surface definition and read model", () => {
    const bound = bindCustomProjectFieldsToControlSurfaceDefinition(definition, {
      customFields: [field],
      updatedAt: "2026-08-01T00:01:00.000Z"
    });

    expect(bound.version).toBe(2);
    expect(bound.view.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "custom.risk_level",
          label: "Уровень риска",
          entityType: "project",
          valueType: "text",
          visible: true,
          sortable: false,
          filterable: true
        })
      ])
    );

    const model = createControlSurfaceReadModel({
      definition: bound,
      actorPermissionKeys: ["control.surface:read"],
      page: { offset: 0, limit: 10 },
      records: [
        {
          id: "row-project-alpha",
          tenantId: "tenant-a",
          entityType: "project",
          entityId: "project-alpha",
          label: "ERP внедрение",
          severity: "attention",
          explanation: "Проект с кастомным полем",
          sourceRefs: [{ entityType: "project", entityId: "project-alpha" }],
          fieldValues: {
            project_label: "ERP внедрение",
            "custom.risk_level": "high"
          },
          recommendedActionKeys: [],
          drilldownParams: { projectId: "project-alpha" }
        }
      ]
    });

    expect(model.fields.map((item) => item.key)).toContain("custom.risk_level");
    expect(model.rows[0]?.fieldValues["custom.risk_level"]).toBe("high");
  });

  it("rejects fields that are not tenant-matched, active, project-targeted, or visible on the surface", () => {
    expect(() =>
      bindCustomProjectFieldsToControlSurfaceDefinition(definition, {
        customFields: [{ ...field, tenantId: "tenant-b" }],
        updatedAt: "2026-08-01T00:01:00.000Z"
      })
    ).toThrow("custom field tenant mismatch");

    expect(
      bindCustomProjectFieldsToControlSurfaceDefinition(definition, {
        customFields: [{ ...field, visibilityRules: [{ surfaceKey: "other.surface", visible: true }] }],
        updatedAt: "2026-08-01T00:01:00.000Z"
      }).view.fields.map((item) => item.key)
    ).not.toContain("custom.risk_level");
  });
});
