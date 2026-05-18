import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as T;
}

function readText(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("shadcn and Tailwind foundation", () => {
  it("keeps a shadcn components registry scaffold for the web app", () => {
    const componentsJson = readJson<{
      style?: string;
      tsx?: boolean;
      tailwind?: { css?: string; baseColor?: string; cssVariables?: boolean };
      aliases?: Record<string, string>;
    }>("apps/web/components.json");

    expect(componentsJson.style).toBe("radix-vega");
    expect(componentsJson.tsx).toBe(true);
    expect(componentsJson.tailwind?.css).toBe("src/styles.css");
    expect(componentsJson.tailwind?.baseColor).toBe("taupe");
    expect(componentsJson.tailwind?.cssVariables).toBe(true);
    expect(componentsJson.aliases?.components).toBe("@/components");
    expect(componentsJson.aliases?.utils).toBe("@/lib/utils");
  });

  it("provides the Tailwind runtime entry and cn utility expected by shadcn components", () => {
    const packageJson = readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(
      "apps/web/package.json"
    );
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    const styles = readText("apps/web/src/styles.css");
    const shadcnStyles = readText("apps/web/src/shadcn.css");
    const utilsPath = "apps/web/src/lib/utils.ts";

    expect(dependencies.tailwindcss).toBeDefined();
    expect(dependencies["@tailwindcss/postcss"]).toBeDefined();
    expect(dependencies["class-variance-authority"]).toBeDefined();
    expect(dependencies.clsx).toBeDefined();
    expect(dependencies["tailwind-merge"]).toBeDefined();
    expect(styles).toContain('@import "./shadcn.css"');
    expect(shadcnStyles).toContain('@import "tailwindcss"');
    expect(shadcnStyles).toContain("@theme inline");
    expect(shadcnStyles).toContain("--color-accent: var(--shadcn-accent)");
    expect(shadcnStyles).toContain("--color-muted: var(--shadcn-muted)");
    expect(shadcnStyles).toContain("--color-border: var(--shadcn-border)");
    expect(existsSync(join(process.cwd(), utilsPath))).toBe(true);
    expect(readText(utilsPath)).toContain("export function cn");
  });

  it("includes baseline shadcn primitives for future CRUD surfaces", () => {
    const expectedComponents = [
      "apps/web/src/components/ui/button.tsx",
      "apps/web/src/components/ui/dialog.tsx",
      "apps/web/src/components/ui/dropdown-menu.tsx",
      "apps/web/src/components/ui/table.tsx"
    ];

    for (const componentPath of expectedComponents) {
      expect(existsSync(join(process.cwd(), componentPath)), componentPath).toBe(true);
    }
  });

  it("keeps Next dev runtime usable from the Docker/browser smoke origin", () => {
    const nextConfig = readText("apps/web/next.config.ts");

    expect(nextConfig).toContain('allowedDevOrigins: ["127.0.0.1", "localhost"]');
    expect(nextConfig).toContain("devIndicators: false");
  });

  it("aligns shadcn theme tokens with the product theme model", () => {
    const shadcnStyles = readText("apps/web/src/shadcn.css");
    const dropdownMenu = readText("apps/web/src/components/ui/dropdown-menu.tsx");
    const themeHook = readText("apps/web/src/useDocumentThemeClass.ts");

    expect(shadcnStyles).toContain("@custom-variant dark (&:is(.dark *, .theme-dark *))");
    expect(shadcnStyles).toContain(".dark,\n.theme-dark");
    expect(dropdownMenu).not.toContain('cn("dark ');
    expect(themeHook).toContain("document.documentElement");
    expect(themeHook).toContain('classList.toggle("dark"');
  });
});
