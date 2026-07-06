import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminSecuritySurface } from "@/admin/security/security-surface";

// Прод-route «Администрирование · Безопасность» (v3) на боевом admin API.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Безопасность — Администрирование — KISS PM" };

export default function AdminSecurityPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminSecuritySurface />
    </AdminRuntimeProvider>
  );
}
