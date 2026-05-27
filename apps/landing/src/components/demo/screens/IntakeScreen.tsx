import { Cta, ScreenShell } from "../ScreenShell";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  intake: DemoFixture["intake"];
  onAdvance: () => void;
}

export function IntakeScreen({ intake, onAdvance }: Props) {
  return (
    <ScreenShell
      title="Проверка ресурсной ёмкости"
      subtitle={`Шаблон: ${intake.template}`}
      toolbar={<Cta label="Открыть контекст →" onClick={onAdvance} />}
    >
      <div className="intake__grid">
        <div className="intake__card intake__card--feas">
          <span className="intake__eyebrow">Ресурсная ёмкость</span>
          <div className="intake__metric">
            <span className="intake__metric-value">{intake.feasibility.capacity}</span>
            <span className="intake__metric-label">загрузка роли</span>
          </div>
          <ul className="intake__notes">
            <li>{intake.feasibility.ramp}</li>
            <li className="intake__risk">{intake.feasibility.risk}</li>
          </ul>
        </div>

        <div className="intake__card">
          <span className="intake__eyebrow">Параметры проекта</span>
          <dl className="intake__fields">
            {intake.fields.map((f) => (
              <div key={f.label} className="intake__field">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="intake__bar">
          <span className="intake__bar-label">Безопасная граница</span>
          <div className="intake__bar-track" role="progressbar" aria-valuenow={95} aria-valuemin={0} aria-valuemax={120}>
            <div className="intake__bar-fill" style={{ width: "79%" }} />
        </div>
        <span className="intake__bar-value">95%</span>
      </div>

      <style>{`
        .intake__grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 600px) {
          .intake__grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .intake__card {
          background: var(--panel-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 16px;
          display: grid;
          gap: 10px;
        }
        .intake__card--feas {
          background: linear-gradient(135deg, var(--accent-soft) 0%, var(--panel-subtle) 100%);
          border-color: var(--accent-muted);
        }
        .intake__eyebrow {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted-strong);
          font-weight: 700;
        }
        .intake__metric {
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .intake__metric-value {
          font-family: var(--font-display);
          font-size: 36px;
          font-weight: 800;
          color: var(--accent-hover);
        }
        .intake__metric-label {
          font-size: 12px;
          color: var(--muted-strong);
        }
        .intake__notes {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 4px;
          font-size: 12.5px;
          color: var(--muted-strong);
        }
        .intake__notes li::before {
          content: "✓ ";
          color: var(--success);
          font-weight: 700;
        }
        .intake__risk::before {
          content: "! " !important;
          color: var(--warning) !important;
        }
        .intake__fields {
          margin: 0;
          display: grid;
          gap: 8px;
        }
        .intake__field {
          display: grid;
          grid-template-columns: 1fr max-content;
          gap: 8px;
          font-size: 13px;
        }
        .intake__field dt { color: var(--muted-strong); }
        .intake__field dd { margin: 0; color: var(--text-strong); font-weight: 600; }
        .intake__bar {
          display: grid;
          grid-template-columns: max-content 1fr max-content;
          gap: 12px;
          align-items: center;
          background: var(--panel-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px 14px;
        }
        .intake__bar-label {
          font-size: 12px;
          color: var(--muted-strong);
          font-weight: 600;
        }
        .intake__bar-track {
          height: 8px;
          background: var(--panel-strong);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .intake__bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent) 0%, #60a5fa 100%);
          border-radius: inherit;
          transition: width var(--duration-ui) var(--ease-ui);
        }
        .intake__bar-value {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 13px;
          color: var(--accent-hover);
        }
      `}</style>
    </ScreenShell>
  );
}
