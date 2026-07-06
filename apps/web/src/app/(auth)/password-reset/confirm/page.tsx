import type { Metadata } from "next";

import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { ResetConfirmSurface } from "@/auth/password-reset/reset-confirm-surface";

// Прод-route «Сброс пароля — подтверждение» (v3): POST /api/auth/password-reset/confirm.
// Токен приходит из письма по ссылке ?token=… → читаем из searchParams и передаём в surface.
// (exactOptionalPropertyTypes: token прокидываем только когда он есть.)
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Новый пароль — KISS PM" };

export default async function PasswordResetConfirmPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthRuntimeProvider live>
      <ResetConfirmSurface {...(token ? { token } : {})} />
    </AuthRuntimeProvider>
  );
}
