import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["packages/**/*.db.test.ts", "apps/**/*.db.test.ts"],
    fileParallelism: false,
    // Холодная база (первый прогон после старта контейнера) не укладывается в
    // дефолтные 5s — 4 baseline-теста планирования флакали именно из-за таймаута.
    testTimeout: 30_000
  }
});
