import { describe, expect, it } from "vitest";

import {
  parseAbsenceIdParam,
  parseAccessRoleIdParam,
  parseClientIdParam,
  parseContactIdParam,
  parseCrmActivityIdParam,
  parseControlSignalIdParam,
  parseControlSurfaceIdParam,
  parseCorrectiveActionIdParam,
  parseCustomFieldIdParam,
  parseDealStageIdParam,
  parseManagementActionIdParam,
  parseOpportunityIdParam,
  parsePlanningScenarioRunIdParam,
  parsePlanningSolverProposalIdParam,
  parsePlanningSolverRunIdParam,
  parsePositionIdParam,
  parseProductIdParam,
  parseProjectIdParam,
  parseProjectTypeIdParam,
  parseProjectTemplateIdParam,
  parseSavedViewIdParam,
  parseTemplateImprovementActionIdParam,
  parseTenantIdParam,
  parseUserIdParam
} from "./routeParamParsers";

describe("route param parsers", () => {
  it("normalizes safe ids and rejects path-like control ids", () => {
    expect(parseProjectIdParam(" project-control ")).toEqual({
      ok: true,
      value: "project-control"
    });
    expect(parseControlSignalIdParam("signal-control-1")).toEqual({
      ok: true,
      value: "signal-control-1"
    });
    expect(parseControlSurfaceIdParam("surface-delivery")).toEqual({
      ok: true,
      value: "surface-delivery"
    });
    expect(parseAccessRoleIdParam("access-profile-alpha-reader")).toEqual({
      ok: true,
      value: "access-profile-alpha-reader"
    });
    expect(parseUserIdParam("user-alpha-admin")).toEqual({
      ok: true,
      value: "user-alpha-admin"
    });
    expect(parseTenantIdParam("tenant-alpha")).toEqual({
      ok: true,
      value: "tenant-alpha"
    });
    expect(parsePositionIdParam("position-alpha-pm")).toEqual({
      ok: true,
      value: "position-alpha-pm"
    });
    expect(parseCustomFieldIdParam("field-project-priority")).toEqual({
      ok: true,
      value: "field-project-priority"
    });
    expect(parseProjectTemplateIdParam("template-implementation")).toEqual({
      ok: true,
      value: "template-implementation"
    });
    expect(parseClientIdParam("client-romashka")).toEqual({
      ok: true,
      value: "client-romashka"
    });
    expect(parseContactIdParam("contact-main")).toEqual({
      ok: true,
      value: "contact-main"
    });
    expect(parseProductIdParam("product-consulting")).toEqual({
      ok: true,
      value: "product-consulting"
    });
    expect(parseProjectTypeIdParam("project-type-implementation")).toEqual({
      ok: true,
      value: "project-type-implementation"
    });
    expect(parseDealStageIdParam("deal-stage-new")).toEqual({
      ok: true,
      value: "deal-stage-new"
    });
    expect(parseOpportunityIdParam("opportunity-alpha")).toEqual({
      ok: true,
      value: "opportunity-alpha"
    });
    expect(
      parseTemplateImprovementActionIdParam(
        "template-improvement-550e8400-e29b-41d4-a716-446655440000"
      )
    ).toEqual({
      ok: true,
      value: "template-improvement-550e8400-e29b-41d4-a716-446655440000"
    });
    expect(parseCrmActivityIdParam("crm-activity-550e8400-e29b-41d4-a716-446655440000")).toEqual({
      ok: true,
      value: "crm-activity-550e8400-e29b-41d4-a716-446655440000"
    });
    expect(parsePlanningScenarioRunIdParam("planning-scenario-550e8400-e29b-41d4-a716-446655440000")).toEqual({
      ok: true,
      value: "planning-scenario-550e8400-e29b-41d4-a716-446655440000"
    });
    expect(parsePlanningSolverRunIdParam("planning-auto-solver-550e8400-e29b-41d4-a716-446655440000")).toEqual({
      ok: true,
      value: "planning-auto-solver-550e8400-e29b-41d4-a716-446655440000"
    });
    expect(parsePlanningSolverProposalIdParam("proposal-1")).toEqual({
      ok: true,
      value: "proposal-1"
    });
    expect(parseSavedViewIdParam("saved-view-550e8400-e29b-41d4-a716-446655440000")).toEqual({
      ok: true,
      value: "saved-view-550e8400-e29b-41d4-a716-446655440000"
    });
    expect(parseAbsenceIdParam("550E8400-E29B-41D4-A716-446655440000")).toEqual({
      ok: true,
      value: "550e8400-e29b-41d4-a716-446655440000"
    });
    expect(parseManagementActionIdParam("bad/action")).toEqual({
      ok: false,
      error: "invalid_management_action_id"
    });
    expect(parseControlSurfaceIdParam("bad/surface")).toEqual({
      ok: false,
      error: "invalid_control_surface_id"
    });
    expect(parseCorrectiveActionIdParam("bad..action")).toEqual({
      ok: false,
      error: "invalid_corrective_action_id"
    });
    expect(parseAccessRoleIdParam("bad..role")).toEqual({
      ok: false,
      error: "invalid_access_role_id"
    });
    expect(parseUserIdParam("bad/user")).toEqual({
      ok: false,
      error: "invalid_user_id"
    });
    expect(parseTenantIdParam("bad/tenant")).toEqual({
      ok: false,
      error: "invalid_tenant_id"
    });
    expect(parsePositionIdParam("bad..position")).toEqual({
      ok: false,
      error: "invalid_position_id"
    });
    expect(parseCustomFieldIdParam("bad..field")).toEqual({
      ok: false,
      error: "invalid_custom_field_id"
    });
    expect(parseProjectTemplateIdParam("bad/template")).toEqual({
      ok: false,
      error: "invalid_project_template_id"
    });
    expect(parseClientIdParam("bad..client")).toEqual({
      ok: false,
      error: "invalid_client_id"
    });
    expect(parseContactIdParam("bad/contact")).toEqual({
      ok: false,
      error: "invalid_contact_id"
    });
    expect(parseProductIdParam("bad_product")).toEqual({
      ok: false,
      error: "invalid_product_id"
    });
    expect(parseProjectTypeIdParam("bad..project-type")).toEqual({
      ok: false,
      error: "invalid_project_type_id"
    });
    expect(parseDealStageIdParam("bad/stage")).toEqual({
      ok: false,
      error: "invalid_deal_stage_id"
    });
    expect(parseOpportunityIdParam("bad..opportunity")).toEqual({
      ok: false,
      error: "invalid_opportunity_id"
    });
    expect(parseTemplateImprovementActionIdParam("bad/action")).toEqual({
      ok: false,
      error: "invalid_template_improvement_action_id"
    });
    expect(parseCrmActivityIdParam("bad..activity")).toEqual({
      ok: false,
      error: "invalid_crm_activity_id"
    });
    expect(parsePlanningScenarioRunIdParam("bad..scenario")).toEqual({
      ok: false,
      error: "invalid_planning_scenario_id"
    });
    expect(parsePlanningSolverRunIdParam("bad..solver")).toEqual({
      ok: false,
      error: "invalid_planning_solver_run_id"
    });
    expect(parsePlanningSolverProposalIdParam("bad/proposal")).toEqual({
      ok: false,
      error: "invalid_planning_solver_proposal_id"
    });
    expect(parseSavedViewIdParam("bad..view")).toEqual({
      ok: false,
      error: "invalid_saved_view_id"
    });
    expect(parseAbsenceIdParam("bad..absence")).toEqual({
      ok: false,
      error: "invalid_absence_id"
    });
  });
});
