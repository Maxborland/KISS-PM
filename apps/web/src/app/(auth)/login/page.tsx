import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { LoginSurface } from "@/auth/login/login-surface";

// Прод-route «Вход» (v3) на боевом auth API: POST /api/auth/login → GET /api/auth/me
// (HttpOnly cookie-сессия). Surface несёт собственный AuthShell — монтируется standalone.
export default function LoginPage() {
  return (
    <AuthRuntimeProvider live>
      <LoginSurface />
    </AuthRuntimeProvider>
  );
}
