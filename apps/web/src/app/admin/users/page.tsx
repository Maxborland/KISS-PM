import { AdminRuntimeProvider } from "@/admin/lib/admin-runtime";
import { AdminUsersSurface } from "@/admin/users/users-surface";

// Прод-route «Администрирование · Пользователи» (v3) на боевом admin API.
export default function AdminUsersPage() {
  return (
    <AdminRuntimeProvider live>
      <AdminUsersSurface />
    </AdminRuntimeProvider>
  );
}
