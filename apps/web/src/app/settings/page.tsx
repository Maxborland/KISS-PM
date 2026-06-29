import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { CommsRuntimeProvider } from "@/communications/lib/comms-runtime";
import { SettingsSurface } from "@/workspace/settings/settings-surface";

// Прод-route «Настройки» (v3): Профиль — из реальной сессии (/api/auth/me, useAuth грузит на
// маунте; демо-вход выключен в live), Уведомления — из comms (/api/workspace/notification-*).
// Интеграции/Оплата — честные empty-state (бэкенда нет).
export default function SettingsPage() {
  return (
    <AuthRuntimeProvider live>
      <CommsRuntimeProvider live>
        <SettingsSurface />
      </CommsRuntimeProvider>
    </AuthRuntimeProvider>
  );
}
