import type { ReactNode } from "react";

export function DemoShell({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className={`six-demo${active ? " six-demo--active" : ""}`} aria-hidden="true">
      <div className="six-demo__grid" />
      <div className="six-demo__content">{children}</div>
    </div>
  );
}
