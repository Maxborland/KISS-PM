"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/loading-state";
import { useSessionUser } from "@/shell/use-session-user";

/* /admin → первая вкладка, доступная правам роли (ревью PR #224): раньше был
   безусловный redirect на /admin/users, и роль только с правами конфигурации
   (вкладка «Безопасность») утыкалась в ошибку вместо своей вкладки.
   Порядок совпадает с табами AdminFrame. */
const TAB_BY_PERMISSION: Array<{ href: string; requires: string[] }> = [
  { href: "/admin/users", requires: ["tenant.users.read", "tenant.users.manage"] },
  { href: "/admin/roles", requires: ["tenant.access_profiles.read", "tenant.access_profiles.manage"] },
  { href: "/admin/security", requires: ["tenant.workspace_config.read", "tenant.workspace_config.manage"] },
  { href: "/admin/audit", requires: ["tenant.audit_events.read"] }
];

export function AdminIndexRedirect() {
  const user = useSessionUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const target =
      TAB_BY_PERMISSION.find((t) => t.requires.some((p) => user.permissions.includes(p)))?.href ??
      // Ни одной админ-вкладки: ведём на users — AdminFrame покажет цельный «нет доступа» (G8-05).
      "/admin/users";
    router.replace(target);
  }, [user, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)]">
      <LoadingState label="Открываем администрирование…" />
    </main>
  );
}
