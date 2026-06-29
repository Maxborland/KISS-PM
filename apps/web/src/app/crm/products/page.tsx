import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { ProjectProducts } from "@/crm/products/products-surface";

// Прод-route «Продукты» (v3) на боевом CRM API (GET/POST/PATCH /api/workspace/products).
export default function CrmProductsPage() {
  return (
    <CrmRuntimeProvider live>
      <ProjectProducts />
    </CrmRuntimeProvider>
  );
}
