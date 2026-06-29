"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { PROTOTYPE_LABEL } from "@/views/lib/demo";

export type AppShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

/**
 * Каркас рабочей области: сайдбар + основная колонка (topbar + контент).
 *
 * Адаптив: на узких экранах (<=860px, см. bem.css) сайдбар становится
 * off-canvas drawer. Бургер в `.app-mobilebar` реально открывает/закрывает
 * его через локальный state — это рабочий контрол, не прототип-заглушка.
 */
export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-canvas">
      <div className={cn("app-canvas__panel", menuOpen && "app-canvas__panel--menu-open")}>
        {sidebar}
        <button
          type="button"
          className="app-scrim"
          aria-label="Закрыть меню"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        />
        <div className="app-main">
          <div className="app-mobilebar">
            <IconButton
              label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              variant="ghost"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </IconButton>
            <span className="app-mobilebar__brand">KISS PM</span>
            <Chip variant="warning" className="ml-auto">
              {PROTOTYPE_LABEL}
            </Chip>
          </div>
          {topbar}
          <div className="app-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
