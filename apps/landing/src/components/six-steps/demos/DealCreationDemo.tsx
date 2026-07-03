import type { LandingLocale } from "../../../lib/landing-i18n";
import { DemoShell } from "./DemoShell";
import { DottedConnector } from "./DottedConnector";

const COPY = {
  ru: {
    title: "Новая сделка",
    cta: "Создать сделку",
    leadTitle: "Новый лид",
    badge: "Новый",
    leadClient: "ООО «Альфа»",
    leadSum: "1 250 000 ₽",
    fields: [
      { label: "Клиент", value: "ООО «Альфа»" },
      { label: "Контакт", value: "Анна Смирнова" },
      { label: "Сумма", value: "1 250 000 ₽", accent: true },
      { label: "Этап", value: "Первичный контакт", select: true },
      { label: "Ответственный", value: "Иван Петров", avatar: "ИП" },
    ],
  },
  en: {
    title: "New opportunity",
    cta: "Create opportunity",
    leadTitle: "New lead",
    badge: "New",
    leadClient: "Alpha LLC",
    leadSum: "$18,000",
    fields: [
      { label: "Client", value: "Alpha LLC" },
      { label: "Contact", value: "Anna Smirnova" },
      { label: "Value", value: "$18,000", accent: true },
      { label: "Stage", value: "First contact", select: true },
      { label: "Owner", value: "Ivan Petrov", avatar: "IP" },
    ],
  },
} as const;

export function DealCreationDemo({ active, locale = "ru" }: { active: boolean; locale?: LandingLocale }) {
  const copy = COPY[locale];
  return (
    <DemoShell active={active}>
      <div className="six-deal">
        <div className="six-deal__form">
          <h4 className="six-deal__form-title">{copy.title}</h4>
          {copy.fields.map((field, i) => (
            <div key={field.label} className={`six-deal__field six-deal__field--${i + 1}`}>
              <span className="six-deal__field-label">{field.label}</span>
              <span
                className={`six-deal__field-value${"accent" in field && field.accent ? " six-deal__field-value--accent" : ""}${"select" in field && field.select ? " six-deal__field-value--select" : ""}`}
              >
                {"avatar" in field && field.avatar ? (
                  <>
                    <span className="six-deal__avatar">{field.avatar}</span>
                    {field.value}
                  </>
                ) : (
                  field.value
                )}
              </span>
            </div>
          ))}
          <button type="button" className="six-deal__cta" tabIndex={-1}>
            {copy.cta}
          </button>
        </div>
        <DottedConnector className="six-deal__arrow" variant="horizontal-long" />
        <article className="six-deal__lead">
          <span className="six-deal__lead-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <div className="six-deal__lead-body">
            <div className="six-deal__lead-head">
              <span className="six-deal__lead-title">{copy.leadTitle}</span>
              <span className="six-deal__badge">{copy.badge}</span>
            </div>
            <p className="six-deal__lead-client">{copy.leadClient}</p>
            <p className="six-deal__lead-sum">{copy.leadSum}</p>
          </div>
        </article>
      </div>
    </DemoShell>
  );
}