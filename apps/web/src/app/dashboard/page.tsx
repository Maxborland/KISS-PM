import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { DashboardSurface } from "@/workspace/dashboard/dashboard-surface";

// Прод-route «Дашборд» (v3) на боевом workspace API.
export default function DashboardPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <DashboardSurface />
    </WorkspaceRuntimeProvider>
  );
}
