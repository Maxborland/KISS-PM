import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { AgentSurface } from "@/workspace/agent/agent-surface";

// Прод-route «Агент» (v3): альтернативное ведение работы — безопасные предложения по
// задачам (GET /api/workspace/my-work) с применением по подтверждению (PATCH .../status).
export default function AgentPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <AgentSurface />
    </WorkspaceRuntimeProvider>
  );
}
