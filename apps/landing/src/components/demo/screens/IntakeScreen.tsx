import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  intake: DemoFixture["intake"];
  onAdvance: () => void;
}

const CAPACITY_ROWS = [
  { role: "Ведущий инж.", pct: 112, hot: true },
  { role: "Аналитик", pct: 78 },
  { role: "QA", pct: 64 },
] as const;

const AFFECTED = [
  "ГК Север · новая сделка",
  "Портал Pixel Bank",
  "Интеграция Logistica+",
  "Внутренний релиз Q3",
] as const;

export function IntakeScreen({ intake, onAdvance }: Props) {
  return (
    <DemoScreenFrame
      title="Проверка ресурсной ёмкости"
      meta="Сделка «ГК Север» · ₽ 8.4 млн"
      status="Перегруз 112%"
      statusTone="warning"
      syncNote="расчёт 11:48"
      toolbar={<Cta label="К затронутым проектам →" emphasis onClick={onAdvance} />}
      className="demo-screen--intake"
    >
      <div className="demo-intake">
        <div className="demo-intake__hero">
          <div className="demo-intake__metric">
            <span className="demo-intake__metric-value">{intake.feasibility.capacity}</span>
            <span className="demo-intake__metric-label">загрузка ведущего инженера · нед. 7–9</span>
          </div>
          <ul className="demo-intake__notes">
            <li>{intake.feasibility.ramp}</li>
            <li className="demo-intake__notes--warn">{intake.feasibility.risk}</li>
          </ul>
        </div>

        <div className="demo-intake__grid">
          <section className="demo-panel">
            <h3 className="demo-panel__title">Загрузка по ролям</h3>
            <ul className="demo-capacity-bars">
              {CAPACITY_ROWS.map((row) => (
                <li key={row.role} className="demo-capacity-bars__row">
                  <span>{row.role}</span>
                  <div className="demo-capacity-bars__track">
                    <span
                      className={`demo-capacity-bars__fill${row.pct > 100 ? " demo-capacity-bars__fill--hot" : ""}`}
                      style={{ width: `${Math.min(row.pct, 100)}%` }}
                    />
                  </div>
                  <span className={row.pct > 100 ? "demo-capacity-bars__pct--hot" : ""}>{row.pct}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="demo-panel">
            <h3 className="demo-panel__title">Параметры сделки</h3>
            <dl className="demo-kv demo-kv--compact">
              {intake.fields.map((f) => (
                <div key={f.label} className="demo-kv__row">
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
              <div className="demo-kv__row">
                <dt>Шаблон</dt>
                <dd>{intake.template}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="demo-panel">
          <h3 className="demo-panel__title">Затронутые проекты</h3>
          <div className="demo-tag-list">
            {AFFECTED.map((name) => (
              <span key={name} className="demo-tag">
                {name}
              </span>
            ))}
          </div>
        </section>

        <div className="demo-intake__threshold">
          <span>Безопасная граница</span>
          <div className="demo-intake__threshold-track" role="progressbar" aria-valuenow={112} aria-valuemin={0} aria-valuemax={120}>
            <span className="demo-intake__threshold-safe" style={{ width: "79%" }} />
            <span className="demo-intake__threshold-over" style={{ left: "79%", width: "14%" }} />
          </div>
          <span className="demo-intake__threshold-label">порог 95%</span>
        </div>
      </div>
    </DemoScreenFrame>
  );
}
