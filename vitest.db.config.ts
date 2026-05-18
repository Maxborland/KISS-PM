import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["packages/**/*.db.test.ts", "apps/**/*.db.test.ts"],
    fileParallelism: false
  }
});
