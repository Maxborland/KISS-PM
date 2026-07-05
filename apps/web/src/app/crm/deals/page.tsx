import type { Metadata } from "next";

import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { ProjectDeals } from "@/crm/deals/deals-surface";

// Прод-route «Сделки» (v3): воронка продаж на боевом CRM API
// (/api/workspace/{pipelines,deal-stages,opportunities} + переходы стадий/воронок).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Сделки — KISS PM" };

export default function CrmDealsPage() {
  return (
    <CrmRuntimeProvider live>
      <ProjectDeals />
    </CrmRuntimeProvider>
  );
}
