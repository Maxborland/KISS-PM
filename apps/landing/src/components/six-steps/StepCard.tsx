import type { StepDefinition } from "./steps";
import { StepMiniDemo } from "./demos";

export function StepCard({
  step,
  active,
}: {
  step: StepDefinition;
  active: boolean;
}) {
  return (
    <article
      className="stepCard six-steps__slide"
      data-six-slide
      data-active={active ? "true" : "false"}
      aria-hidden={!active}
    >
      <div className="six-steps__card">
        <div className="six-steps__copy">
          <span className="six-steps__number">{step.number}</span>
          <span className="six-steps__category">{step.category}</span>
          <h3 className="six-steps__title">{step.title}</h3>
          <p className="six-steps__description">{step.description}</p>
        </div>
        <div className="six-steps__stage">
          <StepMiniDemo demoType={step.demoType} active={active} />
        </div>
      </div>
    </article>
  );
}
