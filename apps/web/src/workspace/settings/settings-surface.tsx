"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Segmented } from "@/components/ui/segmented";
import { SurfaceState } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { authErr } from "@/auth/lib/auth-bits";
import { ProfileContent } from "@/auth/profile/profile-surface";
import { NotificationsPrefs } from "@/communications/notifications/notifications-surface";
import { ReferencesTab } from "@/workspace/references/references-surface";
import { useAuth } from "@/auth/lib/use-auth";
import { useAuthRuntime } from "@/auth/lib/auth-runtime";
import type { WorkspaceUser } from "@/auth/lib/auth-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

/* ============================================================
   Workspace/Настройки — настройки рабочего пространства во вкладках.
   Заменяет статический views/blocks/settings-block.tsx: КАЖДАЯ вкладка
   собрана из РЕАЛЬНЫХ функциональных контрактов (composition):
   - Профиль   → useAuth (GET /api/auth/me + PATCH /api/profile[/theme]),
                 переиспользует ProfileContent из auth/profile.
   - Уведомления → useNotificationPreferences (PUT /notification-preferences),
                 переиспользует NotificationsPrefs из communications/notifications.
   - Справочники → ReferencesTab (workspace/references): CRUD должностей
                 (/api/workspace/positions) и статусов задач (/api/workspace/task-statuses).
   Вкладки «Интеграции»/«Оплата» скрыты: контракта пока НЕТ, показывать нечего,
   кроме роадмап-заглушки, — не заводим мёртвые контролы на прод-роуте (честность
   блока 12). Вернутся вместе с боевым контрактом.
   Переключение на боевой = apiOrigin. Данные in-memory.
   ============================================================ */

type Tab = "profile" | "notifications" | "references";
const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "profile", label: "Профиль" },
  { value: "notifications", label: "Уведомления" },
  { value: "references", label: "Справочники" }
];

const DEMO_EMAIL = "admin@kiss-pm.local";
const DEMO_PASSWORD = "kiss-pm-admin";

export function SettingsSurface() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <WorkspaceShell activeNav="Настройки">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Настройки рабочей области</h1>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Профиль, уведомления и справочники</p>
          </div>
          <Segmented name="settings-tab" value={tab} onChange={setTab} options={TAB_OPTIONS} />
        </div>

        <div key={tab} className="anim-fade-in">
          {tab === "profile" ? (
            <ProfileTab />
          ) : tab === "notifications" ? (
            <NotificationsPrefs />
          ) : (
            <ReferencesTab />
          )}
        </div>
      </main>
    </WorkspaceShell>
  );
}

/* Вкладка «Профиль» — единый useAuth + авто-вход демо-кредами (мок стартует anonymous). */
function ProfileTab() {
  const { live } = useAuthRuntime();
  const { state, status, error, user, permissions, login, updateProfile, updateTheme, requestDeactivation } = useAuth();

  const autoLoginRef = useRef(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  // Исход авто-входа: при провале показываем error (а не forbidden), как в остальных surface.
  const [loginErr, setLoginErr] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setBootstrapping(true);
    setLoginErr(null);
    // live: сессия уже есть (вход в приложение) — useAuth грузит /api/auth/me на маунте, демо-вход не нужен.
    // mock: contract-mock стартует anonymous → демо-вход для наполнения профиля в Storybook.
    if (live) { setBootstrapping(false); return; }
    const r = await login(DEMO_EMAIL, DEMO_PASSWORD);
    if (!r.ok) setLoginErr(r.code ?? r.message);
    setBootstrapping(false);
  }, [live, login]);

  useEffect(() => {
    if (autoLoginRef.current) return;
    autoLoginRef.current = true;
    void bootstrap();
  }, [bootstrap]);

  const profileUser: WorkspaceUser | null = user && "email" in user ? (user as WorkspaceUser) : null;
  const surfaceStatus =
    bootstrapping || status === "loading"
      ? "loading"
      : status === "error" || loginErr
        ? "error"
        : state === "authenticated" && profileUser
          ? "ready"
          : "forbidden";

  return (
    <SurfaceState
      status={surfaceStatus}
      error={error ?? loginErr}
      onRetry={() => void bootstrap()}
      loadingLabel={live ? "Загрузка профиля…" : "Демо: выполняем вход…"}
      errorFormat={authErr}
      forbidden={{ title: "Требуется вход в систему", description: "Сессия не найдена — войдите, чтобы открыть профиль." }}
    >
      {profileUser ? (
        <ProfileContent user={profileUser} permissions={permissions} update={updateProfile} updateTheme={updateTheme} requestDeactivation={requestDeactivation} />
      ) : (
        <span />
      )}
    </SurfaceState>
  );
}

function ProtoBanner() {
  if (!prototypeNotesEnabled) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
      <span>
        Вкладки «Профиль» (GET /api/auth/me + PATCH /api/profile[/theme]), «Уведомления» (PUT /notification-preferences)
        и «Справочники» (CRUD /api/workspace/positions и /api/workspace/task-statuses) — на боевых контрактах через
        contract-mock. Интеграции и оплата скрыты до появления контракта.
        Переключение на боевой = apiOrigin; данные in-memory.
      </span>
    </div>
  );
}
