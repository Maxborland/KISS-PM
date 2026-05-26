import type { ReactNode } from "react";

export const PATTERN_STORY_PARAMETERS = {
  layout: "padded" as const,
  viewport: { defaultViewport: "desktop1440" }
};

export function patternDocs(usage: string): { description: { story: string } } {
  return {
    description: {
      story: usage
    }
  };
}

export function PatternFrame({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="pattern-story">
      <header className="pattern-story__header">
        <p className="pattern-story__eyebrow">Patterns · повторяемые состояния UI</p>
        <h1 className="pattern-story__title type-h2">{title}</h1>
        {hint ? <p className="pattern-story__hint type-body">{hint}</p> : null}
      </header>
      <div className="pattern-story__body">{children}</div>
    </div>
  );
}
