"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type { CustomFieldDefinition, Position, WorkspaceUser } from "@/lib/api-types";
import { queryKeys } from "@/lib/api/query-keys";

export type AuthMeResponse = {
  user: WorkspaceUser;
  permissions?: string[];
  tenant?: {
    id: string;
    name: string;
    slug?: string;
  };
};

export type AccessRole = {
  id: string;
  tenantId?: string;
  name: string;
  permissions: string[];
};

export type WorkspaceBootstrapData = {
  users: WorkspaceUser[];
  positions: Position[];
  accessRoles: AccessRole[];
  customFields: CustomFieldDefinition[];
};

type ListResponse<Key extends string, Item> = Record<Key, Item[]>;
type WorkspaceBootstrapQueryDefinition = {
  permission: string;
  queryKey: readonly string[];
  queryFn: () => Promise<unknown>;
};

const WORKSPACE_BOOTSTRAP_QUERY_DEFINITIONS: readonly WorkspaceBootstrapQueryDefinition[] = [
  {
    permission: "tenant.users.read",
    queryKey: queryKeys.workspace.users,
    queryFn: fetchWorkspaceUsers
  },
  {
    permission: "tenant.positions.read",
    queryKey: queryKeys.workspace.positions,
    queryFn: fetchWorkspacePositions
  },
  {
    permission: "tenant.access_profiles.read",
    queryKey: queryKeys.workspace.accessRoles,
    queryFn: fetchWorkspaceAccessRoles
  },
  {
    permission: "tenant.workspace_config.read",
    queryKey: queryKeys.workspace.customFields,
    queryFn: fetchWorkspaceCustomFields
  }
];

export function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/api/auth/me", { method: "GET" });
}

export async function fetchWorkspaceUsers(): Promise<WorkspaceUser[]> {
  const response = await apiFetch<ListResponse<"users", WorkspaceUser>>("/api/workspace/users", {
    method: "GET"
  });
  return response.users;
}

export async function fetchWorkspacePositions(): Promise<Position[]> {
  const response = await apiFetch<ListResponse<"positions", Position>>("/api/workspace/positions", {
    method: "GET"
  });
  return response.positions;
}

export async function fetchWorkspaceAccessRoles(): Promise<AccessRole[]> {
  const response = await apiFetch<ListResponse<"accessRoles", AccessRole>>("/api/workspace/access-roles", {
    method: "GET"
  });
  return response.accessRoles;
}

export async function fetchWorkspaceCustomFields(): Promise<CustomFieldDefinition[]> {
  const response = await apiFetch<ListResponse<"customFields", CustomFieldDefinition>>(
    "/api/workspace/config/custom-fields",
    { method: "GET" }
  );
  return response.customFields;
}

export function isSessionRequiredError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    (error.body.error === "session_required" || error.code === "unauthorized")
  );
}

export function useAuthMeQuery() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: fetchAuthMe,
    retry: false
  });
}

export function selectWorkspaceBootstrapQueries(permissions: readonly string[]) {
  const permissionSet = new Set(permissions);
  return WORKSPACE_BOOTSTRAP_QUERY_DEFINITIONS.filter((definition) =>
    permissionSet.has(definition.permission)
  );
}

export function useWorkspaceBootstrapQueries({
  enabled,
  permissions
}: {
  enabled: boolean;
  permissions: readonly string[];
}) {
  return useQueries({
    queries: selectWorkspaceBootstrapQueries(permissions).map((definition) => ({
      queryKey: definition.queryKey,
      queryFn: definition.queryFn,
      enabled
    }))
  });
}

