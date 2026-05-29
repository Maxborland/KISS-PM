import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = process.cwd();

describe("storybook VRT utils", () => {
  it("do not abort broad e2e runs when Storybook static index is absent", () => {
    const source = readFileSync(join(webRoot, "tests/e2e/storybook-vrt-utils.ts"), "utf8");

    expect(source).toContain('process.env.STORYBOOK_STATIC !== "1"');
    expect(source).toContain("return { entries: {} }");
  });
});
