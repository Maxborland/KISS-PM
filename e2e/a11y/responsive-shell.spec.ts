import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const TABLET_VIEWPORT = { width: 768, height: 1024 };
const NARROW_DESKTOP_VIEWPORT = { width: 900, height: 800 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MIN_TOUCH_TARGET = 44;
const EVIDENCE_DIR = process.env.KISS_PM_RESPONSIVE_EVIDENCE_DIR;

test.use({ hasTouch: true });

async function loginAsSeededAdmin(
  page: Page,
  viewport: { width: number; height: number }
) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
  await loginToWorkspace(page, { password: "admin12345" });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
}

async function loginAsPlanReader(page: Page) {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
  await loginToWorkspace(page, {
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345"
  });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
}

async function expectVisiblyPainted(
  page: Page,
  locator: Locator,
  label: string,
  options: { interactive?: boolean } = {}
) {
  await expect(locator, `${label} is visible`).toBeVisible();
  await expect(locator, `${label} is inside the viewport`).toBeInViewport();

  if (options.interactive) {
    await locator.click({ trial: true });
  }

  const screenshot = await locator.screenshot();
  const pixels = await page.evaluate(async (base64) => {
    const response = await fetch(`data:image/png;base64,${base64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    context.drawImage(bitmap, 0, 0);

    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minLuminance = 255;
    let maxLuminance = 0;
    let opaquePixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      if ((data[index + 3] ?? 0) === 0) continue;
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      minLuminance = Math.min(minLuminance, luminance);
      maxLuminance = Math.max(maxLuminance, luminance);
      opaquePixels += 1;
    }

    return {
      contrastRange: maxLuminance - minLuminance,
      height: bitmap.height,
      opaquePixels,
      width: bitmap.width
    };
  }, screenshot.toString("base64"));

  expect(pixels.width, `${label} painted width`).toBeGreaterThan(0);
  expect(pixels.height, `${label} painted height`).toBeGreaterThan(0);
  expect(pixels.opaquePixels, `${label} has painted pixels`).toBeGreaterThan(0);
  expect(pixels.contrastRange, `${label} is not a solid obscuring band`).toBeGreaterThan(16);
}

async function expectTouchTarget(locator: Locator, label: string) {
  await expect(locator, `${label} is visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} has a rendered hit area`).not.toBeNull();
  if (!box) return;

  expect.soft(box.width, `${label} width`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect.soft(box.height, `${label} height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

async function expectNoHorizontalOverlap(left: Locator, right: Locator, label: string) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  expect(leftBox, `${label} left element is rendered`).not.toBeNull();
  expect(rightBox, `${label} right element is rendered`).not.toBeNull();
  if (!leftBox || !rightBox) return;

  expect(leftBox.x + leftBox.width, label).toBeLessThanOrEqual(rightBox.x);
}

async function captureEvidence(page: Page, filename: string) {
  if (!EVIDENCE_DIR) return;
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_DIR, filename) });
}

test.describe("Responsive authenticated shell regressions", () => {
  test("CURRENT-RESP-01 mobile navigation is visible, opens, closes, and restores focus at 390x844", async ({ page }) => {
    await loginAsSeededAdmin(page, MOBILE_VIEWPORT);

    const navigationToggle = page.getByRole("button", { name: /навигацию/i });
    const sidebar = page.getByRole("complementary", { includeHidden: true });

    await expect(navigationToggle).toBeVisible();
    await expect(navigationToggle).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).not.toBeVisible();

    await navigationToggle.click();

    await expect(navigationToggle).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Мои задачи" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Коммуникации" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Администрирование" })).toBeVisible();
    await expect
      .poll(() => sidebar.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    await captureEvidence(page, "390x844-mobile-navigation-open.png");

    await page.keyboard.press("Escape");

    await expect(sidebar).not.toBeVisible();
    await expect(navigationToggle).toHaveAttribute("aria-expanded", "false");
    await expect(navigationToggle).toBeFocused();
    await captureEvidence(page, "390x844-mobile-navigation-closed.png");
  });

  test("CURRENT-RESP-01 mobile navigation respects plan-reader permissions and performs route navigation", async ({ page }) => {
    await loginAsPlanReader(page);

    await page.getByRole("button", { name: "Открыть навигацию" }).click();
    const sidebar = page.getByRole("complementary");

    await expect(sidebar.getByRole("link", { name: "Мои задачи" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Проекты" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Дашборд" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Сделки" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Коммуникации" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Администрирование" })).toHaveCount(0);
    await captureEvidence(page, "390x844-plan-reader-navigation.png");

    await sidebar.getByRole("link", { name: "Проекты" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(sidebar).toBeHidden();
  });

  test("CURRENT-RESP-02 communications sidebar labels and links are visibly painted at 768x1024", async ({ page }) => {
    await loginAsSeededAdmin(page, TABLET_VIEWPORT);
    await page.goto("/communications/channels");
    await expect(page).toHaveURL(/\/communications\/channels$/);
    const communicationsHeading = page.getByRole("heading", { name: "Коммуникации" });
    await expect(communicationsHeading).toBeVisible();
    await expectNoHorizontalOverlap(
      communicationsHeading.locator("xpath=parent::div/preceding-sibling::span[1]"),
      communicationsHeading,
      "communications header badge does not overlap its heading"
    );

    const sidebar = page.getByRole("complementary").filter({
      has: page.getByRole("link", { name: "Мои задачи", exact: true })
    });
    await expect(sidebar).toBeVisible();

    for (const label of ["KISS PM", "Работа", "Аналитика"] as const) {
      await expectVisiblyPainted(
        page,
        sidebar.getByText(label, { exact: true }),
        `sidebar label ${label}`
      );
    }

    for (const label of [
      "Агент",
      "Мои задачи",
      "Проекты",
      "Сделки",
      "Дашборд",
      "Коммуникации",
      "Администрирование"
    ] as const) {
      await expectVisiblyPainted(
        page,
        sidebar.getByRole("link", { name: label, exact: true }),
        `sidebar link ${label}`,
        { interactive: true }
      );
    }
    await captureEvidence(page, "768x1024-communications-sidebar.png");
  });

  test("CURRENT-RESP-03 representative touch controls provide at least 44x44 hit areas", async ({ page }) => {
    await loginAsSeededAdmin(page, TABLET_VIEWPORT);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users$/);
    const adminHeading = page.getByRole("heading", { name: "Администрирование" });
    await expect(adminHeading).toBeVisible();
    await expectNoHorizontalOverlap(
      adminHeading.locator("xpath=parent::div/preceding-sibling::span[1]"),
      adminHeading,
      "admin header badge does not overlap its heading"
    );

    await expectTouchTarget(
      page.getByRole("banner").getByRole("button").last(),
      "user avatar control"
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "Создать пользователя" }),
      "primary create-user control"
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "Изменить" }).first(),
      "icon-only edit-user control"
    );
    await expectTouchTarget(
      page
        .getByRole("complementary")
        .getByRole("link", { name: "Администрирование", exact: true }),
      "sidebar administration control"
    );
    await captureEvidence(page, "768x1024-admin-touch-targets.png");
  });

});

test.describe("Fine-pointer responsive density", () => {
  test.use({ hasTouch: false });

  test("desktop shell keeps its compact navigation and controls at 1280x800", async ({ page }) => {
    await loginAsSeededAdmin(page, DESKTOP_VIEWPORT);
    await expect(page.getByText("Собираем сводку…")).toBeHidden();

    await expect(page.getByRole("complementary")).toBeVisible();
    await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeHidden();

    const avatar = page.getByRole("banner").getByRole("button").last();
    const box = await avatar.boundingBox();
    expect(box?.width).toBe(32);
    expect(box?.height).toBe(32);
    await captureEvidence(page, "1280x800-desktop-compact-shell.png");
  });

  test("narrow desktop keeps compact controls at 900x800", async ({ page }) => {
    await loginAsSeededAdmin(page, NARROW_DESKTOP_VIEWPORT);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users$/);

    const avatar = await page.getByRole("banner").getByRole("button").last().boundingBox();
    const createUser = await page.getByRole("button", { name: "Создать пользователя" }).boundingBox();
    const editUser = await page.getByRole("button", { name: "Изменить" }).first().boundingBox();

    expect(avatar?.width).toBe(32);
    expect(avatar?.height).toBe(32);
    expect(createUser?.height).toBe(28);
    expect(editUser?.width).toBe(32);
    expect(editUser?.height).toBe(28);
    await captureEvidence(page, "900x800-fine-pointer-compact.png");
  });
});
