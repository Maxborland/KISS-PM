import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const forbiddenFragments = [
  "@gungantt/core",
  "gantt-core/src/" + "scheduling",
  "gantt-core/src/" + "planning",
  "gantt-bitrix-" + "preset",
  "antd"
];

describe("planning-gantt-ui package boundary", () => {
  it("does not import quarantined BR2 modules or Ant Design", () => {
    const offenders = listSourceFiles(sourceRoot)
      .filter((file) => !file.endsWith("packageBoundary.test.ts"))
      .flatMap((file) => {
        const content = readFileSync(file, "utf8");
        return forbiddenFragments
          .filter((fragment) => content.includes(fragment))
          .map((fragment) => `${file}: ${fragment}`);
      });

    expect(offenders).toEqual([]);
  });
});

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) return listSourceFiles(absolutePath);
    if (absolutePath.endsWith(".ts") || absolutePath.endsWith(".tsx")) return [absolutePath];
    return [];
  });
}
