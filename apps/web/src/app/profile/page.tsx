import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { ProfileSurface } from "@/auth/profile/profile-surface";

// Прод-route «Личный кабинет» (v3): GET /api/auth/me + PATCH /api/profile +
// PATCH /api/profile/theme на боевом API. demoAutoLogin={false} — профиль читается
// из РЕАЛЬНОЙ cookie-сессии (без демо-авто-входа); нет сессии → честный forbidden.
export default function ProfilePage() {
  return (
    <AuthRuntimeProvider live>
      <ProfileSurface demoAutoLogin={false} />
    </AuthRuntimeProvider>
  );
}
