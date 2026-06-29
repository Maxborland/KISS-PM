import { CommsRuntimeProvider } from "@/communications/lib/comms-runtime";
import { NotificationsSurface } from "@/communications/notifications/notifications-surface";

// Прод-route «Коммуникации · Уведомления» (v3) на боевом API: лента уведомлений + per-item read
// (bulk честно = N вызовов POST /read, отдельной ручки нет) и настройки доставки (PUT upsert)
// из /api/workspace/{notifications,notification-preferences}. Stories без провайдера → mock.
export default function CommunicationsNotificationsPage() {
  return (
    <CommsRuntimeProvider live>
      <NotificationsSurface />
    </CommsRuntimeProvider>
  );
}
