"use client";

import { useEffect, useState } from "react";

// Лёгкий общий доступ к текущей сессии для оболочки (аватар, роле-гейт пунктов
// навигации). Одноразовый GET /api/auth/me без внешних зависимостей — работает и
// в проде (боевой контракт), и в Storybook (там 401/ошибка → null, аватар «—»).
export type SessionUser = { id: string; name: string; permissions: string[] };

// Публичные страницы: сессии заведомо нет — не дёргаем /api/auth/me,
// чтобы не сыпать 401 в консоль на каждом открытии (G1-AUTH-13).
export function isPublicAuthPath(pathname: string): boolean {
  return ["/login", "/register", "/password-reset"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function useSessionUser(): SessionUser | null {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    if (isPublicAuthPath(window.location.pathname)) return;
    let alive = true;
    void fetch("/api/auth/me", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.user) {
          setUser({ id: d.user.id ?? "", name: d.user.name ?? "", permissions: d.permissions ?? [] });
        }
      })
      .catch(() => {
        /* нет сессии/сети — оболочка показывает нейтральный плейсхолдер */
      });
    return () => {
      alive = false;
    };
  }, []);
  return user;
}

// Инициалы из имени: первые буквы первых двух слов (для BemAvatar).
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return (((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()) || "—";
}
