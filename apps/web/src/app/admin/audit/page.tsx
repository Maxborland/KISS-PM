import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminAuditSurface } from "@/admin/audit/audit-surface";

// Прод-route «Администрирование · Аудит» (v3) на боевом GET /api/tenant/current/audit-events.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Аудит — Администрирование — KISS PM" };

export default function AdminAuditPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminAuditSurface />
    </AdminRuntimeProvider>
  );
}
