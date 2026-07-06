import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminRolesSurface } from "@/admin/roles/roles-surface";

// Прод-route «Администрирование · Роли» (v3) на боевом admin API.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Роли — Администрирование — KISS PM" };

export default function AdminRolesPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminRolesSurface />
    </AdminRuntimeProvider>
  );
}
