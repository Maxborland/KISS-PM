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
import type { LandingLocale } from "../lib/landing-i18n";

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

type SizeKey = keyof typeof COMPANY_SIZE_LABELS;

const SIZE_LABELS: Record<LandingLocale, Record<SizeKey, string>> = {
  ru: COMPANY_SIZE_LABELS,
  en: {
    solo: "Up to 10 projects",
    small: "10-30 projects",
    mid: "30-50 projects",
    large: "50-100 projects",
    enterprise: "100+ projects",
    other: "Other",
  },
};

const FORM_COPY = {
  ru: {
    intro: (
      <>
        Оставьте рабочую почту, если хотите посмотреть agent-first управление проектами как код.
        <br />
        Ответим письмом, без звонков и рассылок.
      </>
    ),
    successTitle: "Заявка принята",
    successCopy: "Мы свяжемся с вами по email, когда откроем следующий набор в закрытую альфу. Обычно это 3–7 рабочих дней.",
    again: "Отправить ещё одну заявку",
    validationMessage: "Проверьте поля формы и попробуйте снова.",
    networkError: "Не удалось отправить. Проверьте интернет и попробуйте снова.",
    fields: {
      fullName: { label: "Имя и фамилия", placeholder: "Анна Каренина" },
      email: { label: "Рабочий email", placeholder: "anna@company.ru" },
      role: { label: "Роль или должность", placeholder: "PMO Lead, Head of Delivery" },
      company: { label: "Компания", placeholder: "Север Девелопмент" },
      size: {
        label: "Активных проектов одновременно",
        hint: "Помогает подобрать формат альфы под масштаб портфеля.",
        empty: "Выберите диапазон",
      },
      context: {
        label: "Контекст",
        optional: "опционально",
        placeholder: "Что хотите проверить: агент, сверка изменений, ресурсы, сроки, CRM или аудит.",
      },
    },
    consent: (
      <>
        Я согласен(а) с <a href="/privacy">политикой конфиденциальности</a> и{" "}
        <a href="/terms">условиями закрытой альфы</a>.
      </>
    ),
    honeypot: "Не заполняйте",
    submitting: "Отправляем…",
    submit: "Запросить доступ",
    footnote: "Ручная модерация · без рассылок · ответ на указанный email",
    errors: {
      requiredEmail: "Укажите рабочий email",
      typoEmail: "Похоже, в адресе опечатка",
      workEmail: WORK_EMAIL_ERROR,
      tooMany: "Слишком много попыток. Подождите минуту и попробуйте снова.",
      origin: "Отправка с этого источника запрещена.",
      later: "Не удалось отправить. Попробуйте позже.",
    },
  },
  en: {
    intro: (
      <>
        Leave a work email if you want to see agent-first project management as code.
        <br />
        We will reply by email, no calls or newsletters.
      </>
    ),
    successTitle: "Request received",
    successCopy: "We will email you when the next closed alpha batch opens. Usually within 3-7 business days.",
    again: "Send another request",
    validationMessage: "Check the form fields and try again.",
    networkError: "Could not send the request. Check your connection and try again.",
    fields: {
      fullName: { label: "Full name", placeholder: "Anna Karenina" },
      email: { label: "Work email", placeholder: "anna@company.com" },
      role: { label: "Role or title", placeholder: "PMO Lead, Head of Delivery" },
      company: { label: "Company", placeholder: "Northstar Digital" },
      size: {
        label: "Active projects at once",
        hint: "Helps us match the alpha format to your portfolio scale.",
        empty: "Choose a range",
      },
      context: {
        label: "Context",
        optional: "optional",
        placeholder: "What do you want to test: agent, project diff, resources, dates, CRM or audit?",
      },
    },
    consent: (
      <>
        I agree to the <a href="/en/privacy/">privacy policy</a> and{" "}
        <a href="/en/terms/">closed alpha terms</a>.
      </>
    ),
    honeypot: "Do not fill this in",
    submitting: "Sending…",
    submit: "Request access",
    footnote: "Manual review · no newsletters · reply to the email above",
    errors: {
      requiredEmail: "Enter your work email",
      typoEmail: "This email looks misspelled",
      workEmail: "Use a company email, not a personal Gmail, Mail.ru, Yandex, etc.",
      tooMany: "Too many attempts. Wait a minute and try again.",
      origin: "Requests from this origin are not allowed.",
      later: "Could not send the request. Try again later.",
    },
  },
} as const;

/* Node-SSR обслуживает /api/waitlist; статический деплой на PHP-хостинг
   собирается с PUBLIC_WAITLIST_ENDPOINT=/api/waitlist.php */
const WAITLIST_ENDPOINT: string =
  import.meta.env.PUBLIC_WAITLIST_ENDPOINT || "/api/waitlist";

export default function WaitlistForm({ locale = "ru" }: { locale?: LandingLocale }) {
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [fieldIssues, setFieldIssues] = useState<FieldIssues>({});
  const copy = FORM_COPY[locale];
  const sizeEntries = Object.entries(SIZE_LABELS[locale]) as Array<[SizeKey, string]>;

  async function onSubmit(e: FormSubmitEvent): Promise<void> {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = waitlistPayloadFromFormData(new FormData(form));
    const parsed = WaitlistSubmission.safeParse(payload);

    if (!parsed.success) {
      const issues = translateIssues(formatWaitlistIssues(parsed.error.issues), locale);
      const next: FieldIssues = {};
      for (const [key, messages] of Object.entries(issues)) {
        next[key] = messages?.[0];
      }
      setFieldIssues(next);
      setStatus({
        phase: "error",
        message: copy.validationMessage,
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
      const message = errorMessage(json?.error, res.status, locale);
      setStatus({ phase: "error", message, issues: json?.issues ? translateIssues(json.issues, locale) : undefined });
    } catch {
      setStatus({
        phase: "error",
        message: copy.networkError,
      });
    }
  }

  function onEmailBlur(value: string): void {
    const message = validateWorkEmailInput(value, locale);
    setFieldIssues((prev) => ({ ...prev, email: message }));
  }

  if (status.phase === "success") {
    return (
      <div className="wl wl--success" role="status">
        <span className="wl__success-mark" aria-hidden="true" />
        <h3 className="wl__success-title">{copy.successTitle}</h3>
        <p className="wl__success-copy">{copy.successCopy}</p>
        <button
          type="button"
          className="wl__again"
          onClick={() => {
            setStatus({ phase: "idle" });
            setFieldIssues({});
          }}
        >
          {copy.again}
        </button>
      </div>
    );
  }

  const submitting = status.phase === "submitting";

  return (
    <form className="wl" onSubmit={onSubmit} noValidate>
      <p className="wl__intro">{copy.intro}</p>

      <div className="wl__row">
        <Field
          id="wl-fullName"
          label={copy.fields.fullName.label}
          name="fullName"
          required
          autoComplete="name"
          placeholder={copy.fields.fullName.placeholder}
          error={resolveError("fullName", fieldIssues, status)}
        />
        <Field
          id="wl-email"
          label={copy.fields.email.label}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={copy.fields.email.placeholder}
          error={resolveError("email", fieldIssues, status)}
          onBlur={(e) => onEmailBlur(e.currentTarget.value)}
        />
      </div>

      <div className="wl__row">
        <Field
          id="wl-role"
          label={copy.fields.role.label}
          name="role"
          required
          autoComplete="organization-title"
          placeholder={copy.fields.role.placeholder}
          error={resolveError("role", fieldIssues, status)}
        />
        <Field
          id="wl-company"
          label={copy.fields.company.label}
          name="company"
          required
          autoComplete="organization"
          placeholder={copy.fields.company.placeholder}
          error={resolveError("company", fieldIssues, status)}
        />
      </div>

      <div className="wl__field wl__field--full">
        <label htmlFor="wl-size">
          {copy.fields.size.label}
          <span className="wl__req" aria-hidden="true">
            *
          </span>
        </label>
        <p className="wl__hint" id="wl-size-hint">
          {copy.fields.size.hint}
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
              {copy.fields.size.empty}
            </option>
            {sizeEntries.map(([value, label]) => (
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
          {copy.fields.context.label}
          <span className="wl__optional">{copy.fields.context.optional}</span>
        </label>
        <textarea
          id="wl-context"
          name="context"
          rows={3}
          placeholder={copy.fields.context.placeholder}
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
          <span>{copy.consent}</span>
        </label>
        {resolveError("consent", fieldIssues, status) && (
          <p className="wl__error">{resolveError("consent", fieldIssues, status)}</p>
        )}

        <div className="wl__hp" aria-hidden="true">
          <label htmlFor="wl-hp">{copy.honeypot}</label>
          <input id="wl-hp" name="hp" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {status.phase === "error" && status.message && (
          <p className="wl__form-error" role="alert">
            {status.message}
          </p>
        )}

        <button type="submit" className="wl__submit" disabled={submitting}>
          <span className="wl__submit-label">
            {submitting ? copy.submitting : copy.submit}
          </span>
        </button>

        <p className="wl__footnote">{copy.footnote}</p>
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

function validateWorkEmailInput(raw: string, locale: LandingLocale): string | undefined {
  const copy = FORM_COPY[locale].errors;
  const value = sanitizeText(raw).toLowerCase();
  if (!value) return copy.requiredEmail;
  if (!z.string().email().safeParse(value).success) {
    return copy.typoEmail;
  }
  if (isConsumerEmailDomain(value)) return copy.workEmail;
  return undefined;
}

function errorMessage(code: string | undefined, httpStatus: number, locale: LandingLocale): string {
  const copy = FORM_COPY[locale].errors;
  if (httpStatus === 429) return copy.tooMany;
  if (code === "validation_error") return FORM_COPY[locale].validationMessage;
  if (code === "origin_not_allowed") return copy.origin;
  return copy.later;
}

function translateIssues(
  issues: Record<string, string[] | undefined>,
  locale: LandingLocale,
): Record<string, string[] | undefined> {
  if (locale === "ru") return issues;
  return Object.fromEntries(
    Object.entries(issues).map(([key, messages]) => [
      key,
      messages?.map((message) => translateIssue(message)),
    ]),
  );
}

function translateIssue(message: string): string {
  if (message.includes("Укажите имя")) return "Enter your full name";
  if (message.includes("Укажите рабочий email")) return "Enter your work email";
  if (message.includes("Похоже")) return "This email looks misspelled";
  if (message.includes("Укажите компанию")) return "Enter your company";
  if (message.includes("Укажите роль")) return "Enter your role or title";
  if (message.includes("Выберите диапазон")) return "Choose a project range";
  if (message.includes("Нужно согласие")) return "Consent is required";
  if (message.includes("Слишком длинно")) return "Too long";
  if (message === WORK_EMAIL_ERROR) return FORM_COPY.en.errors.workEmail;
  return message;
}