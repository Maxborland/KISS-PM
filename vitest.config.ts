import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.join(repoRoot, "apps/web/src");

/** Root vitest runs apps/web health tests too — нужен @ → apps/web/src и .tsx. */
export default defineConfig({
  resolve: {
    alias: {
      "@": webSrc
    },
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"]
  },
  test: {
    globals: false,
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "scripts/**/*.test.ts"
    ],
    exclude: ["**/node_modules/**", "**/*.db.test.ts"]
  }
});
