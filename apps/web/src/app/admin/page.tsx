import { redirect } from "next/navigation";

// Лендинг «Администрирование» → первая боевая v3-вкладка (Пользователи).
// (Раньше рендерил v2-монолит 09-admin; теперь — реальная поверхность.)
export default function AdminPage() {
  redirect("/admin/users");
}
