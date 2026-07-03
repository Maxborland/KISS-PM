import type { LandingLocale } from "../../lib/landing-i18n";
import { copyFor } from "../../lib/landing-i18n";
import type { StepDefinition } from "./steps";

export function StepProgress({
  active,
  steps,
  locale = "ru",
  onSelect,
}: {
  active: number;
  steps: ReadonlyArray<StepDefinition>;
  locale?: LandingLocale;
  onSelect: (index: number) => void;
}) {
  const copy = copyFor(locale).sixSteps;
  return (
    <nav className="six-steps__progress" aria-label={copy.progressLabel}>
      {steps.map((step, idx) => (
        <button
          key={step.id}
          type="button"
          className="six-steps__progress-bar"
          aria-current={idx === active ? "true" : undefined}
          aria-label={`${copy.progressItemLabel} ${idx + 1}`}
          onClick={() => onSelect(idx)}
        />
      ))}
    </nav>
  );
}