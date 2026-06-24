"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/* ============================================================
   Общие крошки блока «Auth/Профиль» (зеркало crm-bits / comms-bits):
   RU-маппинг кодов ошибок, центрированный unauth-каркас (AuthShell/
   AuthCard), мелкие UI-крошки (PasswordField, FormError).
   ============================================================ */

/* ---- RU-маппинг ВСЕХ кодов ошибок (login/logout/me/profile + greenfield register/reset) ---- */
const ERR: Record<string, string> = {
  // login (БОЕВОЙ)
  invalid_login_payload: "Проверьте email и пароль",
  too_many_login_attempts: "Слишком много попыток — повторите позже",
  invalid_credentials: "Неверный email или пароль",
  user_not_found: "Пользователь не найден",
  user_inactive: "Учётная запись отключена",
  auth_not_configured: "Аутентификация недоступна",
  // сессия (БОЕВОЙ)
  session_required: "Требуется вход в систему",
  // профиль (правка)
  invalid_profile_name: "Некорректное имя",
  invalid_profile_phone: "Некорректный телефон",
  invalid_profile_telegram: "Некорректный Telegram",
  invalid_profile_theme: "Некорректная тема оформления",
  invalid_profile_accent_color: "Некорректный цвет акцента",
  // GREENFIELD: register
  invalid_register_payload: "Проверьте имя, email и пароль",
  weak_password: "Пароль слишком простой — минимум 8 символов",
  email_taken: "Этот email уже зарегистрирован",
  // GREENFIELD: password-reset
  invalid_email: "Некорректный email",
  invalid_reset_confirm_payload: "Проверьте токен и пароль",
  invalid_reset_token: "Ссылка для сброса недействительна",
  token_expired: "Срок действия ссылки истёк",
  reset_token_used: "Ссылка уже была использована",
  // общие транспортные
  invalid_json: "Некорректный запрос",
  not_found: "Не найдено",
  request_failed: "Не удалось выполнить запрос"
};
// RU-текст кода ошибки (как commsErr/crmErr): код → человекочитаемая строка.
export const authErr = (code?: string, fallback?: string) => (code && ERR[code]) || fallback || code || "Ошибка";

/* ============================================================
   Unauth-каркас: центрированная карточка (login/register/reset).
   Переиспользует стили .login-screen / .login-card* из bem-supplement.css.
   Бренд-блок вынесен сюда из views/screens/login-screen-view.tsx, чтобы
   register/reset не дублировали разметку.
   ============================================================ */

export type AuthShellProps = { children: ReactNode; className?: string };

// Полноэкранный центрированный фон (для meta.layout:"fullscreen" стори).
export function AuthShell({ children, className }: AuthShellProps) {
  return (
    <div className={cn("app-canvas login-screen", className)}>
      <div className="app-canvas__panel app-canvas__panel--bare">
        <main className="login-screen__main">{children}</main>
      </div>
    </div>
  );
}

export type AuthCardProps = {
  title: string;
  subtitle?: string;
  footer?: ReactNode; // ссылки «Уже есть аккаунт → Войти» и т.п.
  children: ReactNode; // форма/поля
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
};

// Карточка unauth-экрана: бренд + заголовок + лид + контент (форма) + футер.
export function AuthCard({ title, subtitle, footer, children, onSubmit, className }: AuthCardProps) {
  return (
    <form className={cn("login-card", className)} noValidate onSubmit={onSubmit}>
      <div className="login-card__brand">
        <span className="login-card__brand-mark" aria-hidden>
          К
        </span>
        <div className="login-card__brand-text">
          <span className="login-card__brand-title">KISS PM</span>
          <span className="login-card__brand-meta">Рабочее пространство</span>
        </div>
      </div>
      <h1 className="login-card__title">{title}</h1>
      {subtitle ? <p className="login-card__lead">{subtitle}</p> : null}
      <div className="login-card__form">{children}</div>
      {footer ? <div className="login-card__foot">{footer}</div> : null}
    </form>
  );
}

/* ============================================================
   Мелкие UI-крошки
   ============================================================ */

// Inline-алерт ошибки формы (role="alert" — анонс скринридерам).
export function FormError({ code, fallback, className }: { code?: string | null; fallback?: string; className?: string }) {
  if (!code) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--danger-text)]",
        className
      )}
    >
      {authErr(code, fallback)}
    </div>
  );
}

// Поле пароля с переключателем показа (кнопка eye/eye-off).
export function PasswordField(props: React.ComponentProps<typeof Input>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn("pr-10", props.className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-[var(--muted)]"
        aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={shown}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </Button>
    </div>
  );
}
