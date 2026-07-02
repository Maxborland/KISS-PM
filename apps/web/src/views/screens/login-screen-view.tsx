import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/domain/form-layout";

export function LoginScreenView() {
  return (
    <div className="app-canvas login-screen">
      <div className="app-canvas__panel app-canvas__panel--bare">
        <main className="login-screen__main">
          <form className="login-card" noValidate onSubmit={(e) => e.preventDefault()}>
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
            <p className="login-card__lead">Корпоративный email и пароль tenant.</p>
            <div className="login-card__form">
              <Field label="Email" required htmlFor="login-email">
                <Input
                  id="login-email"
                  type="email"
                  name="email"
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
          <p className="login-screen__footnote">SaaS · self-hosted · design-v3</p>
        </main>
      </div>
    </div>
  );
}
