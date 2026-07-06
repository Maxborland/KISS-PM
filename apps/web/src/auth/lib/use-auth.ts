"use client";

import { useCallback, useEffect, useState } from "react";

import { guardMutation, type MutationResult } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import {
  AuthApiError,
  createAuthClient,
  type AuthMeResponse,
  type AuthSession,
  type ProfileUpdateInput,
  type RegisterRequest,
  type TenantUser,
  type ThemeUpdateInput,
  type WorkspaceUser
} from "./auth-client";
import { createMockAuthFetch } from "./mock-auth-backend";
import { useAuthRuntime } from "./auth-runtime";

/* ============================================================
   useAuth + useProfile (§3) — два хука по образцу comms (раздельные).

   Работают через настоящий createAuthClient. Транспорт переключается через
   AuthRuntimeProvider: live=false (Storybook, по умолчанию) → contract-mock
   (createMockAuthFetch), ОДИН на монтаж (изолированная сессия, как useCrm);
   live=true (прод-routes) → боевой API (createAuthClient без fetchImpl →
   fetch на /api/auth/* + /api/profile, HttpOnly cookie-сессия).

   СОСТОЯНИЕ держим ИЗ ОТВЕТОВ me/login, НЕ из document.cookie:
   боевой cookie — HttpOnly, JS его прочитать не может.
   ============================================================ */

export type AuthState = "anonymous" | "authenticated";
export type AuthLoadStatus = "loading" | "ready" | "error";
// Зеркало CrmMutationResult/CommsMutationResult (общий MutationResult ядра).
export type AuthMutationResult = MutationResult;
// Мутация, ВОЗВРАЩАЮЩАЯ данные для UI (honest-показ reset-токена).
export type AuthDataResult<T> = { ok: true; data: T } | { ok: false; code?: string; message: string };

// Общий фабричный хелпер: один fetch+client на монтаж (изолированная сессия).
// live (из AuthRuntimeProvider) переключает транспорт: mock fetchImpl vs боевой fetch.
function useAuthClient() {
  const { live } = useAuthRuntime();
  return useDomainClient(live, createAuthClient, createMockAuthFetch);
}

// guard: ошибки AuthApiError → {ok:false, code, message} (общий guardMutation ядра).
const guard = guardMutation;
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
  const [sessions, setSessions] = useState<AuthSession[]>([]);

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
        setSessions([]);
        setState("anonymous");
        setStatus("ready");
        setError(null);
        return;
      }
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  // Активные сессии текущего пользователя (GET /api/auth/sessions). 401 → пустой список (не ошибка гейта).
  const loadSessions = useCallback(async () => {
    try {
      const r = await client.listSessions();
      setSessions(r.sessions);
    } catch {
      setSessions([]);
    }
  }, [client]);

  // Отзыв чужой сессии (DELETE) → рефетч списка. Текущую нельзя (self_session_revoke_forbidden).
  const revokeSession = useCallback(
    (sessionId: string): Promise<AuthMutationResult> =>
      guard(async () => {
        await client.revokeSession(sessionId);
        await loadSessions();
      }),
    [client, loadSessions]
  );

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

  // request возвращает данные: devToken для honest-показа (письма нет). Боевой; devToken — демо-замена письма в моке.
  const requestPasswordReset = useCallback(
    (email: string): Promise<AuthDataResult<{ status: "ok"; delivery?: "email" | "none"; devToken?: string }>> =>
      guardData(() => client.requestPasswordReset(email)),
    [client]
  );

  const confirmPasswordReset = useCallback(
    (token: string, password: string): Promise<AuthDataResult<{ status: "ok" }>> =>
      guardData(() => client.confirmPasswordReset(token, password)),
    [client]
  );

  // Правка профиля в ТОЙ ЖЕ сессии (PATCH /api/profile, ТОЛЬКО name/phone/telegram + рефетч me).
  // Нужна, чтобы ЛК работал на ОДНОМ useAuth (иначе useProfile создаёт отдельную мок-сессию → 401).
  const updateProfile = useCallback(
    (input: ProfileUpdateInput): Promise<AuthMutationResult> =>
      guard(async () => {
        await client.updateProfile(input);
        await refresh();
      }),
    [client, refresh]
  );

  // Правка темы в ТОЙ ЖЕ сессии (PATCH /api/profile/theme, ТОЛЬКО theme/accentColor + рефетч me).
  const updateTheme = useCallback(
    (input: ThemeUpdateInput): Promise<AuthMutationResult> =>
      guard(async () => {
        await client.updateTheme(input);
        await refresh();
      }),
    [client, refresh]
  );

  return { client, state, status, error, user, permissions, sessions, loadSessions, revokeSession, reload: refresh, login, logout, register, requestPasswordReset, confirmPasswordReset, updateProfile, updateTheme };
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
  // 401 — это НЕ ошибка загрузки: standalone-потребитель показывает forbidden/login,
  // а не «ошибку» (по образцу useAuth.refresh 401-ветки → anonymous).
  const [unauthorized, setUnauthorized] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const me = await client.me();
      // Профиль показываем только если me.user в полной форме WorkspaceUser (есть email).
      setData("email" in me.user ? (me.user as WorkspaceUser) : null);
      setStatus("ready");
      setError(null);
      setUnauthorized(false);
    } catch (e) {
      if (e instanceof AuthApiError && e.status === 401) {
        // Нет сессии: ready + data=null + unauthorized=true (НЕ status="error").
        setData(null);
        setStatus("ready");
        setError(null);
        setUnauthorized(true);
        return;
      }
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
      setUnauthorized(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  // Правка профиля (ТОЛЬКО name/phone/telegram) → PATCH /api/profile.
  const update = useCallback(
    (input: ProfileUpdateInput): Promise<AuthMutationResult> =>
      guard(async () => {
        const r = await client.updateProfile(input);
        setData(r.user); // обновляем локальный кэш ответом
      }),
    [client]
  );

  // Правка темы (ТОЛЬКО theme/accentColor) → PATCH /api/profile/theme.
  const updateTheme = useCallback(
    (input: ThemeUpdateInput): Promise<AuthMutationResult> =>
      guard(async () => {
        const r = await client.updateTheme(input);
        setData(r.user);
      }),
    [client]
  );

  return { data, status, error, unauthorized, reload: load, update, updateTheme };
}
