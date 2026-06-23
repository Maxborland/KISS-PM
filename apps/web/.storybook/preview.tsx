import type { Preview } from "@storybook/react";
import { ThemeProvider } from "next-themes";
import React from "react";

import { TooltipProvider } from "../src/components/ui/tooltip";
import "../src/app/globals.css";
import "./storybook-fonts.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
    options: {
      storySort: {
        order: ["Project Delivery", "CRM", "Communications", "Auth", "Foundations", "Typography", "UI", "Domain", "Widgets", "Shell", "Views", "Catalog", "*"]
      }
    },
    layout: "padded"
  },
  decorators: [
    (Story, context) => {
      const fullscreen = context.parameters.layout === "fullscreen";
      return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
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
