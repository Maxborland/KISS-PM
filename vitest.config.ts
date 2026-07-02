import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": join(rootDir, "apps/web/src")
    }
  },
  test: {
    globals: false,
    include: ["packages/**/*.test.ts", "packages/**/*.test.tsx", "apps/**/*.test.ts", "apps/**/*.test.tsx"],
    /* apps/landing — DOM-тесты, гоняются своим vitest (happy-dom) из корневого pnpm test */
    exclude: ["**/node_modules/**", "**/*.db.test.ts", "apps/landing/**"]
  }
});
