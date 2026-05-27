import { useState } from "react";
import type * as React from "react";
import { COMPANY_SIZE_LABELS } from "../lib/waitlist/schema";

type Status =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success" }
  | { phase: "error"; message: string; issues?: Record<string, string[] | undefined> };

const SIZE_ENTRIES = Object.entries(COMPANY_SIZE_LABELS) as Array<
  [keyof typeof COMPANY_SIZE_LABELS, string]
>;

export default function WaitlistForm() {
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setStatus({ phase: "submitting" });

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        body: data,
        headers: { accept: "application/json" },
      });
      if (res.ok) {
        setStatus({ phase: "success" });
        form.reset();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        issues?: Record<string, string[]>;
      } | null;
      const message = errorMessage(body?.error, res.status);
      setStatus({ phase: "error", message, issues: body?.issues });
    } catch {
      setStatus({
        phase: "error",
        message: "Не удалось отправить. Проверьте интернет и попробуйте снова.",
      });
    }
  }

  if (status.phase === "success") {
    return (
      <div className="wl wl--success" role="status">
        <h3>Спасибо</h3>
        <p>
          Мы получили заявку и свяжемся с вами, когда будем готовы к следующему
          набору.
        </p>
        <button
          type="button"
          className="wl__again"
          onClick={() => setStatus({ phase: "idle" })}
        >
          Отправить ещё одну заявку
        </button>

        <style>{styles}</style>
      </div>
    );
  }

  const submitting = status.phase === "submitting";

  return (
    <form className="wl" onSubmit={onSubmit} noValidate>
      <Field
        id="wl-fullName"
        label="Имя и фамилия"
        name="fullName"
        required
        autoComplete="name"
        placeholder="Анна Каренина"
        error={fieldError(status, "fullName")}
      />

      <Field
        id="wl-email"
        label="Рабочий email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="anna@company.ru"
        error={fieldError(status, "email")}
      />

      <Field
        id="wl-role"
        label="Роль или должность"
        name="role"
        required
        autoComplete="organization-title"
        placeholder="PMO Lead, Head of Delivery, ...
"
        error={fieldError(status, "role")}
      />

      <Field
        id="wl-company"
        label="Компания"
        name="company"
        required
        autoComplete="organization"
        placeholder="Север Девелопмент"
        error={fieldError(status, "company")}
      />

      <div className="wl__field">
        <label htmlFor="wl-size">Активных проектов одновременно</label>
        <select
          id="wl-size"
          name="companySize"
          required
          defaultValue=""
          aria-invalid={Boolean(fieldError(status, "companySize"))}
        >
          <option value="" disabled>
            Выберите диапазон
          </option>
          {SIZE_ENTRIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {fieldError(status, "companySize") && (
          <p className="wl__error">{fieldError(status, "companySize")}</p>
        )}
      </div>

      <div className="wl__field wl__field--full">
        <label htmlFor="wl-context">
          Контекст <span className="wl__optional">(опционально)</span>
        </label>
        <textarea
          id="wl-context"
          name="context"
          rows={3}
          placeholder="Коротко: где сейчас возникает давление — ресурсы, сроки, новые сделки, отчёты или решения."
          maxLength={600}
        />
      </div>

      <p className="wl__helper">
        Нам важно понять масштаб портфеля и вашу роль, чтобы предложить
        релевантный формат альфы.
      </p>

      <label className="wl__consent">
        <input type="checkbox" name="consent" required />
        <span>
          Я согласен(а) с{" "}
          <a href="/privacy">политикой конфиденциальности</a> и{" "}
          <a href="/terms">условиями закрытой альфы</a>.
        </span>
      </label>

      {/* Honeypot — должен оставаться пустым у людей. */}
      <div className="wl__hp" aria-hidden="true">
        <label htmlFor="wl-hp">Не заполняйте</label>
        <input id="wl-hp" name="hp" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status.phase === "error" && (
        <p className="wl__form-error" role="alert">
          {status.message}
        </p>
      )}

      <div className="wl__actions">
        <button type="submit" className="wl__submit" disabled={submitting}>
          {submitting ? "Отправляем…" : "Запросить доступ"}
        </button>
      </div>

      <style>{styles}</style>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
}

function Field({
  id,
  label,
  name,
  type = "text",
  required,
  autoComplete,
  placeholder,
  error,
}: FieldProps) {
  return (
    <div className="wl__field">
      <label htmlFor={id}>
        {label}
        {required && <span className="wl__req" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      {error && (
        <p className="wl__error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

function fieldError(status: Status, name: string): string | undefined {
  if (status.phase !== "error" || !status.issues) return undefined;
  return status.issues[name]?.[0];
}

function errorMessage(code: string | undefined, httpStatus: number): string {
  if (httpStatus === 429) return "Слишком много попыток. Подождите минуту и попробуйте снова.";
  if (code === "validation_error") return "Проверьте поля формы и попробуйте снова.";
  if (code === "origin_not_allowed") return "Отправка с этого источника запрещена.";
  return "Не удалось отправить. Попробуйте позже.";
}

const styles = `
.wl {
  display: grid;
  gap: 14px;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .wl { grid-template-columns: 1fr 1fr; }
  .wl__field--full,
  .wl__helper,
  .wl__consent,
  .wl__actions,
  .wl__form-error { grid-column: 1 / -1; }
}

.wl__field { display: grid; gap: 6px; }
.wl__field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong);
}
.wl__optional {
  color: var(--muted);
  font-weight: 400;
  margin-left: 4px;
}
.wl__req { color: var(--danger); margin-left: 4px; }

.wl input[type="text"],
.wl input[type="email"],
.wl select,
.wl textarea {
  width: 100%;
  font: inherit;
  font-size: 14px;
  color: var(--text-strong);
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  transition:
    border-color var(--duration-ui) var(--ease-ui),
    box-shadow var(--duration-ui) var(--ease-ui);
}
.wl textarea { resize: vertical; min-height: 80px; }

.wl input:focus-visible,
.wl select:focus-visible,
.wl textarea:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--ring-focus);
}

.wl input[aria-invalid="true"],
.wl select[aria-invalid="true"] {
  border-color: var(--danger);
}

.wl__error {
  font-size: 12px;
  color: var(--danger-text, #b91c1c);
}

.wl__helper {
  margin: 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.55;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--panel-strong) 90%, var(--plasma-violet) 10%);
  border: 1px solid color-mix(in oklab, var(--border) 65%, var(--plasma-violet) 35%);
}

.wl__consent {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  font-size: 13px;
  color: var(--muted-strong);
  line-height: 1.5;
}
.wl__consent input { accent-color: var(--accent); margin-top: 3px; }

.wl__hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

.wl__form-error {
  background: var(--danger-soft);
  color: #991b1b;
  border: 1px solid #fecaca;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.wl__actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.wl__submit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding-inline: 22px;
  border-radius: var(--radius-full);
  background: var(--text-strong);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: 0;
  transition:
    background var(--duration-ui) var(--ease-ui),
    transform var(--duration-ui) var(--ease-ui);
}
.wl__submit:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); }
.wl__submit:disabled {
  background: var(--muted-soft);
  color: var(--panel);
  cursor: progress;
}

.wl__note {
  font-size: 12px;
  color: var(--muted);
  max-width: 360px;
}

.wl--success {
  background: var(--success-soft);
  border: 1px solid #a7f3d0;
  padding: 24px;
  border-radius: var(--radius-xl);
  color: #065f46;
  display: grid;
  gap: 10px;
}
.wl--success h3 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: #064e3b;
}
.wl--success p { font-size: 14px; line-height: 1.6; }
.wl__again {
  margin-top: 6px;
  font-size: 13px;
  color: #065f46;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #a7f3d0;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  cursor: pointer;
  width: fit-content;
}
.wl__again:hover { background: #fff; }
`;
