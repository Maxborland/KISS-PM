import type { ReactNode } from "react";

export type AppShellProps = {
  iconRail: ReactNode;
  contextSidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function AppShell({ iconRail, contextSidebar, topbar, children }: AppShellProps) {
  return (
    <div className="app-canvas">
      <div className="app-canvas__panel">
        {iconRail}
        {contextSidebar}
        <div className="app-main">
          {topbar}
          <div className="app-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
