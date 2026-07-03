import { useState } from "react";
import type { ComponentProps, FocusEvent } from "react";
import { z } from "zod";
import {
  COMPANY_SIZE_LABELS,
  formatWaitlistIssues,
  WaitlistSubmission,
  waitlistPayloadFromFormData,
} from "../lib/waitlist/schema";
import { sanitizeText } from "../lib/waitlist/sanitize";
import { isConsumerEmailDomain, WORK_EMAIL_ERROR } from "../lib/waitlist/work-email";

type Status =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success" }
  | {
      phase: "error";
      message: string;
      issues?: Record<string, string[] | undefined>;
    };

type FieldIssues = Record<string, string | undefined>;
type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<"form">["onSubmit"]>
>[0];

const SIZE_ENTRIES = Object.entries(COMPANY_SIZE_LABELS) as Array<
  [keyof typeof COMPANY_SIZE_LABELS, string]
>;

/* Node-SSR обслуживает /api/waitlist; статический деплой на PHP-хостинг
   собирается с PUBLIC_WAITLIST_ENDPOINT=/api/waitlist.php */
const WAITLIST_ENDPOINT: string =
  import.meta.env.PUBLIC_WAITLIST_ENDPOINT || "/api/waitlist";

export default function WaitlistForm() {
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [fieldIssues, setFieldIssues] = useState<FieldIssues>({});

  async function onSubmit(e: FormSubmitEvent): Promise<void> {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = waitlistPayloadFromFormData(new FormData(form));
    const parsed = WaitlistSubmission.safeParse(payload);

    if (!parsed.success) {
      const issues = formatWaitlistIssues(parsed.error.issues);
      const next: FieldIssues = {};
      for (const [key, messages] of Object.entries(issues)) {
        next[key] = messages[0];
      }
      setFieldIssues(next);
      setStatus({
        phase: "error",
        message: "Проверьте поля формы и попробуйте снова.",
        issues,
      });
      return;
    }

    setFieldIssues({});
    setStatus({ phase: "submitting" });

    const body = new FormData();
    body.set("fullName", parsed.data.fullName);
    body.set("email", parsed.data.email);
    body.set("company", parsed.data.company);
    body.set("role", parsed.data.role);
    body.set("companySize", parsed.data.companySize);
    if (parsed.data.context) body.set("context", parsed.data.context);
    body.set("consent", "on");
    body.set("hp", "");

    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: "POST",
        body,
        headers: { accept: "application/json" },
      });
      if (res.ok) {
        setStatus({ phase: "success" });
        form.reset();
        return;
      }
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        issues?: Record<string, string[]>;
      } | null;
      const message = errorMessage(json?.error, res.status);
      setStatus({ phase: "error", message, issues: json?.issues });
    } catch {
      setStatus({
        phase: "error",
        message: "Не удалось отправить. Проверьте интернет и попробуйте снова.",
      });
    }
  }

  function onEmailBlur(value: string): void {
    const message = validateWorkEmailInput(value);
    setFieldIssues((prev) => ({ ...prev, email: message }));
  }

  if (status.phase === "success") {
    return (
      <div className="wl wl--success" role="status">
        <span className="wl__success-mark" aria-hidden="true" />
        <h3 className="wl__success-title">Заявка принята</h3>
        <p className="wl__success-copy">
          Мы свяжемся с вами по email, когда откроем следующий набор в закрытую
          альфу. Обычно это 3–7 рабочих дней.
        </p>
        <button
          type="button"
          className="wl__again"
          onClick={() => {
            setStatus({ phase: "idle" });
            setFieldIssues({});
          }}
        >
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  const submitting = status.phase === "submitting";

  return (
    <form className="wl" onSubmit={onSubmit} noValidate>
      <p className="wl__intro">
        Оставьте рабочую почту, если хотите посмотреть agent-first управление проектами как код.
        <br />
        Ответим письмом, без звонков и рассылок.
      </p>

      <div className="wl__row">
        <Field
          id="wl-fullName"
          label="Имя и фамилия"
          name="fullName"
          required
          autoComplete="name"
          placeholder="Анна Каренина"
          error={resolveError("fullName", fieldIssues, status)}
        />
        <Field
          id="wl-email"
          label="Рабочий email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="anna@company.ru"
          error={resolveError("email", fieldIssues, status)}
          onBlur={(e) => onEmailBlur(e.currentTarget.value)}
        />
      </div>

      <div className="wl__row">
        <Field
          id="wl-role"
          label="Роль или должность"
          name="role"
          required
          autoComplete="organization-title"
          placeholder="PMO Lead, Head of Delivery"
          error={resolveError("role", fieldIssues, status)}
        />
        <Field
          id="wl-company"
          label="Компания"
          name="company"
          required
          autoComplete="organization"
          placeholder="Север Девелопмент"
          error={resolveError("company", fieldIssues, status)}
        />
      </div>

      <div className="wl__field wl__field--full">
        <label htmlFor="wl-size">
          Активных проектов одновременно
          <span className="wl__req" aria-hidden="true">
            *
          </span>
        </label>
        <p className="wl__hint" id="wl-size-hint">
          Помогает подобрать формат альфы под масштаб портфеля.
        </p>
        <div className="wl__select-wrap">
          <select
            id="wl-size"
            name="companySize"
            required
            defaultValue=""
            aria-invalid={Boolean(resolveError("companySize", fieldIssues, status))}
            aria-describedby="wl-size-hint"
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
        </div>
        {resolveError("companySize", fieldIssues, status) && (
          <p className="wl__error">{resolveError("companySize", fieldIssues, status)}</p>
        )}
      </div>

      <div className="wl__field wl__field--full">
        <label htmlFor="wl-context">
          Контекст
          <span className="wl__optional">опционально</span>
        </label>
        <textarea
          id="wl-context"
          name="context"
          rows={3}
          placeholder="Что хотите проверить: агент, сверка изменений, ресурсы, сроки, CRM или аудит."
          maxLength={600}
          aria-invalid={Boolean(resolveError("context", fieldIssues, status))}
        />
        {resolveError("context", fieldIssues, status) && (
          <p className="wl__error">{resolveError("context", fieldIssues, status)}</p>
        )}
      </div>

      <div className="wl__footer">
        <label className="wl__consent">
          <input type="checkbox" name="consent" required />
          <span>
            Я согласен(а) с{" "}
            <a href="/privacy">политикой конфиденциальности</a> и{" "}
            <a href="/terms">условиями закрытой альфы</a>.
          </span>
        </label>
        {resolveError("consent", fieldIssues, status) && (
          <p className="wl__error">{resolveError("consent", fieldIssues, status)}</p>
        )}

        <div className="wl__hp" aria-hidden="true">
          <label htmlFor="wl-hp">Не заполняйте</label>
          <input id="wl-hp" name="hp" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {status.phase === "error" && status.message && (
          <p className="wl__form-error" role="alert">
            {status.message}
          </p>
        )}

        <button type="submit" className="wl__submit" disabled={submitting}>
          <span className="wl__submit-label">
            {submitting ? "Отправляем…" : "Запросить доступ"}
          </span>
        </button>

        <p className="wl__footnote">
          Ручная модерация · без рассылок · ответ на указанный email
        </p>
      </div>
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
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
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
  onBlur,
}: FieldProps) {
  return (
    <div className="wl__field">
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="wl__req" aria-hidden="true">
            *
          </span>
        )}
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
        onBlur={onBlur}
      />
      {error && (
        <p className="wl__error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

function resolveError(
  name: string,
  fieldIssues: FieldIssues,
  status: Status,
): string | undefined {
  if (fieldIssues[name]) return fieldIssues[name];
  if (status.phase === "error" && status.issues?.[name]?.[0]) {
    return status.issues[name]?.[0];
  }
  return undefined;
}

function validateWorkEmailInput(raw: string): string | undefined {
  const value = sanitizeText(raw).toLowerCase();
  if (!value) return "Укажите рабочий email";
  if (!z.string().email().safeParse(value).success) {
    return "Похоже, в адресе опечатка";
  }
  if (isConsumerEmailDomain(value)) return WORK_EMAIL_ERROR;
  return undefined;
}

function errorMessage(code: string | undefined, httpStatus: number): string {
  if (httpStatus === 429) {
    return "Слишком много попыток. Подождите минуту и попробуйте снова.";
  }
  if (code === "validation_error") return "Проверьте поля формы и попробуйте снова.";
  if (code === "origin_not_allowed") return "Отправка с этого источника запрещена.";
  return "Не удалось отправить. Попробуйте позже.";
}
