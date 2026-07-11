import { describe, expect, it } from "vitest";
import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { canReadProjectCustomFields, customFieldsVisibleToProjectReader } from "./workspaceConfigRoutes";

const actor = { id: "user-alpha", tenantId: "tenant-alpha", accessProfileId: "profile" } as TenantUser;

describe("project custom-field read policy", () => {
  it("allows project-plan readers and workspace-config readers in the same tenant", () => {
    const planReader = { id: "plan-reader", permissions: ["tenant.project_plan.read"] } as AccessProfile;
    const configReader = { id: "config-reader", permissions: ["tenant.workspace_config.read"] } as AccessProfile;
    expect(canReadProjectCustomFields({ actor, profile: planReader, targetTenantId: "tenant-alpha" })).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(canReadProjectCustomFields({ actor, profile: configReader, targetTenantId: "tenant-alpha" }).allowed).toBe(true);
  });

  it("denies missing permissions and cross-tenant reads", () => {
    const planReader = { id: "plan-reader", permissions: ["tenant.project_plan.read"] } as AccessProfile;
    const unrelated = { id: "unrelated", permissions: [] } as unknown as AccessProfile;
    expect(canReadProjectCustomFields({ actor, profile: unrelated, targetTenantId: "tenant-alpha" }).allowed).toBe(false);
    expect(canReadProjectCustomFields({ actor, profile: planReader, targetTenantId: "tenant-beta" })).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });

  it("filters non-project definitions for plan-only readers", () => {
    const definitions = [
      { id: "project-field", targetEntity: "project" },
      { id: "crm-field", targetEntity: "opportunity" }
    ];
    const planReader = { id: "plan-reader", permissions: ["tenant.project_plan.read"] } as AccessProfile;
    const configReader = { id: "config-reader", permissions: ["tenant.workspace_config.read"] } as AccessProfile;

    expect(customFieldsVisibleToProjectReader(
      { actor, profile: planReader, targetTenantId: "tenant-alpha" },
      definitions
    )).toEqual([definitions[0]]);
    expect(customFieldsVisibleToProjectReader(
      { actor, profile: configReader, targetTenantId: "tenant-alpha" },
      definitions
    )).toEqual(definitions);
  });});
