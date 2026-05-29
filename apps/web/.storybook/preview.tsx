import type { Preview } from "@storybook/react";
import { initialize, mswLoader } from "msw-storybook-addon";
import { ThemeProvider } from "next-themes";
import React from "react";

import { Toaster } from "../src/components/ui/sonner";
import { TooltipProvider } from "../src/components/ui/tooltip";
import "../src/app/globals.css";
import { scenarioGlobalType, withScenario } from "./decorators/with-scenario";
import { storybookMswHandlers } from "./msw-handlers";
import "./storybook-fonts.css";

initialize({ onUnhandledRequest: "bypass" });

const preview: Preview = {
  globalTypes: scenarioGlobalType,
  loaders: [mswLoader],
  parameters: {
    msw: {
      handlers: storybookMswHandlers
    },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
    options: {
      storySort: {
        order: [
          "Foundations",
          "Primitives",
          "Composites",
          "Widgets",
          "Screens",
          "Flows",
          "Patterns",
          "API Contract",
          "*"
        ]
      }
    },
    layout: "padded",
    viewport: {
      viewports: {
        desktop1440: {
          name: "1440×900",
          styles: { width: "1440px", height: "900px" }
        }
      }
    }
  },
  decorators: [withScenario, (Story, context) => {
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
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      );
    }
  ]
};

export default preview;
