import type { Metadata } from "next";

import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { RegisterSurface } from "@/auth/register/register-surface";

// Прод-route «Регистрация» (v3): POST /api/auth/register — самрегистрация нового
// тенанта + авто-логин. Surface несёт собственный AuthShell — монтируется standalone.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Регистрация — KISS PM" };

export default function RegisterPage() {
  return (
    <AuthRuntimeProvider live>
      <RegisterSurface />
    </AuthRuntimeProvider>
  );
}
