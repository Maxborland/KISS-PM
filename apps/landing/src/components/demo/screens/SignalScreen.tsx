import { useState } from "react";
import { Cta, ScreenShell } from "../ScreenShell";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  signal: DemoFixture["signal"];
  onAdvance: () => void;
}

export function SignalScreen({ signal, onAdvance }: Props) {
  const [selected, setSelected] = useState<string>(
    signal.options.find((o) => o.recommended)?.id ?? signal.options[0]!.id,
  );

  return (
    <ScreenShell
      title={signal.name}
      subtitle={`Порог: ${signal.threshold} · текущее значение: ${signal.current}`}
      toolbar={<Cta label="Перейти к действию →" onClick={onAdvance} />}
    >
      <div className="sig">
        <div className="sig__head">
          <div className="sig__meter" data-severity={signal.severity}>
            <span className="sig__meter-value">{signal.current}</span>
            <span className="sig__meter-label">осталось до порога</span>
          </div>
          <p className="sig__rationale">{signal.rationale}</p>
        </div>

        <fieldset className="sig__options">
          <legend>Разрешённые действия (RBAC)</legend>
          {signal.options.map((o) => (
            <label
              key={o.id}
              className={`sig__option${selected === o.id ? " is-selected" : ""}`}
            >
              <input
                type="radio"
                name="signal-action"
                value={o.id}
                checked={selected === o.id}
                onChange={() => setSelected(o.id)}
              />
              <span className="sig__option-body">
                <span className="sig__option-title">{o.label}</span>
                {o.recommended && (
                  <span className="sig__option-rec">Рекомендовано AI</span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <style>{`
        .sig { display: grid; gap: 14px; }
        .sig__head {
          display: grid;
          gap: 14px;
          grid-template-columns: max-content 1fr;
          align-items: center;
        }
        .sig__meter {
          padding: 14px 18px;
          border-radius: var(--radius-md);
          background: var(--warning-soft);
          border: 1px solid #fcd34d;
          display: grid;
          gap: 2px;
          min-width: 140px;
        }
        .sig__meter[data-severity="warning"] {
          background: linear-gradient(135deg, var(--warning-soft) 0%, #fffaf0 100%);
        }
        .sig__meter-value {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 800;
          color: #b45309;
        }
        .sig__meter-label {
          font-size: 11px;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
        }
        .sig__rationale {
          font-size: 13px;
          color: var(--text);
          line-height: 1.55;
        }
        .sig__options {
          margin: 0;
          padding: 0;
          border: 0;
          display: grid;
          gap: 8px;
        }
        .sig__options legend {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
          margin-bottom: 4px;
        }
        .sig__option {
          display: grid;
          grid-template-columns: 18px 1fr;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: var(--panel-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition:
            border-color var(--duration-ui) var(--ease-ui),
            background var(--duration-ui) var(--ease-ui);
        }
        .sig__option:hover {
          border-color: var(--accent-muted);
        }
        .sig__option.is-selected {
          background: var(--accent-soft);
          border-color: var(--accent);
        }
        .sig__option input {
          accent-color: var(--accent);
          margin: 0;
        }
        .sig__option-body {
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 13px;
          color: var(--text-strong);
          font-weight: 500;
        }
        .sig__option-rec {
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: var(--violet-soft);
          color: #6d28d9;
          font-weight: 700;
        }
      `}</style>
    </ScreenShell>
  );
}
