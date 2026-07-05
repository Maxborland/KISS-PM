import type { Metadata } from "next";

import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { ProjectContacts } from "@/crm/contacts/contacts-surface";

// Прод-route «Контакты» (v3) на боевом CRM API (GET/POST/PATCH /api/workspace/contacts).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Контакты — KISS PM" };

export default function CrmContactsPage() {
  return (
    <CrmRuntimeProvider live>
      <ProjectContacts />
    </CrmRuntimeProvider>
  );
}
