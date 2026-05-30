"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/domain/form-layout";

export type LoginScreenVariant = "default" | "loading" | "error" | "forbidden";

export type LoginScreenViewProps = {
  variant?: LoginScreenVariant;
  defaultEmail?: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit?: (input: { email: string; password: string }) => void | Promise<void>;
};

const DEFAULT_EMAIL = "kamil.bayramov@demo.local";

function loginErrorCopy(error: string | null | undefined) {
  switch (error) {
    case "too_many_login_attempts":
      return {
        title: "Слишком много попыток входа",
        description: "Подождите немного и повторите вход позже."
      };
    case "user_inactive":
      return {
        title: "Учётная запись отключена",
        description: "Обратитесь к администратору рабочей области."
      };
    case "auth_not_configured":
      return {
        title: "Вход не настроен",
        description: "Сервер авторизации недоступен для этой рабочей области."
      };
    case "validation_error":
    case "invalid_json_body":
    case "body_too_large":
      return {
        title: "Проверьте поля входа",
        description: "Введите корпоративный email и пароль."
      };
    case "invalid_credentials":
    default:
      return {
        title: "Неверный email или пароль",
        description: "Проверьте данные или восстановите доступ через администратора."
      };
  }
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-canvas login-screen">
      <div className="app-canvas__panel app-canvas__panel--bare">
        <main className="login-screen__main">{children}</main>
      </div>
    </div>
  );
}

function LoginBrand() {
  return (
    <div className="login-card__brand">
      <span className="login-card__brand-mark" aria-hidden>
        К
      </span>
      <div className="login-card__brand-text">
        <span className="login-card__brand-title">KISS PM</span>
        <span className="login-card__brand-meta">Вход в рабочее пространство</span>
      </div>
    </div>
  );
}

function LoginFootnote() {
  return (
    <p className="login-screen__footnote">
      Нет доступа?{" "}
      <span className="login-screen__footnote-em">Напишите администратору рабочей области.</span>
    </p>
  );
}

export function LoginScreenView({
  variant = "default",
  defaultEmail = DEFAULT_EMAIL,
  submitting = false,
  error = null,
  onSubmit
}: LoginScreenViewProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const hasError = variant === "error" || Boolean(error);

  if (variant === "forbidden") {
    return (
      <LoginShell>
        <div className="login-card">
          <LoginBrand />
          <div className="login-card__head">
            <h1 className="login-card__title">Вход недоступен</h1>
            <p className="login-card__lead">
              Учётная запись отключена или рабочая область заблокирована. Обратитесь к администратору.
            </p>
          </div>
        </div>
        <LoginFootnote />
      </LoginShell>
    );
  }

  if (variant === "loading" && !onSubmit) {
    return (
      <LoginShell>
        <div className="login-card login-card--loading" aria-busy="true" aria-live="polite">
          <LoginBrand />
          <div className="login-card__pending">
            <Loader2 className="login-card__spinner" aria-hidden />
            <p className="login-card__pending-label">Проверяем учётные данные…</p>
          </div>
        </div>
        <LoginFootnote />
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <form
        className="login-card"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!onSubmit) return;
          const formData = new FormData(event.currentTarget);
          const formEmail = String(formData.get("email") ?? email);
          const formPassword = String(formData.get("password") ?? password);
          void onSubmit({ email: formEmail, password: formPassword });
        }}
      >
        <LoginBrand />
        <div className="login-card__head">
          <h1 className="login-card__title">Войти</h1>
          <p className="login-card__lead">Корпоративный email и пароль арендатора.</p>
        </div>
        {hasError ? (
          <BannerInline variant="danger" className="login-card__banner">
            <div className="login-card__banner-body">
              <AlertCircle className="login-card__banner-icon" aria-hidden />
              <div className="login-card__banner-copy">
                <p className="login-card__banner-title">{loginErrorCopy(error).title}</p>
                <p className="login-card__banner-desc">{loginErrorCopy(error).description}</p>
              </div>
            </div>
          </BannerInline>
        ) : null}
        <div className="login-card__form">
          <Field label="Эл. почта" required htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              autoComplete="email"
              disabled={submitting}
              required
            />
          </Field>
          <Field label="Пароль" required htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </Field>
        </div>
        <div className="login-card__foot">
          <Button variant="primary" type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Проверяем…" : "Войти"}
          </Button>
        </div>
      </form>
      <LoginFootnote />
    </LoginShell>
  );
}
