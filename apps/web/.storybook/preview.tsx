import type { Preview } from "@storybook/react";
import { ThemeProvider } from "next-themes";
import React from "react";

import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
    options: {
      storySort: {
        order: ["Foundations", "Catalog", "UI", "*"]
      }
    },
    layout: "padded"
  },
  decorators: [
    (Story) => (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <div className="app-canvas app-content">
          <Story />
        </div>
      </ThemeProvider>
    )
  ]
};

export default preview;
