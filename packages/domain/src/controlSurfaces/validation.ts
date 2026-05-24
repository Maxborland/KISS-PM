import type {
  ControlSurfaceActionBinding,
  ControlSurfaceActionKey,
  ControlSurfaceDataSourceKey,
  ControlSurfaceDefinition,
  ControlSurfaceEntityType,
  ControlSurfaceValidationIssue,
  ControlSurfaceValidationResult,
  ControlSurfaceViewType
} from "./types";

const dataSourceEntityMap: Record<ControlSurfaceDataSourceKey, readonly ControlSurfaceEntityType[]> = {
  crm_intake: ["opportunity"],
  portfolio_projects: ["project"],
  project_delivery: ["project", "task"],
  resource_load: ["resource", "task", "project"],
  kpi_deviation: ["control_signal", "corrective_action"],
  my_work: ["task"],
  closed_projects: ["project"],
  tenant_admin_config: ["tenant_config", "user"]
};

const dataSourceViewMap: Record<ControlSurfaceDataSourceKey, readonly ControlSurfaceViewType[]> = {
  crm_intake: ["table", "board", "cards"],
  portfolio_projects: ["table", "timeline", "dashboard", "hybrid"],
  project_delivery: ["table", "gantt", "dashboard", "hybrid"],
  resource_load: ["heatmap", "calendar", "table", "dashboard"],
  kpi_deviation: ["table", "dashboard", "cards"],
  my_work: ["table", "board", "calendar", "cards"],
  closed_projects: ["table", "cards", "dashboard"],
  tenant_admin_config: ["table", "cards"]
};

export const controlSurfaceActionRegistry: Record<
  ControlSurfaceActionKey,
  { requiredPermissions: readonly string[]; scopes: readonly string[] }
> = {
  open_entity: { requiredPermissions: [], scopes: ["row", "card"] },
  open_gantt: { requiredPermissions: ["tenant.project_plan.read"], scopes: ["row", "card", "global"] },
  create_task: { requiredPermissions: ["tenant.tasks.create"], scopes: ["row", "card", "global"] },
  create_corrective_action: {
    requiredPermissions: ["tenant.corrective_actions.manage"],
    scopes: ["row", "card", "global"]
  },
  generate_planning_solution: {
    requiredPermissions: ["tenant.planning_scenarios.preview"],
    scopes: ["row", "card", "global"]
  },
  apply_planning_scenario: {
    requiredPermissions: ["tenant.planning_scenarios.apply", "tenant.project_plan.manage"],
    scopes: ["row", "card", "bulk"]
  },
  reserve_capacity: {
    requiredPermissions: ["tenant.project_resources.manage"],
    scopes: ["row", "card", "global"]
  },
  reassign_resource: {
    requiredPermissions: ["tenant.project_resources.manage"],
    scopes: ["row", "card", "bulk"]
  },
  shift_task_dates: {
    requiredPermissions: ["tenant.project_plan.manage"],
    scopes: ["row", "card", "bulk"]
  },
  split_work: {
    requiredPermissions: ["tenant.project_resources.manage", "tenant.project_plan.manage"],
    scopes: ["row", "card", "bulk"]
  },
  request_explanation: {
    requiredPermissions: [],
    scopes: ["row", "card", "global"]
  },
  escalate: {
    requiredPermissions: ["tenant.management_actions.execute"],
    scopes: ["row", "card", "bulk"]
  },
  apply_planning_delta: {
    requiredPermissions: ["tenant.management_actions.execute", "tenant.project_plan.manage"],
    scopes: ["row", "card", "bulk"]
  },
  accept_risk: {
    requiredPermissions: ["tenant.management_actions.execute", "tenant.control_signals.manage"],
    scopes: ["row", "card", "bulk"]
  },
  move_deadline: {
    requiredPermissions: ["tenant.management_actions.execute", "tenant.project_plan.manage"],
    scopes: ["row", "card"]
  },
  change_lifecycle_stage: {
    requiredPermissions: ["tenant.projects.manage"],
    scopes: ["row", "card", "bulk"]
  },
  update_kpi_target: {
    requiredPermissions: ["tenant.kpi_definitions.manage"],
    scopes: ["row", "card"]
  }
};

export function validateControlSurfaceDefinition(
  definition: ControlSurfaceDefinition
): ControlSurfaceValidationResult {
  const issues: ControlSurfaceValidationIssue[] = [];
  requireNonBlank(issues, "id", definition.id);
  requireNonBlank(issues, "tenantId", definition.tenantId);
  requireNonBlank(issues, "code", definition.code);
  requireNonBlank(issues, "name", definition.name);

  if (!dataSourceEntityMap[definition.dataSource]) {
    issues.push(error("invalid_data_source", "dataSource", "Unknown control surface data source"));
  } else if (!dataSourceEntityMap[definition.dataSource].includes(definition.entityType)) {
    issues.push(error("entity_not_supported", "entityType", "Entity type is not supported by data source"));
  }

  if (!dataSourceViewMap[definition.dataSource]) {
    issues.push(error("invalid_data_source", "dataSource", "Unknown control surface data source"));
  } else if (!dataSourceViewMap[definition.dataSource].includes(definition.viewType)) {
    issues.push(error("view_not_supported", "viewType", "View type is not supported by data source"));
  }

  const fields = Array.isArray(definition.fields) ? definition.fields : [];
  if (fields.filter((field) => isObject(field) && field.visible).length === 0) {
    issues.push(error("visible_field_required", "fields", "At least one visible field is required"));
  }
  validateUniqueIds(issues, "fields", fields);
  validateUniqueIds(issues, "filters", safeCollection(definition.filters));
  validateUniqueIds(issues, "groupings", safeCollection(definition.groupings));
  validateUniqueIds(issues, "widgets", safeCollection(definition.widgets));
  validateUniqueIds(issues, "severityRules", safeCollection(definition.severityRules));
  validateUniqueIds(issues, "drilldowns", safeCollection(definition.drilldowns));
  validateActionBindings(issues, safeCollection(definition.actions));

  if (definition.savedViewPolicy !== "none" && definition.savedViewPolicy !== "user" && definition.savedViewPolicy !== "tenant") {
    issues.push(error("invalid_saved_view_policy", "savedViewPolicy", "Saved view policy is invalid"));
  }
  if (definition.auditPolicy !== "publish_only" && definition.auditPolicy !== "all_mutations") {
    issues.push(error("invalid_audit_policy", "auditPolicy", "Audit policy is invalid"));
  }

  return {
    issues,
    canPublish: !issues.some((issue) => issue.severity === "error")
  };
}

function validateActionBindings(
  issues: ControlSurfaceValidationIssue[],
  actions: unknown[]
) {
  validateUniqueIds(issues, "actions", actions);
  for (const [index, action] of actions.entries()) {
    if (!isObject(action)) {
      issues.push(error("invalid_action", `actions.${index}`, "Action binding must be an object"));
      continue;
    }
    requireNonBlank(issues, `actions.${index}.id`, action.id);
    requireNonBlank(issues, `actions.${index}.label`, action.label);
    const actionKey = typeof action.actionKey === "string" ? action.actionKey : "";
    const registry = controlSurfaceActionRegistry[actionKey as ControlSurfaceActionKey];
    if (!registry) {
      issues.push(error("invalid_action_key", `actions.${index}.actionKey`, "Action key is not registered"));
      continue;
    }
    const scope = typeof action.scope === "string" ? action.scope : "";
    if (!registry.scopes.includes(scope)) {
      issues.push(error("invalid_action_scope", `actions.${index}.scope`, "Action scope is not allowed"));
    }
    const requiredPermissions = Array.isArray(action.requiredPermissions)
      ? action.requiredPermissions.filter((permission): permission is string => typeof permission === "string")
      : [];
    if (!Array.isArray(action.requiredPermissions)) {
      issues.push(
        error(
          "action_permissions_invalid",
          `actions.${index}.requiredPermissions`,
          "Action permissions must be an array"
        )
      );
    }
    for (const requiredPermission of registry.requiredPermissions) {
      if (!requiredPermissions.includes(requiredPermission)) {
        issues.push(
          error(
            "action_permission_missing",
            `actions.${index}.requiredPermissions`,
            `Action binding must require ${requiredPermission}`
          )
        );
      }
    }
  }
}

function validateUniqueIds(
  issues: ControlSurfaceValidationIssue[],
  path: string,
  items: unknown[]
) {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (!isObject(item)) {
      issues.push(error("invalid_item", `${path}.${index}`, "Definition collection item must be an object"));
      continue;
    }
    const id = typeof item.id === "string" ? item.id : "";
    requireNonBlank(issues, `${path}.${index}.id`, id);
    if (id && seen.has(id)) {
      issues.push(error("duplicate_id", `${path}.${index}.id`, "Definition id must be unique inside collection"));
    }
    seen.add(id);
  }
}

function requireNonBlank(
  issues: ControlSurfaceValidationIssue[],
  path: string,
  value: unknown
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(error("required", path, "Value is required"));
  }
}

function error(code: string, path: string, message: string): ControlSurfaceValidationIssue {
  return { code, path, message, severity: "error" };
}

function safeCollection(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
