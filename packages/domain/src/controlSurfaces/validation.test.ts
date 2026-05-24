import { describe, expect, it } from "vitest";

import {
  createDefaultControlSurfacePresets,
  validateControlSurfaceDefinition,
  type ControlSurfaceDefinition
} from "./index";

describe("control surface definition validation", () => {
  it("accepts guided presets as publishable definitions", () => {
    const presets = createDefaultControlSurfacePresets("tenant-alpha");

    expect(presets).toHaveLength(3);
    for (const preset of presets) {
      expect(validateControlSurfaceDefinition(preset)).toEqual({
        issues: [],
        canPublish: true
      });
    }
  });

  it("rejects invalid data-source/entity/view combinations", () => {
    const definition = createDefinition({
      dataSource: "crm_intake",
      entityType: "resource",
      viewType: "heatmap"
    });

    expect(validateControlSurfaceDefinition(definition).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "entity_not_supported", path: "entityType" }),
        expect.objectContaining({ code: "view_not_supported", path: "viewType" })
      ])
    );
  });

  it("requires registered action bindings to carry mandatory permissions", () => {
    const definition = createDefinition({
      actions: [
        {
          id: "apply",
          label: "Применить",
          actionKey: "apply_planning_delta",
          scope: "row",
          requiredPermissions: ["tenant.management_actions.execute"]
        }
      ]
    });

    expect(validateControlSurfaceDefinition(definition)).toMatchObject({
      canPublish: false,
      issues: [
        expect.objectContaining({
          code: "action_permission_missing",
          path: "actions.0.requiredPermissions"
        })
      ]
    });
  });

  it("returns validation issues instead of throwing for malformed collection items", () => {
    const definition = createDefinition({
      actions: [
        {
          id: "broken",
          label: "Сломанное действие",
          actionKey: "open_gantt",
          scope: "row"
        } as ControlSurfaceDefinition["actions"][number]
      ],
      fields: ["not-a-field"] as unknown as ControlSurfaceDefinition["fields"]
    });

    expect(() => validateControlSurfaceDefinition(definition)).not.toThrow();
    expect(validateControlSurfaceDefinition(definition)).toMatchObject({
      canPublish: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "invalid_item", path: "fields.0" }),
        expect.objectContaining({ code: "visible_field_required", path: "fields" }),
        expect.objectContaining({
          code: "action_permissions_invalid",
          path: "actions.0.requiredPermissions"
        }),
        expect.objectContaining({
          code: "action_permission_missing",
          path: "actions.0.requiredPermissions"
        })
      ])
    });
  });

  it("registers management actions used by control surfaces", () => {
    const definition = createDefinition({
      actions: [
        {
          id: "split-work",
          label: "Разделить работу",
          actionKey: "split_work",
          scope: "row",
          requiredPermissions: ["tenant.project_resources.manage", "tenant.project_plan.manage"]
        },
        {
          id: "apply-scenario",
          label: "Применить сценарий",
          actionKey: "apply_planning_scenario",
          scope: "bulk",
          requiredPermissions: ["tenant.planning_scenarios.apply", "tenant.project_plan.manage"]
        }
      ]
    });

    expect(validateControlSurfaceDefinition(definition)).toEqual({
      issues: [],
      canPublish: true
    });
  });
});

function createDefinition(
  patch: Partial<ControlSurfaceDefinition> = {}
): ControlSurfaceDefinition {
  return {
    id: "surface-alpha",
    tenantId: "tenant-alpha",
    code: "project-delivery",
    name: "Project Delivery",
    description: null,
    dataSource: "project_delivery",
    entityType: "project",
    viewType: "gantt",
    fields: [{ id: "title", label: "Название", sourceField: "title", visible: true }],
    filters: [],
    groupings: [],
    widgets: [],
    severityRules: [],
    drilldowns: [],
    actions: [],
    requiredPermissions: ["tenant.projects.read"],
    savedViewPolicy: "user",
    auditPolicy: "publish_only",
    ...patch
  };
}
