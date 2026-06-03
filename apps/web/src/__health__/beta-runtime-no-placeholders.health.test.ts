import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const runtimeFiles = [
  "src/shell/runtime-data-screen.tsx",
  "src/shell/runtime-dashboard-screen.tsx",
  "src/shell/runtime-agent-screen.tsx",
  "src/views/blocks/agent-cockpit-block.tsx",
  "src/views/blocks/deals-block.tsx",
  "src/views/blocks/my-work-block.tsx",
  "src/views/blocks/project-detail-block.tsx",
  "src/views/blocks/project-timeline-block.tsx",
  "src/views/blocks/projects-list-block.tsx"
] as const;

const forbiddenRuntimeTokens = [
  /ScreenPlaceholderBlock/,
  /fixture fallback/i,
  /TODO runtime/i,
  /Coming soon/i,
  /Демо Storybook/i,
  /демо переключения/i,
  /mock\s*[—-]\s*API/i,
  /John Onboarding/i,
  /Sales deck/i,
  /DataHub/i,
  /Разработать концепцию/
] as const;

type RuntimePlaceholderHit = {
  file: string;
  pattern: string;
};

export function findRuntimePlaceholderHits(
  files: readonly string[],
  readFile: (file: string) => string
): RuntimePlaceholderHit[] {
  return files.flatMap((file) => {
    const source = readFile(file);
    return forbiddenRuntimeTokens
      .filter((pattern) => pattern.test(source))
      .map((pattern) => ({ file, pattern: String(pattern) }));
  });
}

describe("beta runtime no-placeholder gate", () => {
  it("flags known placeholder/demo tokens", () => {
    expect(
      findRuntimePlaceholderHits(["runtime.tsx"], () => "Coming soon: ScreenPlaceholderBlock")
    ).toEqual([
      { file: "runtime.tsx", pattern: String(/ScreenPlaceholderBlock/) },
      { file: "runtime.tsx", pattern: String(/Coming soon/i) }
    ]);
  });

  it("keeps beta runtime implementation files free of placeholder/demo copy", () => {
    const hits = findRuntimePlaceholderHits(runtimeFiles, readRuntimeFile);
    expect(hits).toEqual([]);
  });
});

function readRuntimeFile(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}
