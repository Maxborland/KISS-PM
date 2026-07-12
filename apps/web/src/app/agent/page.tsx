import type { Metadata } from "next";

import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { AgentSurface } from "@/workspace/agent/agent-surface";

// Прод-route «Агент»: чат с ассистентом в правах сотрудника — предложения →
// сверка → применение с аудитом. Оболочка — стандартный WorkspaceShell (эталон
// живёт в продукте, а не в маркетинговом окне). Заголовок вкладки — G1-AUTH-12.
export const metadata: Metadata = { title: "AI-агент — KISS PM" };

export default function AgentPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <WorkspaceShell activeNav="Агент">
        <AgentSurface />
      </WorkspaceShell>
    </WorkspaceRuntimeProvider>
  );
}
