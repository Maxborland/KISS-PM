import type { ReactNode } from "react";

export type AppShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  return (
    <div className="app-canvas">
      <div className="app-canvas__panel">
        {sidebar}
        <div className="app-main">
          {topbar}
          <div className="app-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
