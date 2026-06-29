import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminRolesSurface } from "@/admin/roles/roles-surface";

// Прод-route «Администрирование · Роли» (v3) на боевом admin API.
export default function AdminRolesPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminRolesSurface />
    </AdminRuntimeProvider>
  );
}
