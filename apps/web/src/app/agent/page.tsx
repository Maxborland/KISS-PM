import type { Metadata } from "next";

import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { AgentSurface } from "@/workspace/agent/agent-surface";

// Прод-route «Агент» (v3): альтернативное ведение работы — безопасные предложения по
// задачам (GET /api/workspace/my-work) с применением по подтверждению (PATCH .../status).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "AI-агент — KISS PM" };

export default function AgentPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <AgentSurface />
    </WorkspaceRuntimeProvider>
  );
}
