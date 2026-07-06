import type { Metadata } from "next";

import { CommsRuntimeProvider } from "@/communications/lib/comms-runtime";
import { CallsSurface } from "@/communications/calls/calls-surface";

// Прод-route «Коммуникации · Звонки» (v3) на боевом API: комнаты, сессии, события, записи,
// join-token из /api/workspace/call-rooms. Честно без WebRTC (только метаданные + join-ссылка).
// По умолчанию scope — демо-проект proj-portal. Stories рендерятся без провайдера → mock.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Звонки — Коммуникации — KISS PM" };

export default function CommunicationsCallsPage() {
  return (
    <CommsRuntimeProvider live>
      <CallsSurface />
    </CommsRuntimeProvider>
  );
}
