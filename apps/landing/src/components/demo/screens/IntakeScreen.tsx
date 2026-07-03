import type { LandingLocale } from "../../../lib/landing-i18n";
import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  intake: DemoFixture["intake"];
  locale?: LandingLocale;
  onAdvance: () => void;
}

const COPY = {
  ru: {
    title: "Проверка ресурсной ёмкости",
    meta: "Сделка «ГК Север» · ₽ 8.4 млн",
    status: "Перегруз 112%",
    sync: "расчёт 11:48",
    cta: "К затронутым проектам →",
    metricLabel: "загрузка ведущего инженера · нед. 7–9",
    loadTitle: "Загрузка по ролям",
    dealParams: "Параметры сделки",
    template: "Шаблон",
    affectedTitle: "Затронутые проекты",
    threshold: "Безопасная граница",
    thresholdLabel: "порог 95%",
    rows: [
      { role: "Ведущий инж.", pct: 112, hot: true },
      { role: "Аналитик", pct: 78 },
      { role: "QA", pct: 64 },
    ],
    affected: ["ГК Север · новая сделка", "Портал Pixel Bank", "Интеграция Logistica+", "Внутренний релиз Q3"],
  },
  en: {
    title: "Resource capacity check",
    meta: "Northstar opportunity · $120k",
    status: "Overload 112%",
    sync: "calculated 11:48",
    cta: "To affected projects →",
    metricLabel: "lead engineer load · weeks 7-9",
    loadTitle: "Load by role",
    dealParams: "Opportunity parameters",
    template: "Template",
    affectedTitle: "Affected projects",
    threshold: "Safe boundary",
    thresholdLabel: "threshold 95%",
    rows: [
      { role: "Lead eng.", pct: 112, hot: true },
      { role: "Analyst", pct: 78 },
      { role: "QA", pct: 64 },
    ],
    affected: ["Northstar · new opportunity", "Pixel Bank portal", "Logistica+ integration", "Internal Q3 release"],
  },
} as const;

export function IntakeScreen({ intake, locale = "ru", onAdvance }: Props) {
  const copy = COPY[locale];
  return (
    <DemoScreenFrame title={copy.title} meta={copy.meta} status={copy.status} statusTone="warning" syncNote={copy.sync} toolbar={<Cta label={copy.cta} emphasis onClick={onAdvance} />} className="demo-screen--intake">
      <div className="demo-intake">
        <div className="demo-intake__hero">
          <div className="demo-intake__metric">
            <span className="demo-intake__metric-value">{intake.feasibility.capacity}</span>
            <span className="demo-intake__metric-label">{copy.metricLabel}</span>
          </div>
          <ul className="demo-intake__notes">
            <li>{intake.feasibility.ramp}</li>
            <li className="demo-intake__notes--warn">{intake.feasibility.risk}</li>
          </ul>
        </div>

        <div className="demo-intake__grid">
          <section className="demo-panel">
            <h3 className="demo-panel__title">{copy.loadTitle}</h3>
            <ul className="demo-capacity-bars">
              {copy.rows.map((row) => (
                <li key={row.role} className="demo-capacity-bars__row">
                  <span>{row.role}</span>
                  <div className="demo-capacity-bars__track">
                    <span className={`demo-capacity-bars__fill${row.pct > 100 ? " demo-capacity-bars__fill--hot" : ""}`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                  <span className={row.pct > 100 ? "demo-capacity-bars__pct--hot" : ""}>{row.pct}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="demo-panel">
            <h3 className="demo-panel__title">{copy.dealParams}</h3>
            <dl className="demo-kv demo-kv--compact">
              {intake.fields.map((f) => (
                <div key={f.label} className="demo-kv__row">
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
              <div className="demo-kv__row">
                <dt>{copy.template}</dt>
                <dd>{intake.template}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="demo-panel">
          <h3 className="demo-panel__title">{copy.affectedTitle}</h3>
          <div className="demo-tag-list">
            {copy.affected.map((name) => <span key={name} className="demo-tag">{name}</span>)}
          </div>
        </section>

        <div className="demo-intake__threshold">
          <span>{copy.threshold}</span>
          <div className="demo-intake__threshold-track" role="progressbar" aria-valuenow={112} aria-valuemin={0} aria-valuemax={120}>
            <span className="demo-intake__threshold-safe" style={{ width: "79%" }} />
            <span className="demo-intake__threshold-over" style={{ left: "79%", width: "14%" }} />
          </div>
          <span className="demo-intake__threshold-label">{copy.thresholdLabel}</span>
        </div>
      </div>
    </DemoScreenFrame>
  );
}