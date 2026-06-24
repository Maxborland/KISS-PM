"use client";

import { useState } from "react";
import { ArrowRight, KeyRound, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/domain/form-layout";
import { cn } from "@/lib/cn";
import { AuthCard, AuthShell, FormError } from "@/auth/lib/auth-bits";
import { useAuth } from "@/auth/lib/use-auth";

/* ============================================================
   ResetRequestSurface — экран «Сброс пароля» (запрос инструкций).
   GREENFIELD: боевого контракта password-reset/request нет — мок задаёт
   предложенный (POST /api/auth/password-reset/request).

   ЧЕСТНОСТЬ:
   - anti-enumeration: ВСЕГДА показываем единое нейтральное подтверждение
     «Если адрес зарегистрирован — мы отправили инструкции» (не раскрываем,
     существует ли email). Это зеркало боевого «всегда 202».
   - письма нет: если ответ содержит data.devToken (мок отдаёт его для
     зарегистрированного email), показываем токен под честной плашкой
     «Демо: почтового провайдера нет» + ссылку «Перейти к подтверждению».
   - реальный submit идёт в мок через useAuth().requestPasswordReset
     (НЕ demoAction-заглушка). invalid_email → FormError.
   ============================================================ */

export function ResetRequestSurface() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("admin@kiss-pm.local");
  const [busy, setBusy] = useState(false);
  // Код ошибки формы (invalid_email) — null когда ошибки нет.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  // sent=true после успешного запроса → показываем нейтральное подтверждение.
  const [sent, setSent] = useState(false);
  // devToken — демо-показ токена (письма нет); только для зарегистрированного email.
  const [devToken, setDevToken] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorCode(null);
    const res = await requestPasswordReset(email.trim());
    setBusy(false);
    if (!res.ok) {
      // Единственная «настоящая» ошибка запроса — invalid_email (формат).
      setErrorCode(res.code ?? "request_failed");
      return;
    }
    // anti-enumeration: показываем нейтральное подтверждение независимо от того,
    // зарегистрирован ли адрес. devToken есть ТОЛЬКО когда email зарегистрирован.
    setSent(true);
    setDevToken(res.data.devToken ?? null);
  }

  return (
    <AuthShell>
      <AuthCard
        title="Сброс пароля"
        subtitle="Укажите email рабочего пространства — мы отправим инструкции по сбросу пароля."
        onSubmit={submit}
        footer={
          <a
            href="?path=/story/auth-password-reset--confirm"
            className="text-[length:var(--text-sm)] font-medium text-[var(--accent)] underline-offset-4 hover:underline"
          >
            Уже есть токен? Перейти к подтверждению
          </a>
        }
      >
        {/* GREENFIELD-плашка: боевого контракта пока нет (предложенный мок). */}
        <GreenfieldNote />

        <Field label="Email" required htmlFor="reset-email">
          <Input
            id="reset-email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@kiss-pm.local"
            aria-invalid={errorCode === "invalid_email"}
            required
          />
        </Field>

        <FormError code={errorCode} />

        <Button variant="primary" type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
          Отправить инструкции
        </Button>

        {/* anti-enumeration: единое нейтральное подтверждение (не раскрывает существование email). */}
        {sent ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--success)] bg-[var(--success-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--success-text)]"
          >
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Если адрес зарегистрирован — мы отправили инструкции по сбросу пароля.</span>
          </div>
        ) : null}

        {/* Демо-показ токена: письма нет, поэтому честно показываем devToken под плашкой. */}
        {sent && devToken ? <DevTokenPanel token={devToken} /> : null}
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
        API пока нет). POST /api/auth/password-reset/request — anti-enumeration: всегда 202 {"{status:\"ok\"}"}. Транспорт
        — contract-mock, переключение на боевой = смена apiOrigin; данные in-memory.
      </span>
    </div>
  );
}

// Демо-панель токена: честно объясняет, что почтового провайдера нет — токен ниже.
function DevTokenPanel({ token }: { token: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--panel-subtle)] px-3 py-2.5">
      <p className="text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
        Демо: почтового провайдера нет — используйте токен ниже.
      </p>
      <code className="v4-mono select-all break-all rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[10px] text-[var(--text)]">
        {token}
      </code>
      {/* Ссылка в Storybook на стори «Подтверждение» + копия токена в URL-параметр для удобства. */}
      <a
        href={`?path=/story/auth-password-reset--confirm&args=token:${token}`}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1.5",
          "text-[length:var(--text-xs)] font-medium text-[var(--accent-text)] transition-colors hover:bg-[var(--accent)] hover:text-white"
        )}
      >
        Перейти к подтверждению
        <ArrowRight className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}
