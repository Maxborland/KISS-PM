import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/domain/form-layout";

export type LoginScreenVariant = "default" | "loading" | "error" | "forbidden";

export type LoginScreenViewProps = {
  variant?: LoginScreenVariant;
};

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

export function LoginScreenView({ variant = "default" }: LoginScreenViewProps) {
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

  if (variant === "loading") {
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
      <form className="login-card" noValidate onSubmit={(e) => e.preventDefault()}>
        <LoginBrand />
        <div className="login-card__head">
          <h1 className="login-card__title">Войти</h1>
          <p className="login-card__lead">Корпоративный email и пароль арендатора.</p>
        </div>
        {variant === "error" ? (
          <BannerInline variant="danger" className="login-card__banner">
            <div className="login-card__banner-body">
              <AlertCircle className="login-card__banner-icon" aria-hidden />
              <div className="login-card__banner-copy">
                <p className="login-card__banner-title">Неверный email или пароль</p>
                <p className="login-card__banner-desc">
                  Проверьте данные или восстановите доступ через администратора.
                </p>
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
              defaultValue="kamil.bayramov@demo.local"
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Пароль" required htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </Field>
        </div>
        <div className="login-card__foot">
          <Button variant="primary" type="submit" className="w-full">
            Войти
          </Button>
        </div>
      </form>
      <LoginFootnote />
    </LoginShell>
  );
}
