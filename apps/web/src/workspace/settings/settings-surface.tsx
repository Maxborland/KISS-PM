"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Plug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { SurfaceState } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { demoAction } from "@/views/lib/demo";
import { authErr } from "@/auth/lib/auth-bits";
import { ProfileContent } from "@/auth/profile/profile-surface";
import { NotificationsPrefs } from "@/communications/notifications/notifications-surface";
import { useAuth } from "@/auth/lib/use-auth";
import type { WorkspaceUser } from "@/auth/lib/auth-client";

/* ============================================================
   Workspace/Настройки — настройки рабочего пространства во вкладках.
   Заменяет статический views/blocks/settings-block.tsx: КАЖДАЯ вкладка
   собрана из РЕАЛЬНЫХ функциональных контрактов (composition):
   - Профиль   → useAuth (GET /api/auth/me + PATCH /api/profile[/theme]),
                 переиспользует ProfileContent из auth/profile.
   - Уведомления → useNotificationPreferences (PUT /notification-preferences),
                 переиспользует NotificationsPrefs из communications/notifications.
   - Интеграции / Оплата → контракта пока НЕТ → честный EmptyState, кнопка
                 подключения disabled (demoAction). Не фейковые формы.
   Переключение на боевой = apiOrigin. Данные in-memory.
   ============================================================ */

type Tab = "profile" | "notifications" | "integrations" | "billing";
const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "profile", label: "Профиль" },
  { value: "notifications", label: "Уведомления" },
  { value: "integrations", label: "Интеграции" },
  { value: "billing", label: "Оплата" }
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
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Профиль, уведомления, интеграции и оплата</p>
          </div>
          <Segmented name="settings-tab" value={tab} onChange={setTab} options={TAB_OPTIONS} />
        </div>

        {tab === "profile" ? (
          <ProfileTab />
        ) : tab === "notifications" ? (
          <NotificationsPrefs />
        ) : tab === "integrations" ? (
          <IntegrationsTab />
        ) : (
          <BillingTab />
        )}
      </main>
    </WorkspaceShell>
  );
}

/* Вкладка «Профиль» — единый useAuth + авто-вход демо-кредами (мок стартует anonymous). */
function ProfileTab() {
  const { state, status, error, user, permissions, login, updateProfile, updateTheme } = useAuth();

  const autoLoginRef = useRef(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  // Исход авто-входа: при провале показываем error (а не forbidden), как в остальных surface.
  const [loginErr, setLoginErr] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setBootstrapping(true);
    setLoginErr(null);
    const r = await login(DEMO_EMAIL, DEMO_PASSWORD);
    if (!r.ok) setLoginErr(r.code ?? r.message);
    setBootstrapping(false);
  }, [login]);

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
      loadingLabel="Демо: выполняем вход…"
      errorFormat={authErr}
      forbidden={{ title: "Требуется вход в систему", description: "Сессия не найдена — войдите, чтобы открыть профиль." }}
    >
      {profileUser ? (
        <ProfileContent user={profileUser} permissions={permissions} update={updateProfile} updateTheme={updateTheme} />
      ) : (
        <span />
      )}
    </SurfaceState>
  );
}

/* Вкладка «Интеграции» — контракта нет → честный EmptyState. */
function IntegrationsTab() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] py-10 shadow-[var(--shadow-card)]">
      <EmptyState
        title="Интеграции появятся в рабочем приложении"
        description="Подключение CRM, мессенджеров и календарей. Контракта интеграций пока нет — это честный плейсхолдер, не фейковая форма."
        action={
          <Button variant="secondary" size="sm" {...demoAction("подключение интеграции")}>
            <Plug className="size-3.5" aria-hidden />
            Подключить интеграцию
          </Button>
        }
      />
    </div>
  );
}

/* Вкладка «Оплата» — контракта нет → честный EmptyState. */
function BillingTab() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] py-10 shadow-[var(--shadow-card)]">
      <EmptyState
        title="Оплата и тарифы появятся в рабочем приложении"
        description="Управление подпиской и платёжными данными. Биллингового контракта пока нет — здесь честный плейсхолдер."
        action={
          <Button variant="secondary" size="sm" {...demoAction("управление подпиской")}>
            <CreditCard className="size-3.5" aria-hidden />
            Перейти к тарифам
          </Button>
        }
      />
    </div>
  );
}

function ProtoBanner() {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
      <span>
        Вкладки «Профиль» (GET /api/auth/me + PATCH /api/profile[/theme]) и «Уведомления» (PUT /notification-preferences) —
        на боевых контрактах через contract-mock. «Интеграции» и «Оплата» — контракта пока нет (честный EmptyState).
        Переключение на боевой = apiOrigin; данные in-memory.
      </span>
    </div>
  );
}
