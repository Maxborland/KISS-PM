import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { DashboardSurface } from "@/workspace/dashboard/dashboard-surface";

// Прод-route «Дашборд» (v3) на боевом workspace API. CrmRuntimeProvider live
// обязателен: DashboardSurface читает сделки через useCrm(), и без него плитки CRM
// молча считались из mock-crm-backend (BUG-SHELL-04).
export default function DashboardPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <CrmRuntimeProvider live>
        <DashboardSurface />
      </CrmRuntimeProvider>
    </WorkspaceRuntimeProvider>
  );
}
