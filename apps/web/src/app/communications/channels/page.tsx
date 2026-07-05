import type { Metadata } from "next";

import { CommsRuntimeProvider } from "@/communications/lib/comms-runtime";
import { ChannelsSurface } from "@/communications/channels/channels-surface";

// Прод-route «Коммуникации · Каналы» (v3) на боевом API: список/создание/правка каналов,
// участники и лента канала из /api/workspace/communication-channels. Выбор участника — из
// /api/workspace/users. Stories рендерятся без провайдера → mock, поэтому не ломаются.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Каналы — Коммуникации — KISS PM" };

export default function CommunicationsChannelsPage() {
  return (
    <CommsRuntimeProvider live>
      <ChannelsSurface />
    </CommsRuntimeProvider>
  );
}
