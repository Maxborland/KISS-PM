import type { Metadata } from "next";

import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { LoginSurface } from "@/auth/login/login-surface";

// Прод-route «Вход» (v3) на боевом auth API: POST /api/auth/login → GET /api/auth/me
// (HttpOnly cookie-сессия). Surface несёт собственный AuthShell — монтируется standalone.
// Заголовок вкладки: страницы были неразличимы в табах/истории (G1-AUTH-12).
export const metadata: Metadata = { title: "Вход — KISS PM" };

export default function LoginPage() {
  return (
    <AuthRuntimeProvider live>
      <LoginSurface />
    </AuthRuntimeProvider>
  );
}
