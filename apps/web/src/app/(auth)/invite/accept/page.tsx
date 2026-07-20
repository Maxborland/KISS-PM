import type { Metadata } from "next";

import { AuthRuntimeProvider } from "@/auth/lib/auth-runtime";
import { InviteAcceptSurface } from "@/auth/invite/invite-accept-surface";

// Прод-route «Принять приглашение» (БЛОК 3): POST /api/auth/invitation/accept.
// Код приходит из письма по ссылке ?token=… → читаем из searchParams и передаём в surface.
// (exactOptionalPropertyTypes: token прокидываем только когда он есть.)
export const metadata: Metadata = { title: "Принять приглашение — KISS PM" };

export default async function InviteAcceptPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthRuntimeProvider live>
      <InviteAcceptSurface {...(token ? { token } : {})} />
    </AuthRuntimeProvider>
  );
}
