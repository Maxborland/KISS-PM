import type { Metadata } from "next";

import { CrmRuntimeProvider } from "@/crm/lib/crm-runtime";
import { ProjectProducts } from "@/crm/products/products-surface";

// Прод-route «Продукты» (v3) на боевом CRM API (GET/POST/PATCH /api/workspace/products).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Продукты — KISS PM" };

export default function CrmProductsPage() {
  return (
    <CrmRuntimeProvider live>
      <ProjectProducts />
    </CrmRuntimeProvider>
  );
}
