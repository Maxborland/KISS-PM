"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { AuthCard, AuthShell, FormError, PasswordField, authErr } from "@/auth/lib/auth-bits";
import { useAuth } from "@/auth/lib/use-auth";

/* ============================================================
   Поверхность ВХОД (Auth/Login).

   Реальный submit → useAuth().login(email,password) через настоящий
   createAuthClient (транспорт — contract-mock, изолированная сессия на
   монтаж; переключение на боевой = смена apiOrigin, данные in-memory).

   На монтаже useAuth зовёт me() → 401 session_required → anonymous
   (стартовое состояние формы). При ok login → authenticated: показываем
   приветствие + «Выйти» (logout) + честную заглушку редиректа.

   ЧЕСТНОСТЬ:
   - Плашка/футнот «Прототип» с демо-кредами (admin@kiss-pm.local).
   - login/logout/me — БОЕВОЙ контракт (зеркалится дословно в моке).
   - Ссылки футера «Создать аккаунт» / «Забыли пароль?» — навигации между
     стори нет, поэтому это честно неактивный текст (demoAction-стиль).
   ============================================================ */

// Email-валидатор для дизейбла кнопки (мягкий — боевой код всё равно вернёт invalid_credentials/payload).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Демо-пара кред для подсказки (рабочий вход; см. mock-auth-backend seedUsers).
const DEMO_EMAIL = "admin@kiss-pm.local";
const DEMO_PASSWORD = "kiss-pm-admin";

export type LoginSurfaceProps = {
  /** Предзаполнить демо-креды (для стори «с кредами»). */
  prefill?: boolean;
};

export function LoginSurface({ prefill = false }: LoginSurfaceProps) {
  // useAuth: гейт сессии. state/status — стартовое anonymous после me()→401.
  const { state, status, error, user, reload, login, logout } = useAuth();

  const [email, setEmail] = useState(prefill ? DEMO_EMAIL : "");
  const [password, setPassword] = useState(prefill ? DEMO_PASSWORD : "");
  const [busy, setBusy] = useState(false);
  const [errCode, setErrCode] = useState<string | null>(null);

  // Кнопка дизейбл при busy/невалидной форме (email по формату, пароль непустой).
  const formValid = EMAIL_RE.test(email.trim()) && password.length > 0;

  // Реальный submit идёт в мок (НЕ demoAction-заглушка): login → при ok refresh me → authenticated.
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValid || busy) return;
    setBusy(true);
    setErrCode(null);
    const res = await login(email.trim().toLowerCase(), password);
    setBusy(false);
    // Ошибки: invalid_credentials / too_many_login_attempts / user_inactive / invalid_login_payload.
    if (!res.ok) setErrCode(res.code ?? "request_failed");
  }

  async function doLogout() {
    setBusy(true);
    setErrCode(null);
    await logout(); // me снова 401 → anonymous, форма сбрасывается в исходное
    setBusy(false);
    setPassword(prefill ? DEMO_PASSWORD : "");
  }

  // Стартовая загрузка сессии (me) / её ошибка — единый каркас состояний.
  // anonymous и authenticated рендерятся ниже (status "ready").
  return (
    <AuthShell>
      <SurfaceState status={status === "error" ? "error" : "ready"} error={error} errorFormat={authErr} onRetry={() => void reload()} narrow>
        {state === "authenticated" ? (
          <AuthedCard name={user?.name ?? "пользователь"} busy={busy} onLogout={() => void doLogout()} />
        ) : (
          <AuthCard
            title="Вход в KISS PM"
            subtitle="Корпоративный email и пароль рабочего пространства."
            onSubmit={submit}
            footer={<LoginFooter />}
          >
            <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
              Email
              <Input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@kiss-pm.local"
                autoComplete="email"
                disabled={busy}
                aria-invalid={Boolean(errCode)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
              Пароль
              <PasswordField
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                autoComplete="current-password"
                disabled={busy}
                aria-invalid={Boolean(errCode)}
                required
              />
            </label>

            {/* Ошибка входа → FormError(code): RU-текст через authErr. */}
            <FormError code={errCode} />

            <Button variant="primary" type="submit" className="w-full" disabled={!formValid || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? "Вход…" : "Войти"}
            </Button>

            {/* Подсказка с демо-кредами в футноте «Прототип». */}
            <PrototypeFootnote />
          </AuthCard>
        )}
      </SurfaceState>
    </AuthShell>
  );
}

/* ============================================================
   Залогиненное состояние: приветствие + честная заглушка редиректа + «Выйти».
   ============================================================ */
function AuthedCard({ name, busy, onLogout }: { name: string; busy: boolean; onLogout: () => void }) {
  return (
    <AuthCard title="Вы вошли в KISS PM" subtitle={`Добро пожаловать, ${name}.`}>
      {/* Честная заглушка редиректа: в Storybook навигации нет. */}
      <div className="rounded-[var(--radius-md)] border border-[var(--success-border,var(--success))] bg-[var(--success-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--success-text)]">
        Сессия установлена (GET /api/auth/me → authenticated). В приложении здесь — переход в рабочую область.
      </div>
      <Button variant="secondary" type="button" className="w-full" disabled={busy} onClick={onLogout}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
        {busy ? "Выход…" : "Выйти"}
      </Button>
      <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">
        POST /api/auth/logout — идемпотентно; me снова вернёт 401 session_required → вы вернётесь к форме входа.
      </p>
    </AuthCard>
  );
}

/* ============================================================
   Футер-ссылки. Навигации между стори нет → честно неактивный текст
   (demoAction-стиль: видно, но не работает в прототипе).
   ============================================================ */
function LoginFooter() {
  return (
    <div className="flex items-center justify-between gap-2 text-[length:var(--text-xs)]">
      <span className="text-[var(--muted)]" title="Демо-прототип: навигация подключится в рабочем приложении">
        Нет аккаунта? <span className="font-medium text-[var(--muted-strong)]">Создать аккаунт</span>
      </span>
      <span className="font-medium text-[var(--muted-strong)]" title="Демо-прототип: навигация подключится в рабочем приложении">
        Забыли пароль?
      </span>
    </div>
  );
}

/* ============================================================
   Футнот «Прототип» с демо-кредами и пометкой contract-mock.
   ============================================================ */
function PrototypeFootnote() {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        Реальный контракт: POST /api/auth/login → GET /api/auth/me. Контракт-мок, переключение на боевой = apiOrigin; данные in-memory.
        Демо-вход: <code className="v4-mono text-[var(--text-strong)]">{DEMO_EMAIL}</code> / <code className="v4-mono text-[var(--text-strong)]">{DEMO_PASSWORD}</code>.
      </span>
    </div>
  );
}
