"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AdminApiError, createAdminClient,
  type AccessProfile, type AccessRoleCreateInput, type AccessRoleUpdateInput,
  type Position, type UserCreateInput, type UserUpdateInput, type WorkspaceUser
} from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

export type AdminLoadStatus = "loading" | "ready" | "error";
export type AdminData = {
  roles: AccessProfile[];
  users: WorkspaceUser[];
  positions: Position[];
};
export type AdminMutationResult = { ok: true } | { ok: false; code?: string; message: string };

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
  // live → боевой createAdminClient (без fetchImpl, fetch на /api/* + cookie-сессия);
  // mock → contract-mock fetchImpl на каждый монтаж (изолированная in-memory сессия).
  const { live } = useAdminRuntime();
  const fetchRef = useRef<typeof fetch | null>(null);
  if (fetchRef.current === null && !live) fetchRef.current = createMockAdminFetch();
  const clientRef = useRef<ReturnType<typeof createAdminClient> | null>(null);
  if (clientRef.current === null) {
    clientRef.current = live
      ? createAdminClient({ apiOrigin: "" })
      : createAdminClient({ apiOrigin: "", fetchImpl: fetchRef.current! });
  }
  const client = clientRef.current;

  const [data, setData] = useState<AdminData | null>(null);
  const [status, setStatus] = useState<AdminLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [roles, users, positions] = await Promise.all([
        client.listAccessRoles(),
        client.listUsers(),
        client.listPositions()
      ]);
      setData({ roles: roles.accessRoles, users: users.users, positions: positions.positions });
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

  // обёртка мутации: ошибки AdminApiError → {ok:false, code, message}
  const guard = useCallback(async (fn: () => Promise<void>): Promise<AdminMutationResult> => {
    try {
      await fn();
      return { ok: true };
    } catch (e) {
      if (e instanceof AdminApiError) return { ok: false, code: e.code, message: e.code };
      return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
    }
  }, []);

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
