export type TenantId = string;
export type UserId = string;
export type AccessProfileId = string;

export type Tenant = {
  id: TenantId;
  name: string;
};

export type TenantUser = {
  id: UserId;
  tenantId: TenantId;
  name: string;
  accessProfileId: AccessProfileId;
};

export function createTenant(input: Tenant): Tenant {
  return {
    id: input.id,
    name: input.name
  };
}

export function createTenantUser(input: TenantUser): TenantUser {
  return {
    id: input.id,
    tenantId: input.tenantId,
    name: input.name,
    accessProfileId: input.accessProfileId
  };
}

export function listTenantUsers(
  users: readonly TenantUser[],
  tenantId: TenantId
): TenantUser[] {
  return users.filter((user) => user.tenantId === tenantId);
}

export * from "./workspaceConfig";
export * from "./projectIntake";
export * from "./planning/types";
export * from "./planning/planningCommands";
export * from "./planning/commandReducer";
export * from "./planning/calendar";
export * from "./planning/workingTime";
export * from "./planning/workModel";
export * from "./planning/dependencyGraph";
export * from "./planning/schedulingEngine";
export * from "./planning/resourcePlanning";
export * from "./planning/employeeCapacity";
export * from "./planning/scenarioPlanning";
export * from "./planning/autoSolver";
export * from "./control";
export * from "./controlSurfaces";
export * from "./retrospectives";
export * from "./collaboration";
export * from "./knowledge";
