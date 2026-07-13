"use client";

import { useEffect, useState } from "react";

// Лёгкий общий доступ к текущей сессии для оболочки (аватар, роле-гейт пунктов
// навигации). Одноразовый GET /api/auth/me без внешних зависимостей — работает и
// в проде (боевой контракт), и в Storybook (там 401/ошибка → null, аватар «—»).
export type SessionUser = { id: string; tenantId: string; name: string; permissions: string[] };

// Публичные страницы: сессии заведомо нет — не дёргаем /api/auth/me,
// чтобы не сыпать 401 в консоль на каждом открытии (G1-AUTH-13).
export function isPublicAuthPath(pathname: string): boolean {
  return ["/login", "/register", "/password-reset"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type SessionState = {
  user: SessionUser | null;
  /** true, когда запрос /api/auth/me завершился (успехом, 401 или сетевой ошибкой). */
  loaded: boolean;
};

// Полное состояние сессии — для мест, которым важно отличать «ещё грузится»
// от «сессии нет» (ревью PR #224: протухший cookie оставлял /admin в вечном
// loading, т.к. 401 проглатывался и user навсегда оставался null).
export function useSessionState(): SessionState {
  const [state, setState] = useState<SessionState>({ user: null, loaded: false });
  useEffect(() => {
    if (isPublicAuthPath(window.location.pathname)) {
      setState({ user: null, loaded: true });
      return;
    }
    let alive = true;
    void fetch("/api/auth/me", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setState(
          d?.user
            ? { user: { id: d.user.id ?? "", tenantId: d.user.tenantId ?? "", name: d.user.name ?? "", permissions: d.permissions ?? [] }, loaded: true }
            : { user: null, loaded: true }
        );
      })
      .catch(() => {
        /* нет сессии/сети — оболочка показывает нейтральный плейсхолдер */
        if (alive) setState({ user: null, loaded: true });
      });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function useSessionUser(): SessionUser | null {
  return useSessionState().user;
}

// Инициалы из имени: первые буквы первых двух слов (для BemAvatar).
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return (((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()) || "—";
}
