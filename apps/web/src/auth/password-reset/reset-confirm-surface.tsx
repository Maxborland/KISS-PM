"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, LogIn, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/domain/form-layout";
import { AuthCard, AuthShell, FormError, PasswordField } from "@/auth/lib/auth-bits";
import { useAuth } from "@/auth/lib/use-auth";

/* ============================================================
   ResetConfirmSurface — экран «Новый пароль» (подтверждение по токену).
   GREENFIELD: боевого контракта password-reset/confirm нет — мок задаёт
   предложенный (POST /api/auth/password-reset/confirm).

   Поля: Токен (64-hex из письма/демо-показа) + Новый пароль (PasswordField).
   Реальный submit идёт в мок через useAuth().confirmPasswordReset
   (НЕ demoAction-заглушка). ok → «Пароль изменён, войдите».
   Ошибки → FormError (authErr): invalid_reset_token / token_expired /
   reset_token_used / weak_password / invalid_reset_confirm_payload.
   ============================================================ */

export type ResetConfirmSurfaceProps = {
  // Предзаполненный токен (стори передаёт валидный/просроченный/использованный).
  token?: string;
};

export function ResetConfirmSurface({ token: initialToken = "" }: ResetConfirmSurfaceProps) {
  const { confirmPasswordReset } = useAuth();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Код ошибки формы — null когда ошибки нет.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  // done=true после успешной смены пароля → показываем финальный экран.
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorCode(null);
    const res = await confirmPasswordReset(token.trim(), password);
    setBusy(false);
    if (!res.ok) {
      // Все ошибки через authErr: invalid_reset_token/token_expired/reset_token_used/weak_password/…
      setErrorCode(res.code ?? "request_failed");
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell>
      <AuthCard
        title="Новый пароль"
        subtitle="Вставьте токен сброса и задайте новый пароль рабочего пространства."
        // onSubmit опускаем на финальном экране (exactOptionalPropertyTypes: не передаём undefined).
        {...(done ? {} : { onSubmit: submit })}
        footer={
          <a
            href="?path=/story/auth-password-reset--request"
            className="text-[length:var(--text-sm)] font-medium text-[var(--accent)] underline-offset-4 hover:underline"
          >
            Нет токена? Запросить сброс заново
          </a>
        }
      >
        {/* GREENFIELD-плашка: боевого контракта пока нет (предложенный мок). */}
        <GreenfieldNote />

        {done ? (
          // Финальный экран: пароль изменён → войти.
          <div className="flex flex-col gap-3">
            <div
              role="status"
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--success)] bg-[var(--success-soft)] px-3 py-2.5 text-[length:var(--text-sm)] text-[var(--success-text)]"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Пароль изменён — войдите с новым паролем.</span>
            </div>
            <a
              href="?path=/story/auth-login--login"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] text-[length:var(--text-sm)] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              <LogIn className="size-4" aria-hidden />
              Перейти ко входу
            </a>
          </div>
        ) : (
          <>
            <Field label="Токен сброса" required htmlFor="reset-token">
              <Input
                id="reset-token"
                name="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="64-символьный токен из письма"
                className="v4-mono text-[length:var(--text-xs)]"
                aria-invalid={errorCode === "invalid_reset_token" || errorCode === "token_expired" || errorCode === "reset_token_used"}
                required
              />
            </Field>

            <Field label="Новый пароль" required htmlFor="reset-password">
              <PasswordField
                id="reset-password"
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
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
              Изменить пароль
            </Button>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}

// GREENFIELD-плашка: предложенный контракт (боевого API сброса пока нет).
function GreenfieldNote() {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        <strong className="font-semibold text-[var(--text-strong)]">GREENFIELD:</strong> предложенный контракт (боевого
        API пока нет). POST /api/auth/password-reset/confirm — токен 64-hex, политика пароля ≥8. Транспорт —
        contract-mock, переключение на боевой = смена apiOrigin; данные in-memory.
      </span>
    </div>
  );
}
