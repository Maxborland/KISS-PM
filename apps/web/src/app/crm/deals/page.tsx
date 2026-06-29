import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { ProjectDeals } from "@/crm/deals/deals-surface";

// Прод-route «Сделки» (v3): воронка продаж на боевом CRM API
// (/api/workspace/{pipelines,deal-stages,opportunities} + переходы стадий/воронок).
export default function CrmDealsPage() {
  return (
    <CrmRuntimeProvider live>
      <ProjectDeals />
    </CrmRuntimeProvider>
  );
}
