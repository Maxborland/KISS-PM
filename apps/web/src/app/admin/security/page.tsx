import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminSecuritySurface } from "@/admin/security/security-surface";

// Прод-route «Администрирование · Безопасность» (v3) на боевом admin API.
export default function AdminSecurityPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminSecuritySurface />
    </AdminRuntimeProvider>
  );
}
