import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { DealCard } from "@/crm/deals/deal-card-surface";

// Прод-route «Карточка сделки» (v3): id из URL → стартовая сделка
// (внутри surface — селектор по списку сделок). Боевой CRM API: PATCH /opportunities/:id (правка),
// POST /:id/feasibility (осуществимость), POST /:id/activate (создаёт проект), /crm/opportunity/:id/activity (лента).
export default async function CrmDealCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CrmRuntimeProvider live>
      <DealCard initialId={id} />
    </CrmRuntimeProvider>
  );
}
