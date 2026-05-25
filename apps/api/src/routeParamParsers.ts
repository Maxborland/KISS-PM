export type RouteParamParseResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function parseProjectIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_project_id");
}

export function parseTaskIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_task_id");
}

export function parseTaskStatusIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_task_status_id");
}

export function parseControlSignalIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_control_signal_id");
}

export function parseManagementActionIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_management_action_id");
}

export function parseCorrectiveActionIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_corrective_action_id");
}

export function parseControlSurfaceIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_control_surface_id");
}

export function parseAccessRoleIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_access_role_id");
}

export function parseUserIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_user_id");
}

export function parseTenantIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_tenant_id");
}

export function parsePositionIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_position_id");
}

export function parseCustomFieldIdParam(value: unknown): RouteParamParseResult {
  return parseWorkspaceConfigIdentifier(value, "invalid_custom_field_id");
}

export function parseProjectTemplateIdParam(value: unknown): RouteParamParseResult {
  return parseWorkspaceConfigIdentifier(value, "invalid_project_template_id");
}

export function parseClientIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_client_id");
}

export function parseContactIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_contact_id");
}

export function parseProductIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_product_id");
}

export function parseProjectTypeIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_project_type_id");
}

export function parseDealStageIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_deal_stage_id");
}

export function parseOpportunityIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_opportunity_id");
}

export function parseTemplateImprovementActionIdParam(
  value: unknown
): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_template_improvement_action_id");
}

export function parseCrmActivityIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_crm_activity_id");
}

export function parsePlanningScenarioRunIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_planning_scenario_id");
}

export function parsePlanningSolverRunIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_planning_solver_run_id");
}

export function parsePlanningSolverProposalIdParam(value: unknown): RouteParamParseResult {
  return parseRouteIdentifier(value, "invalid_planning_solver_proposal_id");
}

export function parseSavedViewIdParam(value: unknown): RouteParamParseResult {
  return parseCrmIdentifier(value, "invalid_saved_view_id");
}

export function parseAbsenceIdParam(value: unknown): RouteParamParseResult {
  if (typeof value !== "string") {
    return { ok: false, error: "invalid_absence_id" };
  }
  const normalized = value.trim().toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      normalized
    )
  ) {
    return { ok: false, error: "invalid_absence_id" };
  }
  return { ok: true, value: normalized };
}

function parseRouteIdentifier(value: unknown, error: string): RouteParamParseResult {
  if (typeof value !== "string") return { ok: false, error };
  const normalized = value.trim();
  if (!/^[a-z0-9][a-z0-9_-]{2,119}$/.test(normalized)) {
    return { ok: false, error };
  }
  return { ok: true, value: normalized };
}

function parseCrmIdentifier(value: unknown, error: string): RouteParamParseResult {
  if (typeof value !== "string") return { ok: false, error };
  const normalized = value.trim();
  if (!/^[a-z][a-z0-9-]{2,80}$/.test(normalized)) {
    return { ok: false, error };
  }
  return { ok: true, value: normalized };
}

function parseWorkspaceConfigIdentifier(
  value: unknown,
  error: string
): RouteParamParseResult {
  if (typeof value !== "string") return { ok: false, error };
  const normalized = value.trim();
  if (!/^[a-z][a-z0-9_-]{0,95}$/.test(normalized)) {
    return { ok: false, error };
  }
  return { ok: true, value: normalized };
}
