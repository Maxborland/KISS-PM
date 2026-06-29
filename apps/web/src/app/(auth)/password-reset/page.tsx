import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { ResetRequestSurface } from "@/auth/password-reset/reset-request-surface";

// Прод-route «Сброс пароля — запрос» (v3): POST /api/auth/password-reset/request.
// Боевой ответ — всегда 202 {status:"ok"} (anti-enumeration); токен уходит письмом,
// поэтому devToken-панель в боевом режиме НЕ показывается (письмо вместо неё).
export default function PasswordResetPage() {
  return (
    <AuthRuntimeProvider live>
      <ResetRequestSurface />
    </AuthRuntimeProvider>
  );
}
