import type { Metadata } from "next";

import { AdminIndexRedirect } from "@/admin/ui/admin-index-redirect";

// Лендинг «Администрирование» → первая вкладка, ДОСТУПНАЯ правам роли
// (раньше — безусловный redirect на /admin/users, тупик для роли только
// с правами конфигурации; ревью PR #224).
export const metadata: Metadata = { title: "Администрирование — KISS PM" };

export default function AdminPage() {
  return <AdminIndexRedirect />;
}
