import { useState } from "react";
import type { LandingLocale } from "../../../lib/landing-i18n";
import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  signal: DemoFixture["signal"];
  locale?: LandingLocale;
  onAdvance: () => void;
}

const COPY = {
  ru: {
    meta: "Сигнал · ведущий инженер · сделка «ГК Север»",
    sync: (threshold: string) => `порог ${threshold}`,
    cta: "Перейти к действию →",
    load: "текущая загрузка",
    legend: "Разрешённые сценарии",
    recommended: "Рекомендовано",
    footnote: "Сценарий применяется командой приложения — не прямым редактированием плана.",
  },
  en: {
    meta: "Signal · lead engineer · Northstar opportunity",
    sync: (threshold: string) => `threshold ${threshold}`,
    cta: "Go to action →",
    load: "current load",
    legend: "Allowed scenarios",
    recommended: "Recommended",
    footnote: "The scenario is applied by an application command, not by direct plan editing.",
  },
} as const;

export function SignalScreen({ signal, locale = "ru", onAdvance }: Props) {
  const copy = COPY[locale];
  const defaultId = signal.options.find((o) => o.recommended)?.id ?? signal.options[0]!.id;
  const [selected, setSelected] = useState<string>(defaultId);

  return (
    <DemoScreenFrame title={signal.name} meta={copy.meta} status={signal.current} statusTone="warning" syncNote={copy.sync(signal.threshold)} toolbar={<Cta label={copy.cta} emphasis onClick={onAdvance} />}>
      <div className="demo-signal">
        <div className="demo-signal__summary">
          <div className="demo-signal__meter"><span className="demo-signal__meter-value">{signal.current}</span><span className="demo-signal__meter-label">{copy.load}</span></div>
          <p className="demo-signal__rationale">{signal.rationale}</p>
        </div>
        <fieldset className="demo-signal__options">
          <legend>{copy.legend}</legend>
          {signal.options.map((o) => (
            <label key={o.id} className={`demo-signal__option${selected === o.id ? " demo-signal__option--selected" : ""}`}>
              <input type="radio" name="signal-action" value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} />
              <span className="demo-signal__option-body"><span className="demo-signal__option-title">{o.label}</span>{o.recommended ? <span className="demo-signal__rec">{copy.recommended}</span> : null}</span>
            </label>
          ))}
        </fieldset>
        <p className="demo-signal__footnote">{copy.footnote}</p>
      </div>
    </DemoScreenFrame>
  );
}