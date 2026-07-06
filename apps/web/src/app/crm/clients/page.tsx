import type { Metadata } from "next";

import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { ProjectClients } from "@/crm/clients/clients-surface";

// Прод-route «Клиенты» (v3) на боевом CRM API (GET/POST/PATCH /api/workspace/clients).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Клиенты — KISS PM" };

export default function CrmClientsPage() {
  return (
    <CrmRuntimeProvider live>
      <ProjectClients />
    </CrmRuntimeProvider>
  );
}
