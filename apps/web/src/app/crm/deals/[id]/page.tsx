import type { Metadata } from "next";

import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { DealCard } from "@/crm/deals/deal-card-surface";

// Прод-route «Карточка сделки» (v3): id из URL → стартовая сделка
// (внутри surface — селектор по списку сделок). Боевой CRM API: PATCH /opportunities/:id (правка),
// POST /:id/feasibility (осуществимость), POST /:id/activate (создаёт проект), /crm/opportunity/:id/activity (лента).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Карточка сделки — KISS PM" };

export default async function CrmDealCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CrmRuntimeProvider live>
      <DealCard initialId={id} />
    </CrmRuntimeProvider>
  );
}
