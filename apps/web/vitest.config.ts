import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const webRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(webRoot, "src")
    }
  },
  test: {
    globals: false,
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.health.test.ts",
      ".storybook/**/*.test.ts"
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "storybook-static/**"]
  }
});
