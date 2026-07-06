import type { Metadata } from "next";

import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminUsersSurface } from "@/admin/users/users-surface";

// Прод-route «Администрирование · Пользователи» (v3) на боевом admin API.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Пользователи — Администрирование — KISS PM" };

export default function AdminUsersPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminUsersSurface />
    </AdminRuntimeProvider>
  );
}
