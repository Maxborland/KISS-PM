import type { Metadata } from "next";

import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { WorkspaceRuntimeProvider } from "@/workspace/lib/workspace-runtime";
import { DashboardSurface } from "@/workspace/dashboard/dashboard-surface";

// Прод-route «Дашборд» (v3) на боевом workspace API. CrmRuntimeProvider live
// обязателен: DashboardSurface читает сделки через useCrm(), и без него плитки CRM
// молча считались из mock-crm-backend (BUG-SHELL-04).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Дашборд — KISS PM" };

export default function DashboardPage() {
  return (
    <WorkspaceRuntimeProvider live>
      <CrmRuntimeProvider live>
        <DashboardSurface />
      </CrmRuntimeProvider>
    </WorkspaceRuntimeProvider>
  );
}
