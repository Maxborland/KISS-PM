"use client";

import { useCallback, useEffect, useState } from "react";

import { DomainApiError, guardMutation, type MutationResult } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { useResource, type LoadStatus } from "../../lib/use-resource";
import {
  createAdminClient,
  type AccessProfile, type AccessRoleCreateInput, type AccessRoleUpdateInput,
  type Permission, type Position, type UserCreateInput, type UserUpdateInput, type WorkspaceUser
} from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

// 403 (permission_missing) → forbidden — поверхность показывает «Доступ ограничен».
export type AdminLoadStatus = LoadStatus;
export type AdminData = {
  roles: AccessProfile[];
  users: WorkspaceUser[];
  positions: Position[];
  permissions: Permission[];
};
export type AdminMutationResult = MutationResult;
export type AdminLoadScope = "all" | "roles" | "users";

async function optionalForbidden<T>(request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch (e) {
    if (e instanceof DomainApiError && e.status === 403) return fallback;
    throw e;
  }
}

/**
 * Работает через настоящий createAdminClient. Транспорт выбирается по
 * AdminRuntime: live → боевой API (fetch на /api/*, cookie-сессия), mock →
 * contract-mock (createMockAdminFetch), отдельный на каждый монтаж (изолированная
 * сессия). Прод-routes оборачивают surface в <AdminRuntimeProvider live>; stories
 * без провайдера → mock.
 *
 * Зеркало useCrm/usePlanning: загрузка тройки справочников параллельно,
 * guard-обёртка мутаций (AdminApiError.code → {ok:false,code,message}),
 * точечное обновление локального кэша по затронутой сущности.
 */
export function useAdmin(scope: AdminLoadScope = "all") {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);

  const loader = useCallback(async (): Promise<AdminData> => {
    if (scope === "users") {
      const [users, roles, positions] = await Promise.all([
        client.listUsers(),
        optionalForbidden(client.listAccessRoles(), { accessRoles: [] }),
        optionalForbidden(client.listPositions(), { positions: [] })
      ]);
      return {
        roles: roles.accessRoles,
        users: users.users,
        positions: positions.positions,
        permissions: []
      };
    }

    if (scope === "roles") {
      const [roles, users, catalog] = await Promise.all([
        client.listAccessRoles(),
        optionalForbidden(client.listUsers(), { users: [] }),
        client.listPermissionCatalog()
      ]);
      return {
        roles: roles.accessRoles,
        users: users.users,
        positions: [],
        permissions: catalog.permissions
      };
    }

    const [roles, users, positions, catalog] = await Promise.all([
      client.listAccessRoles(),
      client.listUsers(),
      client.listPositions(),
      client.listPermissionCatalog()
    ]);
    return { roles: roles.accessRoles, users: users.users, positions: positions.positions, permissions: catalog.permissions };
  }, [client, scope]);
  const { data, status, error, setData, reload: load } = useResource(loader);

  const guard = guardMutation;

  const patchUser = (u: WorkspaceUser) => setData((d) => (d ? { ...d, users: d.users.map((x) => (x.id === u.id ? u : x)) } : d));

  // ---- роли ----
  const createRole = useCallback((input: AccessRoleCreateInput) => guard(async () => { const r = await client.createAccessRole(input); setData((d) => (d ? { ...d, roles: [...d.roles, r.accessProfile] } : d)); }), [client, guard]);
  const updateRole = useCallback((roleId: string, input: AccessRoleUpdateInput) => guard(async () => { const r = await client.updateAccessRole(roleId, input); setData((d) => (d ? { ...d, roles: d.roles.map((x) => (x.id === roleId ? r.accessRole : x)) } : d)); }), [client, guard]);
  const deleteRole = useCallback((roleId: string) => guard(async () => { await client.deleteAccessRole(roleId); setData((d) => (d ? { ...d, roles: d.roles.filter((x) => x.id !== roleId) } : d)); }), [client, guard]);

  // ---- пользователи ----
  const createUser = useCallback((input: UserCreateInput) => guard(async () => { const r = await client.createUser(input); setData((d) => (d ? { ...d, users: [...d.users, r.user] } : d)); }), [client, guard]);
  const updateUser = useCallback((userId: string, input: UserUpdateInput) => guard(async () => { const r = await client.updateUser(userId, input); patchUser(r.user); }), [client, guard]);
  // Деактивация = PATCH status:"inactive"; затронутый пользователь обновляется в кэше.
  const deactivateUser = useCallback((userId: string) => guard(async () => { const r = await client.deactivateUser(userId); patchUser(r.user); }), [client, guard]);

  return { client, data, status, error, reload: load, createRole, updateRole, deleteRole, createUser, updateUser, deactivateUser };
}
