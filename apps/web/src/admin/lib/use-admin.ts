"use client";

import { useCallback, useEffect, useState } from "react";

import { guardMutation, type MutationResult } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import {
  createAdminClient,
  type AccessProfile, type AccessRoleCreateInput, type AccessRoleUpdateInput,
  type Permission, type Position, type UserCreateInput, type UserUpdateInput, type WorkspaceUser
} from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

export type AdminLoadStatus = "loading" | "ready" | "error";
export type AdminData = {
  roles: AccessProfile[];
  users: WorkspaceUser[];
  positions: Position[];
  permissions: Permission[];
};
export type AdminMutationResult = MutationResult;

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
export function useAdmin() {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);

  const [data, setData] = useState<AdminData | null>(null);
  const [status, setStatus] = useState<AdminLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [roles, users, positions, catalog] = await Promise.all([
        client.listAccessRoles(),
        client.listUsers(),
        client.listPositions(),
        client.listPermissionCatalog()
      ]);
      setData({ roles: roles.accessRoles, users: users.users, positions: positions.positions, permissions: catalog.permissions });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

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
