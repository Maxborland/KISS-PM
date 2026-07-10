import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../..");
const EVIDENCE_ROOT = resolve(REPO_ROOT, ".superloopy/evidence/projects-2026-07-10");
const SCREENSHOT_DIR = resolve(EVIDENCE_ROOT, "navigation/screenshots");
const REPORT_PATH = resolve(EVIDENCE_ROOT, "projects-navigation.json");

const TABS = [
  ["Обзор", "overview"],
  ["График", "schedule"],
  ["Ресурсы", "resources"],
  ["Назначения", "assignments"],
  ["Календари", "calendars"],
  ["Сценарии", "scenarios"],
  ["Baseline", "baseline"],
  ["Коммиты", "commits"],
  ["Настройки", "settings"]
] as const;

type Project = { id: string; title: string };
type RouteEvidence = {
  route: string;
  finalUrl: string;
  activeTab: string;
  tabLinks: number;
  screenshot: string;
  status: "PASS" | "FAIL";
  error: string;
};

test("Projects navigation: list, every delivery route, project selector and reload", async ({
  page
}, testInfo) => {
  test.setTimeout(4 * 60_000);
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const rows: RouteEvidence[] = [];
  const failures: string[] = [];
  await loginAsAdmin(page);

  const projectsResponse = await page.request.get("/api/workspace/projects");
  expect(projectsResponse.status()).toBe(200);
  const projectsBody = (await projectsResponse.json()) as { projects: Project[] };
  expect(projectsBody.projects.length).toBeGreaterThanOrEqual(2);
  const [firstProject, secondProject] = projectsBody.projects;
  expect(firstProject).toBeTruthy();
  expect(secondProject).toBeTruthy();

  await page.goto("/projects");
  await waitForSettledSurface(page);
  const firstRow = page.getByRole("link").filter({ hasText: firstProject!.title });
  await expect(firstRow).toHaveCount(1);
  await firstRow.click();
  await expect(page).toHaveURL(new RegExp(`/projects/${firstProject!.id}/overview$`));

  for (const [label, slug] of TABS) {
    const route = `/projects/${firstProject!.id}/${slug}`;
    const row: RouteEvidence = {
      route,
      finalUrl: "",
      activeTab: label,
      tabLinks: 0,
      screenshot: "",
      status: "FAIL",
      error: ""
    };
    try {
      await page.goto(route);
      await waitForSettledSurface(page);
      row.finalUrl = page.url();

      const deliveryNav = page
        .getByRole("navigation")
        .filter({
          has: page.locator(`a[href="/projects/${firstProject!.id}/overview"]`)
        });
      await expect(deliveryNav).toHaveCount(1);
      for (const [, expectedSlug] of TABS) {
        await expect(
          deliveryNav.locator(`a[href="/projects/${firstProject!.id}/${expectedSlug}"]`)
        ).toHaveCount(1);
      }
      row.tabLinks = TABS.length;
      await expect(
        deliveryNav.locator(
          `a[href="/projects/${firstProject!.id}/${slug}"][aria-current="page"]`
        )
      ).toHaveCount(1);
      row.status = "PASS";
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
      failures.push(`${route}: ${row.error}`);
    } finally {
      const screenshotPath = resolve(SCREENSHOT_DIR, `${slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      row.screenshot = relative(REPO_ROOT, screenshotPath).replaceAll("\\", "/");
      rows.push(row);
    }
  }

  await page.goto(`/projects/${firstProject!.id}`);
  await waitForSettledSurface(page);
  await expect(page.getByRole("heading", { name: "Карточка проекта" })).toBeVisible();
  const selector = page.getByLabel("Проект:");
  await expect(selector).toHaveCount(1);
  await selector.selectOption(secondProject!.id);
  await expect(page).toHaveURL(new RegExp(`/projects/${secondProject!.id}$`));
  await waitForSettledSurface(page);
  await expect(page.getByRole("heading", { name: secondProject!.title, exact: true })).toBeVisible();

  await page.reload();
  await waitForSettledSurface(page);
  await expect(page).toHaveURL(new RegExp(`/projects/${secondProject!.id}$`));
  await expect(page.getByRole("heading", { name: secondProject!.title, exact: true })).toBeVisible();

  await page.goBack();
  await waitForSettledSurface(page);
  await expect(page).toHaveURL(new RegExp(`/projects/${firstProject!.id}$`));

  writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseURL: String(testInfo.project.use.baseURL),
        projects: projectsBody.projects.map(({ id, title }) => ({ id, title })),
        routes: rows,
        selector: {
          from: firstProject!.id,
          to: secondProject!.id,
          reloadPersisted: true,
          backRestored: true,
          status: "PASS"
        },
        summary: {
          total: rows.length + 1,
          pass: rows.filter((row) => row.status === "PASS").length + 1,
          fail: rows.filter((row) => row.status === "FAIL").length
        },
        failures
      },
      null,
      2
    ),
    "utf8"
  );

  expect(failures).toEqual([]);
  expect(rows).toHaveLength(TABS.length);
  expect(rows.every((row) => row.status === "PASS")).toBe(true);
});

async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("admin@kiss-pm.local");
  await page.getByLabel("Пароль", { exact: true }).fill("admin12345");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
}

async function waitForSettledSurface(page: Page) {
  await page.waitForFunction(
    () => {
      const text = document.body.textContent ?? "";
      return ![
        "Загрузка проектов…",
        "Загружаем карточку проекта…",
        "Загрузка назначений…",
        "Загрузка календарей…",
        "Загрузка ресурсной загрузки…",
        "Загрузка плана…",
        "Загрузка настроек…"
      ].some((label) => text.includes(label)) && !text.includes("Загрузка…");
    },
    undefined,
    { timeout: 20_000 }
  );
}