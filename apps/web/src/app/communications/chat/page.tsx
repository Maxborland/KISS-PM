import type { Metadata } from "next";

import { CommsRuntimeProvider } from "@/communications/lib/comms-runtime";
import { ChatSurface } from "@/communications/chat/chat-surface";

// Прод-route «Коммуникации · Чат» (v3) на боевом API: беседы сущности, сообщения, реакции,
// закрепление, read-state из /api/workspace/conversations. Scope сущности резолвится из реальных
// проектов воркспейса (useCommsEntityScope: ?project=<id> deep-link → иначе первый проект);
// демо-проект proj-portal — дефолт только в contract-mock. Имена авторов — из /api/workspace/users.
// Stories рендерятся без провайдера → mock, поэтому не ломаются.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Чат — Коммуникации — KISS PM" };

export default function CommunicationsChatPage() {
  return (
    <CommsRuntimeProvider live>
      <ChatSurface />
    </CommsRuntimeProvider>
  );
}
