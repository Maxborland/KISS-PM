import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { RegisterSurface } from "@/auth/register/register-surface";

// Прод-route «Регистрация» (v3): POST /api/auth/register — самрегистрация нового
// тенанта + авто-логин. Surface несёт собственный AuthShell — монтируется standalone.
export default function RegisterPage() {
  return (
    <AuthRuntimeProvider live>
      <RegisterSurface />
    </AuthRuntimeProvider>
  );
}
