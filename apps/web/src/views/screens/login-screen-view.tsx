import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Field } from "@/components/domain/form-layout";

export type LoginScreenVariant = "default" | "loading" | "error" | "forbidden";

export type LoginScreenViewProps = {
  variant?: LoginScreenVariant;
};

export function LoginScreenView({ variant = "default" }: LoginScreenViewProps) {
  const disabled = variant === "loading";

  if (variant === "forbidden") {
    return (
      <div className="app-canvas login-screen">
        <div className="app-canvas__panel app-canvas__panel--bare">
          <main className="login-screen__main login-screen__main--state">
            <ForbiddenState
              level="L3"
              title="Вход недоступен"
              description="Учётная запись отключена или рабочая область заблокирована. Обратитесь к администратору."
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-canvas login-screen">
      <div className="app-canvas__panel app-canvas__panel--bare">
        <main className="login-screen__main">
          {variant === "loading" ? (
            <div className="login-screen__loading" aria-live="polite">
              <LoadingState label="Проверяем учётные данные…" />
            </div>
          ) : null}
          <form
            className="login-card"
            noValidate
            onSubmit={(e) => e.preventDefault()}
            aria-busy={disabled}
          >
            <div className="login-card__brand">
              <span className="login-card__brand-mark" aria-hidden>
                К
              </span>
              <div className="login-card__brand-text">
                <span className="login-card__brand-title">KISS PM</span>
                <span className="login-card__brand-meta">Вход в рабочее пространство</span>
              </div>
            </div>
            <h1 className="login-card__title">Войти</h1>
            <p className="login-card__lead">Корпоративный email и пароль арендатора.</p>
            {variant === "error" ? (
              <div className="login-card__alert">
                <ErrorState
                  level="L2"
                  title="Неверный email или пароль"
                  description="Проверьте данные или восстановите доступ через администратора."
                />
              </div>
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
                  disabled={disabled}
                />
              </Field>
              <Field label="Пароль" required htmlFor="login-password">
                <Input
                  id="login-password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  disabled={disabled}
                />
              </Field>
            </div>
            <div className="login-card__foot">
              <Button variant="primary" type="submit" className="w-full" disabled={disabled}>
                {disabled ? "Вход…" : "Войти"}
              </Button>
            </div>
          </form>
          <p className="login-screen__footnote">
            Нет доступа? Напишите администратору рабочей области.
          </p>
        </main>
      </div>
    </div>
  );
}
