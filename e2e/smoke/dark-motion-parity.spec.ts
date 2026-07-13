import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

type WorkspaceTheme = "light" | "dark";
type ProfileTheme = { theme: WorkspaceTheme; accentColor: string };

const evidenceRoot = path.resolve(".superloopy/evidence/frontend/pr11-dark-motion");
const currentEvidenceRoot = path.join(evidenceRoot, "current");
const actionHeaders = { "x-kiss-pm-action": "same-origin" };
const widths = [390, 768, 1280] as const;
const themes = ["light", "dark"] as const;
const motions = ["normal", "reduced"] as const;

test.beforeAll(async () => {
  await rm(currentEvidenceRoot, { recursive: true, force: true });
  await mkdir(currentEvidenceRoot, { recursive: true });
});

test("admin: profile persistence, semantic dark map and reduced overlay motion stay coherent", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });
  const original = await readTheme(page);

  try {
    const targetTheme: WorkspaceTheme = original.theme === "light" ? "dark" : "light";
    await page.goto("/profile");
    await expect(page.getByLabel("Имя")).toBeVisible();
    await page.getByRole("button", { name: targetTheme === "dark" ? "Тёмная" : "Светлая", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", targetTheme);
    const saveResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/profile/theme" && response.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    expect((await saveResponse).status()).toBe(200);

    await page.goto("/agent");
    await expectAgentReady(page, targetTheme);
    await page.reload();
    await expectAgentReady(page, targetTheme);

    const computedByTheme: Record<string, Record<string, string>> = {};
    for (const theme of themes) {
      await updateTheme(page, { theme, accentColor: original.accentColor });
      for (const motion of motions) {
        await page.emulateMedia({ reducedMotion: motion === "reduced" ? "reduce" : "no-preference" });
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto("/agent");
          await expectAgentReady(page, theme);
          await expectNoHorizontalOverflow(page);
          await page.screenshot({
            path: path.join(currentEvidenceRoot, `${width}-${theme}-${motion}.png`),
            fullPage: false
          });
        }
      }
      computedByTheme[theme] = await semanticStyles(page);
    }
    await writeFile(path.join(evidenceRoot, "computed-semantic-tokens.json"), JSON.stringify(computedByTheme, null, 2));
    const screenshots = (await readdir(currentEvidenceRoot)).filter((name) => name.endsWith(".png"));
    expect(screenshots).toHaveLength(widths.length * themes.length * motions.length);
    expect(new Set(screenshots).size).toBe(screenshots.length);

    expect(computedByTheme.dark?.["--accent-soft"]).not.toBe(computedByTheme.light?.["--accent-soft"]);
    expect(computedByTheme.dark?.["--success-soft"]).not.toBe(computedByTheme.light?.["--success-soft"]);
    expect(computedByTheme.dark?.["--prio-high-soft"]).not.toBe(computedByTheme.light?.["--prio-high-soft"]);

    await updateTheme(page, { theme: "dark", accentColor: original.accentColor });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/agent");
    await expectAgentReady(page, "dark");
    const trigger = page.getByRole("button", { name: "Сведения об агенте" });

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await trigger.click();
    const popover = page.locator('[data-slot="popover-content"]');
    await expect(popover).toBeVisible();
    const normalMotion = await overlayMotion(popover);
    expect(durationMs(normalMotion.duration)).toBeGreaterThan(1);
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await trigger.click();
    await expect(popover).toBeVisible();
    const reducedMotion = await overlayMotion(popover);
    expect(reducedMotion).toMatchObject({
      mediaReduced: true,
      forceMotion: false,
      selectorMatched: true
    });
    expect(durationMs(reducedMotion.duration)).toBeLessThanOrEqual(0.1);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(reducedMotion.transform);
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  } finally {
    await updateTheme(page, original);
  }
});

test("reader: /agent remains readable while theme mutation is permission-denied", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await loginToWorkspace(page, {
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345"
  });
  const original = await readTheme(page);
  const denied = await page.request.patch("/api/profile/theme", {
    headers: actionHeaders,
    data: { theme: original.theme === "light" ? "dark" : "light" }
  });
  expect(denied.status()).toBe(403);

  await page.goto("/agent");
  await expectAgentReady(page, original.theme);
  await expectNoHorizontalOverflow(page);
});

async function readTheme(page: Page): Promise<ProfileTheme> {
  const response = await page.request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  const { user } = await response.json() as { user: ProfileTheme };
  return { theme: user.theme, accentColor: user.accentColor };
}

async function updateTheme(page: Page, theme: ProfileTheme) {
  const response = await page.request.patch("/api/profile/theme", {
    headers: actionHeaders,
    data: theme
  });
  expect(response.status()).toBe(200);
}

async function expectAgentReady(page: Page, theme: WorkspaceTheme) {
  await expect(page.getByRole("region", { name: "Чат с Генри Ганттом" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
}

async function semanticStyles(page: Page) {
  return page.locator("html").evaluate((root) => {
    const styles = getComputedStyle(root);
    return Object.fromEntries([
      "--canvas", "--panel", "--text", "--accent-soft", "--success-soft",
      "--warning-soft", "--danger-soft", "--prio-high-soft", "--shadow-card"
    ].map((token) => [token, styles.getPropertyValue(token).trim()]));
  });
}

async function overlayMotion(popover: ReturnType<Page["locator"]>) {
  return popover.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      duration: styles.animationDuration,
      transform: styles.transform,
      mediaReduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      forceMotion: document.documentElement.hasAttribute("data-force-motion"),
      selectorMatched: element.matches(':root:not([data-force-motion]) [class*="animate-in"]')
    };
  });
}

function durationMs(value: string) {
  const duration = value.split(",", 1)[0]?.trim() ?? "0s";
  return duration.endsWith("ms") ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000;
}
