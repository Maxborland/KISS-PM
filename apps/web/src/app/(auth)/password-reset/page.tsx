import type { Metadata } from "next";

import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { ResetRequestSurface } from "@/auth/password-reset/reset-request-surface";

// Прод-route «Сброс пароля — запрос» (v3): POST /api/auth/password-reset/request.
// Боевой ответ — всегда 202 {status:"ok"} (anti-enumeration); токен уходит письмом,
// поэтому devToken-панель в боевом режиме НЕ показывается (письмо вместо неё).
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Сброс пароля — KISS PM" };

export default function PasswordResetPage() {
  return (
    <AuthRuntimeProvider live>
      <ResetRequestSurface />
    </AuthRuntimeProvider>
  );
}
