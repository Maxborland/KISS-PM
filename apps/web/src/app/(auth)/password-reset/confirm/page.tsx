import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { ResetConfirmSurface } from "@/auth/password-reset/reset-confirm-surface";

// Прод-route «Сброс пароля — подтверждение» (v3): POST /api/auth/password-reset/confirm.
// Токен приходит из письма по ссылке ?token=… → читаем из searchParams и передаём в surface.
// (exactOptionalPropertyTypes: token прокидываем только когда он есть.)
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
