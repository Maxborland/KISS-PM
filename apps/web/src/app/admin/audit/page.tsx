import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminAuditSurface } from "@/admin/audit/audit-surface";

// Прод-route «Администрирование · Аудит» (v3) на боевом GET /api/tenant/current/audit-events.
export default function AdminAuditPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminAuditSurface />
    </AdminRuntimeProvider>
  );
}
