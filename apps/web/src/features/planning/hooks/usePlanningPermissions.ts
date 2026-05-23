import { useMemo } from "react";

export type PlanningPermissions = {
  canReadProjectPlan: boolean;
  canManageProjectPlan: boolean;
  canManageProjectBaselines: boolean;
  canManageProjectResources: boolean;
  canReadAuditEvents: boolean;
};

export function usePlanningPermissions(permissions: readonly string[]): PlanningPermissions {
  return useMemo(
    () => ({
      canReadProjectPlan: permissions.includes("tenant.project_plan.read"),
      canManageProjectPlan: permissions.includes("tenant.project_plan.manage"),
      canManageProjectBaselines: permissions.includes("tenant.project_baselines.manage"),
      canManageProjectResources: permissions.includes("tenant.project_resources.manage"),
      canReadAuditEvents: permissions.includes("tenant.audit_events.read")
    }),
    [permissions]
  );
}

export function planningPermissionTitle(
  permissions: PlanningPermissions,
  required: keyof PlanningPermissions
): string | undefined {
  if (permissions[required]) return undefined;
  const labels: Record<keyof PlanningPermissions, string> = {
    canReadProjectPlan: "Нет права на чтение плана проекта",
    canManageProjectPlan: "Нет права на изменение плана",
    canManageProjectBaselines: "Нет права на baseline",
    canManageProjectResources: "Нет права на ресурсы проекта",
    canReadAuditEvents: "Нет права на чтение аудита"
  };
  return labels[required];
}
