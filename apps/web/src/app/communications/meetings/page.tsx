import { CommsRuntimeProvider } from "@/communications/lib/comms-runtime";
import { MeetingsSurface } from "@/communications/meetings/meetings-surface";

// Прод-route «Коммуникации · Встречи» (v3) на боевом API: список/создание/статус встреч,
// заметки, внешние ссылки, action-items из /api/workspace/meetings. Участники/ответственные —
// из /api/workspace/users. По умолчанию scope — демо-проект proj-portal. GET-детали митинга
// (участники/ноты/ссылки/action-items) бэкенд в этом слайсе не отдаёт — деталь показывает
// демо-снимок плюс добавленное за сессию (см. blockers). Stories без провайдера → mock.
export default function CommunicationsMeetingsPage() {
  return (
    <CommsRuntimeProvider live>
      <MeetingsSurface />
    </CommsRuntimeProvider>
  );
}
