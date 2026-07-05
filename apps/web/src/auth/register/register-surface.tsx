"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthCard, FormError, PasswordField } from "@/auth/lib/auth-bits";
import { useAuth } from "@/auth/lib/use-auth";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

/* ============================================================
   Поверхность «Регистрация» (Auth/Register) — БОЕВОЙ контракт
   POST /api/auth/register (самрегистрация нового тенанта).

   ЧЕСТНОСТЬ: реальный submit идёт в мок через useAuth().register
   (createAuthClient + in-memory fetchImpl, НЕ demoAction-заглушка).
   Мок зеркалит боевой контракт (apps/api/src/authRegistrationRoutes.ts):
   создаётся свежий тенант + роль-владелец + пользователь.
   Переключение на боевой = смена apiOrigin + удаление fetchImpl.
   При ok бэк делает авто-логин: useAuth().refresh() →
   state="authenticated" + user (TenantUser), поэтому показываем
   «Аккаунт создан, вы вошли как {name}».

   Ошибки (FormError → authErr): invalid_registration_payload /
   weak_password / email_taken (для демо: регистрация admin@kiss-pm.local
   → email_taken, т.к. email уже в credentials мока).
   ============================================================ */

export function RegisterSurface() {
  const { state, user, register } = useAuth();
  const router = useRouter();

  // Авто-логин после регистрации → ведём в рабочую область (в Storybook router замокан).
  useEffect(() => {
    if (state === "authenticated" && user !== null) router.replace("/dashboard");
  }, [state, user, router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Код ошибки мутации (для FormError → authErr). null = ошибки нет.
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Авто-логин при ok: после register refresh() переводит сессию в authenticated.
  const registered = state === "authenticated" && user !== null;

  const valid = name.trim().length > 0 && email.trim().length > 0 && password.length > 0;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErrorCode(null);
    // Реальный submit в мок (НЕ заглушка). При ok register сам рефетчит me → authenticated.
    const res = await register({ name: name.trim(), email: email.trim(), password });
    setBusy(false);
    // authErr понимает invalid_registration_payload/weak_password/email_taken; fallback на message.
    if (!res.ok) setErrorCode(res.code ?? res.message);
  };

  // Успех: авто-логин выполнен — показываем подтверждение вместо формы.
  if (registered) {
    return (
      <AuthShell>
        <AuthCard title="Регистрация">
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <CheckCircle2 className="size-8 text-[var(--success-text)]" aria-hidden />
            <p className="text-[length:var(--text-md)] font-semibold text-[var(--text-strong)]">
              Аккаунт создан, вы вошли как {user.name}
            </p>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">
              Сессия активна — рабочее пространство доступно.
            </p>
          </div>
          <PrototypeNote />
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title="Регистрация"
        subtitle="Создайте учётную запись в рабочем пространстве"
        onSubmit={onSubmit}
        footer={
          <span className="text-[length:var(--text-sm)] text-[var(--muted)]">
            Уже есть аккаунт?{" "}
            <Link className="font-medium text-[var(--accent-text)] hover:underline" href="/login">
              Войти
            </Link>
          </span>
        }
      >
        <FormError code={errorCode} />

        <label className="flex flex-col gap-1.5">
          <Label>Имя</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иван Иванов"
            autoComplete="name"
            disabled={busy}
            aria-required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={busy}
            aria-required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <Label>Пароль</Label>
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Минимум 8 символов"
            autoComplete="new-password"
            disabled={busy}
            aria-required
          />
          <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">
            Не короче 8 символов, без управляющих символов.
          </span>
        </label>

        <Button type="submit" variant="default" disabled={!valid || busy} className="w-full">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
          Создать аккаунт
        </Button>

        <PrototypeNote />
      </AuthCard>
    </AuthShell>
  );
}

// Плашка честности: contract-mock боевого контракта регистрации (новый тенант + авто-логин).
function PrototypeNote() {
  if (!prototypeNotesEnabled) return null;
  return (
    <div className="mt-1 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        Contract-mock боевого POST /api/auth/register (новый тенант + авто-логин);
        переключение на боевой = apiOrigin; данные in-memory.
      </span>
    </div>
  );
}
