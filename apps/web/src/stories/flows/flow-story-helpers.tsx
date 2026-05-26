import type { ReactNode } from "react";

import type { ScenarioName } from "@/lib/mock-data/scenarios";

/** Product flow @ 1440px; MSW + toolbar «Сценарий». */
export const FLOW_STORY_PARAMETERS = {
  layout: "fullscreen" as const,
  viewport: { defaultViewport: "desktop1440" }
};

export function flowStoryDocs(steps: string[]): { description: { story: string } } {
  const body = steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  return {
    description: {
      story: `### Шаги сценария\n${body}\n\nДанные: фикстуры \`ScenarioName\` + MSW (\`.storybook/msw-handlers.ts\`).`
    }
  };
}

export function flowParameters(steps: string[], scenario: ScenarioName = "default") {
  return {
    ...FLOW_STORY_PARAMETERS,
    scenario,
    docs: flowStoryDocs(steps)
  };
}

export function FlowStoryFrame({
  title,
  lead,
  steps,
  children
}: {
  title: string;
  lead: string;
  steps: string[];
  children: ReactNode;
}) {
  return (
    <div className="flow-story">
      <header className="flow-story__header">
        <p className="flow-story__eyebrow">Flows · продуктовый контур</p>
        <h1 className="flow-story__title type-h2">{title}</h1>
        <p className="flow-story__lead type-body">{lead}</p>
        <ol className="flow-story__steps">
          {steps.map((step) => (
            <li key={step} className="flow-story__step">
              {step}
            </li>
          ))}
        </ol>
      </header>
      <div className="flow-story__stages">{children}</div>
    </div>
  );
}

export function FlowStage({
  index,
  title,
  apiHint,
  children
}: {
  index: number;
  title: string;
  apiHint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flow-story__stage" aria-labelledby={`flow-stage-${index}`}>
      <div className="flow-story__stage-head">
        <span className="flow-story__stage-num">Шаг {index}</span>
        <h2 id={`flow-stage-${index}`} className="flow-story__stage-title type-h3">
          {title}
        </h2>
        {apiHint ? <p className="flow-story__api-hint mono">{apiHint}</p> : null}
      </div>
      <div className="flow-story__stage-body">{children}</div>
    </section>
  );
}
