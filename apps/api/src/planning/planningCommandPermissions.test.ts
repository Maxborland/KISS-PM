import type { AccessProfile } from "@kiss-pm/access-control";
import type { PlanningCommand, TenantUser } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import { permissionForCommand } from "./planningCommandPermissions";

const actor = {
  id: "user-planner",
  tenantId: "tenant-alpha",
  name: "Planner",
  accessProfileId: "profile"
} as TenantUser;

function profile(permissions: AccessProfile["permissions"]): AccessProfile {
  return {
    id: "profile",
    permissions
  } as AccessProfile;
}

function calendarException(resourceId: string | null): PlanningCommand {
  return {
    type: "calendar.exception.upsert",
    payload: {
      id: resourceId ? "absence-1" : "holiday-1",
      calendarId: "calendar-project",
      resourceId,
      date: "2026-07-20",
      workingMinutes: 0,
      reason: resourceId ? "Отпуск" : "Праздник"
    }
  };
}

describe("planning command calendar permissions", () => {
  it("requires plan management for project exceptions and resource management for absences", () => {
    const planManager = profile([
      "tenant.project_plan.read",
      "tenant.project_plan.manage"
    ]);
    const resourceManager = profile([
      "tenant.project_plan.read",
      "tenant.project_resources.manage"
    ]);

    expect(permissionForCommand(calendarException(null), actor, planManager).allowed).toBe(true);
    expect(permissionForCommand(calendarException("user-resource"), actor, planManager)).toEqual(
      expect.objectContaining({ allowed: false, reason: "permission_missing" })
    );

    expect(permissionForCommand(calendarException("user-resource"), actor, resourceManager).allowed).toBe(true);
    expect(permissionForCommand(calendarException(null), actor, resourceManager)).toEqual(
      expect.objectContaining({ allowed: false, reason: "permission_missing" })
    );
  });
});
