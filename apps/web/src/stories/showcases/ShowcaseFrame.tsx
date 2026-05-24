import type { ReactNode } from "react";

/** Обёртка demo-страницы как в design-v2 HTML (ds-demo). */
export function ShowcaseFrame({ title, hint, children, wide }: { title: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className={`ds-demo__main${wide ? " ds-demo__main--wide" : ""}`} style={{ padding: "var(--space-6)", maxWidth: wide ? "none" : 960 }}>
      <h1 className="ds-demo__title type-h2">{title}</h1>
      {hint ? <p className="ds-demo__hint">{hint}</p> : null}
      {children}
    </main>
  );
}
