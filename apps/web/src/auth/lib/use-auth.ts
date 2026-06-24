"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AuthApiError,
  createAuthClient,
  type AuthMeResponse,
  type ProfileUpdateInput,
  type RegisterRequest,
  type TenantUser,
  type WorkspaceUser
} from "./auth-client";
import { createMockAuthFetch } from "./mock-auth-backend";

/* ============================================================
   useAuth + useProfile (§3) — два хука по образцу comms (раздельные).

   Работают через настоящий createAuthClient. Транспорт — contract-mock
   (createMockAuthFetch), ОДИН на монтаж (изолированная сессия, как useCrm).
   Переключение на боевой API = смена apiOrigin + удаление fetchImpl.

   СОСТОЯНИЕ держим ИЗ ОТВЕТОВ me/login, НЕ из document.cookie:
   боевой cookie — HttpOnly, JS его прочитать не может.
   ============================================================ */

export type AuthState = "anonymous" | "authenticated";
export type AuthLoadStatus = "loading" | "ready" | "error";
// Зеркало CrmMutationResult/CommsMutationResult.
export type AuthMutationResult = { ok: true } | { ok: false; code?: string; message: string };
// Мутация, ВОЗВРАЩАЮЩАЯ данные для UI (honest-показ reset-токена).
export type AuthDataResult<T> = { ok: true; data: T } | { ok: false; code?: string; message: string };

// Общий фабричный хелпер: один fetch+client на монтаж (изолированная сессия).
function useAuthClient() {
  const fetchRef = useRef<typeof fetch | null>(null);
  if (fetchRef.current === null) fetchRef.current = createMockAuthFetch();
  const clientRef = useRef<ReturnType<typeof createAuthClient> | null>(null);
  if (clientRef.current === null) clientRef.current = createAuthClient({ apiOrigin: "", fetchImpl: fetchRef.current });
  return clientRef.current;
}

// guard: ошибки AuthApiError → {ok:false, code, message} (зеркало useCrm.guard).
async function guard(fn: () => Promise<void>): Promise<AuthMutationResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthApiError) return { ok: false, code: e.code, message: e.code };
    return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
  }
}
// guardData: как guard, но возвращает данные мутации для UI.
async function guardData<T>(fn: () => Promise<T>): Promise<AuthDataResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AuthApiError) return { ok: false, code: e.code, message: e.code };
    return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
  }
}

/* ============================================================
   useAuth — гейт сессии.
   На монтаже зовёт me() → anonymous|authenticated (+ user/permissions).
   login/logout/register → AuthMutationResult (при ok рефетч me).
   requestPasswordReset/confirmPasswordReset → AuthDataResult (могут вернуть
   данные для honest-показа токена).
   ============================================================ */
export function useAuth() {
  const client = useAuthClient();

  const [state, setState] = useState<AuthState>("anonymous");
  const [status, setStatus] = useState<AuthLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<TenantUser | WorkspaceUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  // Рефетч сессии: me() → state из ответа (НЕ из cookie). 401 session_required → anonymous (это не ошибка).
  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const me: AuthMeResponse = await client.me();
      setUser(me.user);
      setPermissions(me.permissions);
      setState("authenticated");
      setStatus("ready");
      setError(null);
    } catch (e) {
      if (e instanceof AuthApiError && e.status === 401) {
        setUser(null);
        setPermissions([]);
        setState("anonymous");
        setStatus("ready");
        setError(null);
        return;
      }
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    (email: string, password: string): Promise<AuthMutationResult> =>
      guard(async () => {
        await client.login(email, password);
        await refresh(); // при ok рефетч me → authenticated + user/permissions
      }),
    [client, refresh]
  );

  const logout = useCallback(
    (): Promise<AuthMutationResult> =>
      guard(async () => {
        await client.logout();
        await refresh(); // me снова 401 → anonymous
      }),
    [client, refresh]
  );

  const register = useCallback(
    (input: RegisterRequest): Promise<AuthMutationResult> =>
      guard(async () => {
        await client.register(input); // авто-логин на бэке
        await refresh();
      }),
    [client, refresh]
  );

  // request возвращает данные: devToken для honest-показа (письма нет). GREENFIELD.
  const requestPasswordReset = useCallback(
    (email: string): Promise<AuthDataResult<{ status: "ok"; devToken?: string }>> =>
      guardData(() => client.requestPasswordReset(email) as Promise<{ status: "ok"; devToken?: string }>),
    [client]
  );

  const confirmPasswordReset = useCallback(
    (token: string, password: string): Promise<AuthDataResult<{ status: "ok" }>> =>
      guardData(() => client.confirmPasswordReset(token, password)),
    [client]
  );

  return { client, state, status, error, user, permissions, reload: refresh, login, logout, register, requestPasswordReset, confirmPasswordReset };
}

/* ============================================================
   useProfile — просмотр/правка профиля (authenticated).
   data:WorkspaceUser|null читается из me.user; правка пишется PATCH профиля.
   ============================================================ */
export function useProfile() {
  const client = useAuthClient();

  const [data, setData] = useState<WorkspaceUser | null>(null);
  const [status, setStatus] = useState<AuthLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const me = await client.me();
      // Профиль показываем только если me.user в полной форме WorkspaceUser (есть email).
      setData("email" in me.user ? (me.user as WorkspaceUser) : null);
      setStatus("ready");
      setError(null);
    } catch (e) {
      if (e instanceof AuthApiError && e.status === 401) {
        setData(null);
        setStatus("error");
        setError("session_required");
        return;
      }
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    (input: ProfileUpdateInput): Promise<AuthMutationResult> =>
      guard(async () => {
        const r = await client.updateProfile(input);
        setData(r.user); // обновляем локальный кэш ответом
      }),
    [client]
  );

  return { data, status, error, reload: load, update };
}
