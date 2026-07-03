import { DemoShell } from "./DemoShell";
import { DottedConnector } from "./DottedConnector";

const FIELDS = [
  { label: "Клиент", value: "ООО «Альфа»" },
  { label: "Контакт", value: "Анна Смирнова" },
  { label: "Сумма", value: "1 250 000 ₽", accent: true },
  { label: "Этап", value: "Первичный контакт", select: true },
  { label: "Ответственный", value: "Иван Петров", avatar: "ИП" },
] as const;

export function DealCreationDemo({ active }: { active: boolean }) {
  return (
    <DemoShell active={active}>
      <div className="six-deal">
        <div className="six-deal__form">
          <h4 className="six-deal__form-title">Новая сделка</h4>
          {FIELDS.map((field, i) => (
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
            Создать сделку
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
              <span className="six-deal__lead-title">Новый лид</span>
              <span className="six-deal__badge">Новый</span>
            </div>
            <p className="six-deal__lead-client">ООО «Альфа»</p>
            <p className="six-deal__lead-sum">1 250 000 ₽</p>
          </div>
        </article>
      </div>
    </DemoShell>
  );
}
