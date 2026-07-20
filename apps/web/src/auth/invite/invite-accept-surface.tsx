"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LogIn, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/domain/form-layout";
import { AuthCard, AuthShell, FormError, PasswordField } from "@/auth/lib/auth-bits";
import { useAuth } from "@/auth/lib/use-auth";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

/* ============================================================
   InviteAcceptSurface — экран «Принять приглашение» (задание пароля).
   БОЕВОЙ контракт POST /api/auth/invitation/accept
   (apps/api/src/authRegistrationRoutes.ts) — мок зеркалит.

   Поля: Токен приглашения (64-hex из письма) + Новый пароль (PasswordField).
   Реальный submit идёт через useAuth().acceptInvitation (НЕ demoAction-заглушка).
   ok → «Пароль задан, войдите». Ошибки → FormError (authErr):
   invalid_invitation_token / invitation_token_expired / invitation_token_used /
   invitation_not_pending / weak_password / invalid_reset_confirm_payload.
   ============================================================ */

export type InviteAcceptSurfaceProps = {
  // Предзаполненный токен (из ссылки ?token=… или стори).
  token?: string;
};

export function InviteAcceptSurface({ token: initialToken = "" }: InviteAcceptSurfaceProps) {
  const { acceptInvitation } = useAuth();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorCode(null);
    const res = await acceptInvitation(token.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setErrorCode(res.code ?? "request_failed");
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell>
      <AuthCard
        title="Принять приглашение"
        subtitle="Вставьте код приглашения и задайте пароль для входа в рабочее пространство."
        {...(done ? {} : { onSubmit: submit })}
        footer={
          <Link
            href="/login"
            className="text-[length:var(--text-sm)] font-medium text-[var(--accent)] underline-offset-4 hover:underline"
          >
            Уже есть доступ? Войти
          </Link>
        }
      >
        <PrototypeNote />

        {done ? (
          <div className="flex flex-col gap-3">
            <div
              role="status"
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--success)] bg-[var(--success-soft)] px-3 py-2.5 text-[length:var(--text-sm)] text-[var(--success-text)]"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Пароль задан — войдите со своим email и новым паролем.</span>
            </div>
            <Link
              href="/login"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] text-[length:var(--text-sm)] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              <LogIn className="size-4" aria-hidden />
              Перейти ко входу
            </Link>
          </div>
        ) : (
          <>
            <Field label="Код приглашения" required htmlFor="invite-token">
              <Input
                id="invite-token"
                name="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="64-символьный код из письма"
                className="v4-mono text-[length:var(--text-xs)]"
                aria-invalid={
                  errorCode === "invalid_invitation_token" ||
                  errorCode === "invitation_token_expired" ||
                  errorCode === "invitation_token_used" ||
                  errorCode === "invitation_not_pending"
                }
                required
              />
            </Field>

            <Field label="Пароль" required htmlFor="invite-password">
              <PasswordField
                id="invite-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                aria-invalid={errorCode === "weak_password"}
                required
              />
            </Field>

            <FormError code={errorCode} />

            <Button variant="primary" type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
              Задать пароль и активировать
            </Button>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}

// Плашка-прототип: contract-mock боевого приёма приглашения.
function PrototypeNote() {
  if (!prototypeNotesEnabled) return null;
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        Contract-mock боевого POST /api/auth/invitation/accept — код 64-hex, политика пароля ≥8.
        Демо-код «d»×64. Переключение на боевой = смена apiOrigin; данные in-memory.
      </span>
    </div>
  );
}
