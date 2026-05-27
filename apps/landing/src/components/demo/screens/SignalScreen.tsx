import { useState } from "react";
import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  signal: DemoFixture["signal"];
  onAdvance: () => void;
}

export function SignalScreen({ signal, onAdvance }: Props) {
  const defaultId = signal.options.find((o) => o.recommended)?.id ?? signal.options[0]!.id;
  const [selected, setSelected] = useState<string>(defaultId);

  return (
    <DemoScreenFrame
      title={signal.name}
      meta="Сигнал · ведущий инженер · DEAL-204"
      status={signal.current}
      statusTone="warning"
      syncNote={`порог ${signal.threshold}`}
      toolbar={<Cta label="Перейти к действию →" emphasis onClick={onAdvance} />}
    >
      <div className="demo-signal">
        <div className="demo-signal__summary">
          <div className="demo-signal__meter">
            <span className="demo-signal__meter-value">{signal.current}</span>
            <span className="demo-signal__meter-label">текущая загрузка</span>
          </div>
          <p className="demo-signal__rationale">{signal.rationale}</p>
        </div>

        <fieldset className="demo-signal__options">
          <legend>Разрешённые сценарии</legend>
          {signal.options.map((o) => (
            <label
              key={o.id}
              className={`demo-signal__option${selected === o.id ? " demo-signal__option--selected" : ""}`}
            >
              <input
                type="radio"
                name="signal-action"
                value={o.id}
                checked={selected === o.id}
                onChange={() => setSelected(o.id)}
              />
              <span className="demo-signal__option-body">
                <span className="demo-signal__option-title">{o.label}</span>
                {o.recommended ? <span className="demo-signal__rec">Рекомендовано</span> : null}
              </span>
            </label>
          ))}
        </fieldset>

        <p className="demo-signal__footnote">
          Сценарий применяется командой приложения — не прямым редактированием плана.
        </p>
      </div>
    </DemoScreenFrame>
  );
}
