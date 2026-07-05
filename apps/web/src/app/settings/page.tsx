import type { Metadata } from "next";

import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { CommsRuntimeProvider } from "@/communications/lib/comms-runtime";
import { SettingsSurface } from "@/workspace/settings/settings-surface";

// Прод-route «Настройки» (v3): Профиль — из реальной сессии (/api/auth/me, useAuth грузит на
// маунте; демо-вход выключен в live), Уведомления — из comms (/api/workspace/notification-*).
// Интеграции/Оплата — честные empty-state (бэкенда нет).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Настройки — KISS PM" };

export default function SettingsPage() {
  return (
    <AuthRuntimeProvider live>
      <CommsRuntimeProvider live>
        <SettingsSurface />
      </CommsRuntimeProvider>
    </AuthRuntimeProvider>
  );
}
