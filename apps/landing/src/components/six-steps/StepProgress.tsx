import { SIX_STEPS } from "./steps";

export function StepProgress({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav className="six-steps__progress" aria-label="Навигация по шагам">
      {SIX_STEPS.map((step, idx) => (
        <button
          key={step.id}
          type="button"
          className="six-steps__progress-bar"
          aria-current={idx === active ? "true" : undefined}
          aria-label={`Перейти к шагу ${idx + 1}`}
          onClick={() => onSelect(idx)}
        />
      ))}
    </nav>
  );
}
