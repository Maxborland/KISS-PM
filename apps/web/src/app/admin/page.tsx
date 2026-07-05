import type { Metadata } from "next";

import { redirect } from "next/navigation";

// Лендинг «Администрирование» → первая боевая v3-вкладка (Пользователи).
// (Раньше рендерил v2-монолит 09-admin; теперь — реальная поверхность.)
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Администрирование — KISS PM" };

export default function AdminPage() {
  redirect("/admin/users");
}
