import type { ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { CommandPalette } from "@/shell/command-palette";
import { demoAction } from "@/views/lib/demo";
import { Bell } from "lucide-react";

export type AppTopbarProps = {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
};

export function AppTopbar({ breadcrumbs, actions }: AppTopbarProps) {
  return (
    <header className="app-topbar">
      {breadcrumbs}
      <div className="topbar-actions">
        <CommandPalette />
        <IconButton label="Уведомления" {...demoAction("панель уведомлений")}>
          <Bell className="size-4" />
        </IconButton>
        {actions}
      </div>
    </header>
  );
}
