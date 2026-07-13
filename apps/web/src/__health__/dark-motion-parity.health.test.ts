import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(webRoot, "src");

function source(path: string) {
  return readFileSync(join(srcRoot, path), "utf8");
}

function declarationBlock(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `selector ${selector} must exist`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

const darkSemanticTokens = [
  "canvas", "canvas-tint", "panel", "panel-subtle", "panel-strong", "panel-elevated",
  "border", "border-strong", "border-subtle", "text", "text-strong", "muted", "muted-strong", "muted-soft",
  "accent", "accent-hover", "accent-soft", "accent-muted", "accent-ring", "accent-text",
  "success", "success-text", "success-soft", "success-border", "success-subtle",
  "warning", "warning-text", "warning-soft",
  "danger", "danger-text", "danger-soft", "danger-border", "danger-subtle", "danger-muted",
  "info", "info-soft", "violet", "violet-soft",
  "prio-urgent", "prio-urgent-soft", "prio-critical", "prio-critical-soft", "prio-high", "prio-high-soft",
  "prio-normal", "prio-normal-soft", "prio-med", "prio-med-soft", "prio-low", "prio-low-soft",
  "shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl", "shadow-panel", "shadow-inset",
  "shadow-card", "shadow-raise", "shadow-pop", "shadow-lift"
] as const;

function hexToken(block: string, token: string) {
  const match = block.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})`));
  expect(match, `--${token} must have a hex value for contrast checks`).toBeTruthy();
  return match![1]!;
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(foreground: string, background: string) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const aaPairs = [
  ["text", "canvas"], ["text", "panel"], ["muted", "canvas"],
  ["accent-text", "panel"], ["success-text", "success-soft"],
  ["warning-text", "warning-soft"], ["danger-text", "danger-soft"]
] as const;

describe("PR11 dark and motion parity", () => {
  it("keeps the complete semantic dark map in the canonical token owner", () => {
    const tokens = source("styles/tokens.css");
    const globals = source("app/globals.css");
    const light = declarationBlock(tokens, ":root");
    const dark = declarationBlock(tokens, '[data-theme="dark"]');

    for (const token of darkSemanticTokens) {
      expect(light, `light token --${token} is undefined`).toMatch(new RegExp(`--${token}\\s*:`));
      expect(dark, `dark token --${token} is not overridden`).toMatch(new RegExp(`--${token}\\s*:`));
    }
    expect(globals).not.toContain('[data-theme="dark"]');
  });

  it("keeps critical dark semantic text pairs at WCAG AA contrast", () => {
    const dark = declarationBlock(source("styles/tokens.css"), '[data-theme="dark"]');

    for (const [foreground, background] of aaPairs) {
      const ratio = contrastRatio(hexToken(dark, foreground), hexToken(dark, background));
      expect(
        ratio,
        `--${foreground} on --${background} contrast ${ratio.toFixed(2)} must be >= 4.5`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("has one data-theme mechanism and no next-themes dependency", () => {
    const packageJson = readFileSync(join(webRoot, "package.json"), "utf8");
    expect(packageJson).not.toContain('"next-themes"');
    expect(source("app/providers.tsx")).not.toContain("ThemeProvider");
    expect(source("components/ui/sonner.tsx")).not.toContain("next-themes");
    const storybookPreview = readFileSync(join(webRoot, ".storybook/preview.tsx"), "utf8");
    expect(storybookPreview).not.toMatch(/next-themes|ThemeProvider/);
  });

  it("neutralizes overlay and widget motion while preserving the Storybook override", () => {
    const globals = source("app/globals.css");
    const widget = source("styles/widgets/landing-agent-demo.css");

    expect(globals).toMatch(/:root:not\(\[data-force-motion\]\) \[class\*="animate-in"\]/);
    expect(globals).toMatch(/:root:not\(\[data-force-motion\]\) \[class\*="animate-out"\]/);
    expect(globals).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(globals).toMatch(/--tw-enter-translate-[xy]:\s*0/);
    expect(globals).toMatch(/--tw-exit-translate-[xy]:\s*0/);
    expect(widget).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*:root:not\(\[data-force-motion\]\)[\s\S]*\.lad-message/);
    expect(widget).toMatch(/\.lad-review[\s\S]*\.lad-agent-menu[\s\S]*animation:\s*none\s*!important/);
  });
});
