import type { Preview } from "@storybook/react";

import "../src/styles/base.css";
import "../src/stories/landing-storybook.css";

const preview: Preview = {
  parameters: {
    a11y: { test: "todo" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    options: {
      storySort: {
        order: ["Marketing", "LandingAgentDemo", "*"],
      },
    },
    viewport: {
      viewports: {
        mobile390: {
          name: "390x844",
          styles: { width: "390px", height: "844px" },
        },
        tablet768: {
          name: "768x1024",
          styles: { width: "768px", height: "1024px" },
        },
        desktop1440: {
          name: "1440x900",
          styles: { width: "1440px", height: "900px" },
        },
      },
    },
  },
};

export default preview;
