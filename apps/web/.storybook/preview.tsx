import type { Preview } from "@storybook/react";
import { ThemeProvider } from "next-themes";
import React from "react";

import { TooltipProvider } from "../src/components/ui/tooltip";
import "../src/app/globals.css";
import "./storybook-fonts.css";

// Витрина дизайна всегда демонстрирует motion, даже если в ОС ревьюера включён
// «reduce motion» (Windows: Эффекты анимации). reduced-motion-гард в globals.css
// отключается при наличии data-force-motion; в реальном Next-приложении его нет.
function ForceMotion() {
  React.useEffect(() => {
    document.documentElement.setAttribute("data-force-motion", "");
  }, []);
  return null;
}

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
    options: {
      storySort: {
        order: ["Project Delivery", "CRM", "Communications", "Auth", "Workspace", "Admin", "Foundations", "UI", "Views", "Catalog", "*"]
      }
    },
    layout: "padded"
  },
  decorators: [
    (Story, context) => {
      const fullscreen = context.parameters.layout === "fullscreen";
      return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <ForceMotion />
          <TooltipProvider delayDuration={200}>
            {fullscreen ? (
              <Story />
            ) : (
              <div className="app-canvas app-content">
                <Story />
              </div>
            )}
          </TooltipProvider>
        </ThemeProvider>
      );
    }
  ]
};

export default preview;
