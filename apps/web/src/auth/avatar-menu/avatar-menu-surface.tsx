"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, ChevronDown, LogOut, Moon, Settings, ShieldCheck, Sun, User } from "lucide-react";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SurfaceState } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { demoAction } from "@/views/lib/demo";
import { authErr } from "@/auth/lib/auth-bits";
import { useAuth } from "@/auth/lib/use-auth";
import type { WorkspaceUser } from "@/auth/lib/auth-client";

/* ============================================================
   Auth/Меню аватара — функциональное меню из верхней панели.
   Заменяет статический views/blocks/avatar-menu-block.tsx: реальные
   данные сессии (GET /api/auth/me), переключение темы (PATCH
   /api/profile/theme) и выход (POST /api/auth/logout) через настоящий
   createAuthClient + contract-mock. Переключение на боевой = apiOrigin.

   ЧЕСТНОСТЬ: мок стартует anonymous → авто-вход демо-кредами один раз
   (плашка «Демо»). Переходы Профиль/Настройки/Уведомления — навигация
   рабочего приложения (demoAction). «Активные сессии» БЕЗ контракта —
   честный плейсхолдер, не фейковый список.
   ============================================================ */

const initials = (name: string) => {
  const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
};
const avatarColor = (name: string): BemAvatarColor => {
  const colors: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length]!;
};
const THEME_LABEL: Record<WorkspaceUser["theme"], string> = { light: "Светлая", dark: "Тёмная" };

const DEMO_EMAIL = "admin@kiss-pm.local";
const DEMO_PASSWORD = "kiss-pm-admin";

export function AvatarMenuSurface() {
  const { state, status, error, user, permissions, login, logout, reload, updateTheme } = useAuth();

  const autoLoginRef = useRef(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (autoLoginRef.current) return;
    autoLoginRef.current = true;
    void (async () => {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
      setBootstrapping(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profileUser: WorkspaceUser | null = user && "email" in user ? (user as WorkspaceUser) : null;

  async function toggleTheme() {
    if (!profileUser) return;
    const next = profileUser.theme === "light" ? "dark" : "light";
    setBusy(true);
    setNotice(null);
    const res = await updateTheme({ theme: next });
    setBusy(false);
    setNotice(res.ok ? `Тема сохранена: ${THEME_LABEL[next]}` : `Не удалось: ${authErr(res.ok ? undefined : res.code, res.ok ? undefined : res.message)}`);
  }

  async function handleLogout() {
    setBusy(true);
    await logout();
    setBusy(false);
    setLoggedOut(true);
  }

  if (loggedOut) {
    return (
      <WorkspaceShell activeNav="Профиль">
        <main className="min-w-0 flex-1 overflow-auto p-4">
          <ProtoBanner />
          <SurfaceState
            status="forbidden"
            forbidden={{
              title: "Вы вышли из системы",
              description: "Сессия завершена (POST /api/auth/logout). В рабочем приложении откроется экран входа.",
              action: (
                <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                  Войти снова
                </Button>
              )
            }}
          >
            <span />
          </SurfaceState>
        </main>
      </WorkspaceShell>
    );
  }

  const surfaceStatus =
    bootstrapping || status === "loading"
      ? "loading"
      : status === "error"
        ? "error"
        : state === "authenticated" && profileUser
          ? "ready"
          : "forbidden";

  return (
    <WorkspaceShell activeNav="Профиль">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />
        <div className="mb-3">
          <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Меню аватара</h1>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Быстрые действия из верхней панели рабочего пространства</p>
        </div>

        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Демо</span>
          <span>Выполнен вход админом ({DEMO_EMAIL}) — мок стартует анонимно. Меню ниже отдаёт реальные данные сессии (GET /api/auth/me).</span>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          loadingLabel="Демо: выполняем вход…"
          errorFormat={authErr}
          forbidden={{ title: "Требуется вход в систему", description: "Сессия не найдена — войдите, чтобы открыть меню." }}
        >
          {profileUser ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              {/* Живое раскрытое меню (defaultOpen для витрины) */}
              <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
                <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Раскрытое меню · из верхней панели</h2>
                <DropdownMenu defaultOpen modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">
                      <BemAvatar initials={initials(profileUser.name)} color={avatarColor(profileUser.name)} size="sm" />
                      {profileUser.name}
                      <ChevronDown className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[264px]">
                    <DropdownMenuLabel>
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-[length:var(--text-sm)] text-[var(--text-strong)]">{profileUser.name}</strong>
                        <span className="text-[length:var(--text-xs)] text-[var(--muted)]">{profileUser.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem {...demoAction("переход в профиль")}>
                      <User className="size-4" aria-hidden />
                      Профиль
                    </DropdownMenuItem>
                    <DropdownMenuItem {...demoAction("переход в настройки")}>
                      <Settings className="size-4" aria-hidden />
                      Настройки
                    </DropdownMenuItem>
                    <DropdownMenuItem {...demoAction("переход в уведомления")}>
                      <Bell className="size-4" aria-hidden />
                      Уведомления
                    </DropdownMenuItem>
                    {/* Переключение темы — РЕАЛЬНОЕ (PATCH /api/profile/theme). preventDefault держит меню открытым. */}
                    <DropdownMenuItem
                      disabled={busy}
                      onSelect={(e) => {
                        e.preventDefault();
                        void toggleTheme();
                      }}
                    >
                      {profileUser.theme === "light" ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
                      Тема: {THEME_LABEL[profileUser.theme]}
                      <span className="ml-auto text-[length:var(--text-xs)] text-[var(--muted-soft)]">переключить</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem {...demoAction("переход в безопасность")}>
                      <ShieldCheck className="size-4" aria-hidden />
                      Безопасность
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={busy}
                      onSelect={(e) => {
                        e.preventDefault();
                        void handleLogout();
                      }}
                    >
                      <LogOut className="size-4" aria-hidden />
                      Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {notice ? (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
                    <Check className="size-3.5 text-[var(--success-text)]" aria-hidden />
                    {notice}
                  </div>
                ) : null}
              </section>

              {/* Сводка сессии (реальные данные me) + честный плейсхолдер устройств */}
              <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3">
                  <BemAvatar initials={initials(profileUser.name)} color={avatarColor(profileUser.name)} size="lg" />
                  <div className="min-w-0">
                    <div className="truncate text-[length:var(--text-md)] font-bold text-[var(--text-strong)]">{profileUser.name}</div>
                    <div className="truncate text-[length:var(--text-sm)] text-[var(--muted)]">{profileUser.email}</div>
                  </div>
                  <Chip variant="success" className="ml-auto">Активная сессия</Chip>
                </div>
                <dl className="flex flex-col gap-2 text-[length:var(--text-xs)]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--muted-soft)]">Тема</dt>
                    <dd className="flex items-center gap-1.5 text-[var(--muted-strong)]">
                      {THEME_LABEL[profileUser.theme]}
                      <span className="inline-block size-3 rounded-full border border-[var(--border)]" style={{ backgroundColor: profileUser.accentColor }} aria-hidden />
                      <span className="v4-mono">{profileUser.accentColor}</span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--muted-soft)]">Прав назначено</dt>
                    <dd className="v4-num text-[var(--muted-strong)]">{permissions.length}</dd>
                  </div>
                </dl>
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
                  Список активных устройств появится после контракта сессий — здесь честный плейсхолдер вместо фейковых данных.
                </div>
                <Button variant="destructive-soft" size="sm" className="self-start" disabled={busy} onClick={() => void handleLogout()}>
                  <LogOut className="size-3.5" aria-hidden />
                  Выйти из системы
                </Button>
              </section>
            </div>
          ) : (
            <span />
          )}
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}

function ProtoBanner() {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
      <span>
        Боевой контракт: GET /api/auth/me + PATCH /api/profile/theme (тема) + POST /api/auth/logout. Транспорт — contract-mock;
        переключение на боевой = apiOrigin. Данные in-memory.
      </span>
    </div>
  );
}
