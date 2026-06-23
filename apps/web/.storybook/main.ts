import type { StorybookConfig } from "@storybook/react-vite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(configDir, "..");

const config: StorybookConfig = {
  // Legacy design-v2 stories removed (batch 8); index is design-v3 only (DESIGN_CONTRACT §10).
  stories: [
    "../src/components/**/*.stories.@(ts|tsx)",
    "../src/views/**/*.stories.@(ts|tsx)",
    "../src/delivery/**/*.stories.@(ts|tsx)",
    "../src/crm/**/*.stories.@(ts|tsx)",
    "../src/communications/**/*.stories.@(ts|tsx)",
    "../src/auth/**/*.stories.@(ts|tsx)",
    "../src/stories/foundations/**/*.stories.@(ts|tsx)",
    "../src/stories/catalog/**/*.stories.@(ts|tsx)"
  ],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: "@storybook/react-vite",
  viteFinal: async (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": join(webRoot, "src")
    };
    return config;
  }
};

export default config;
