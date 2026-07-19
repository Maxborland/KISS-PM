"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/loading-state";
import { useSessionState } from "@/shell/use-session-user";

/* Корень «/» — auth-aware redirect по образцу AdminIndexRedirect (Н1):
   раньше здесь была dev-заглушка «design-v3 foundation» без единой ссылки —
   тупик для любого, кто открыл корень домена. Сессии нет (или протухла:
   cookie есть, /api/auth/me → 401) — на вход; есть — на домашний экран
   рабочей области «Мои задачи». Заголовок вкладки даёт root layout. */
export default function HomePage() {
  const { user, loaded } = useSessionState();
  const router = useRouter();

  useEffect(() => {
    if (!loaded) return;
    router.replace(user ? "/my-work" : "/login");
  }, [user, loaded, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)]">
      <LoadingState label="Открываем рабочую область…" />
    </main>
  );
}
