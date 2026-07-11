import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../..");
const EVIDENCE_ROOT = resolve(REPO_ROOT, ".superloopy/evidence/projects-2026-07-10");
const SCREENSHOT_DIR = resolve(EVIDENCE_ROOT, "project-detail-identity/screenshots");
const REPORT_PATH = resolve(EVIDENCE_ROOT, "projects-detail-identity.json");

const DELIVERY_SLUGS = [
  "overview",
  "schedule",
  "resources",
  "assignments",
  "calendars",
  "scenarios",
  "baseline",
  "commits",
  "settings"
] as const;

const USERS = {
  admin: { email: "admin@kiss-pm.local", password: "admin12345" },
  planReader: { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" },
  resourceReader: { email: "resource-reader@kiss-pm.local", password: "resource12345" },
  beta: { email: "beta@kiss-pm.local", password: "beta12345" }
} as const;

type Project = { id: string; title: string; status: string };
type EvidenceRow = {
  check: string;
  role: string;
  route: string;
  finalPath: string;
  apiStatus: number | null;
  screenshot: string;
  status: "PASS" | "FAIL";
  error: string;
};

test("Project identity and detail: every header, canonical URL, not-found and forbidden states", async ({
  browser
}, testInfo) => {
  test.setTimeout(8 * 60_000);
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const rows: EvidenceRow[] = [];
  const failures: string[] = [];

  await withSession(browser, testInfo, USERS.admin, async (page) => {
    const projects = await getProjects(page);
    expect(projects.length).toBeGreaterThanOrEqual(2);
    const first = projects[0]!;
    const second = projects[1]!;
    const identityProject =
      projects.find((project) => project.title !== "Производственный портал · Релиз 2") ?? second;

    await runCheck(rows, failures, page, {
      check: "admin-canonical-selector-reload-back-forward",
      role: "admin",
      route: "/projects/" + first.id
    }, async (row) => {
      await exerciseCanonicalSelection(page, first, second);
      row.finalPath = pathname(page);
      return null;
    });

    await runCheck(rows, failures, page, {
      check: "admin-invalid-id-not-found",
      role: "admin",
      route: "/projects/project-does-not-exist"
    }, async (row) => {
      row.apiStatus = await exerciseNotFound(page, "project-does-not-exist");
      row.finalPath = pathname(page);
      return null;
    });

    for (const slug of DELIVERY_SLUGS) {
      const route = "/projects/" + identityProject.id + "/" + slug;
      await runCheck(rows, failures, page, {
        check: "admin-header-" + slug,
        role: "admin",
        route
      }, async (row) => {
        await page.goto(route);
        await waitForSettledSurface(page);
        await expect(
          page.getByRole("heading", { level: 1, name: identityProject.title, exact: true })
        ).toBeVisible();
        await expect(page.getByText(statusLabel(identityProject.status), { exact: true })).toBeVisible();
        await expect(page.locator("h1")).not.toContainText("Производственный портал · Релиз 2");
        row.finalPath = pathname(page);
        return null;
      });
    }
  });

  await withSession(browser, testInfo, USERS.planReader, async (page) => {
    const projects = await getProjects(page);
    expect(projects.length).toBeGreaterThanOrEqual(2);

    await runCheck(rows, failures, page, {
      check: "plan-reader-canonical-selector-reload-back-forward",
      role: "planReader",
      route: "/projects/" + projects[0]!.id
    }, async (row) => {
      await exerciseCanonicalSelection(page, projects[0]!, projects[1]!);
      row.finalPath = pathname(page);
      return null;
    });

    await runCheck(rows, failures, page, {
      check: "plan-reader-invalid-id-not-found",
      role: "planReader",
      route: "/projects/project-does-not-exist"
    }, async (row) => {
      row.apiStatus = await exerciseNotFound(page, "project-does-not-exist");
      row.finalPath = pathname(page);
      return null;
    });
  });

  await withSession(browser, testInfo, USERS.resourceReader, async (page) => {
    await runCheck(rows, failures, page, {
      check: "resource-reader-detail-forbidden",
      role: "resourceReader",
      route: "/projects/project-vektor-portal"
    }, async (row) => {
      const responsePromise = waitForProjectResponse(page, "project-vektor-portal");
      await page.goto(row.route);
      const response = await responsePromise;
      row.apiStatus = response.status();
      await waitForSettledSurface(page);
      expect(response.status()).toBe(403);
      await expect(page.getByText("Доступ ограничен", { exact: true })).toBeVisible();
      row.finalPath = pathname(page);
      return null;
    });
  });

  await withSession(browser, testInfo, USERS.beta, async (page) => {
    await runCheck(rows, failures, page, {
      check: "beta-project-list-empty",
      role: "beta",
      route: "/projects"
    }, async (row) => {
      await page.goto(row.route);
      await waitForSettledSurface(page);
      await expect(page.getByText("Нет проектов", { exact: true })).toBeVisible();
      row.finalPath = pathname(page);
      return null;
    });

    await runCheck(rows, failures, page, {
      check: "beta-invalid-id-not-found",
      role: "beta",
      route: "/projects/project-does-not-exist"
    }, async (row) => {
      row.apiStatus = await exerciseNotFound(page, "project-does-not-exist");
      row.finalPath = pathname(page);
      return null;
    });
  });

  writeFileSync(
    REPORT_PATH,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseURL: String(testInfo.project.use.baseURL),
      rows,
      summary: {
        total: rows.length,
        pass: rows.filter((row) => row.status === "PASS").length,
        fail: rows.filter((row) => row.status === "FAIL").length
      },
      failures
    }, null, 2),
    "utf8"
  );

  expect(rows).toHaveLength(16);
  expect(failures).toEqual([]);
});

async function withSession(
  browser: Browser,
  testInfo: { project: { use: { baseURL?: string } } },
  user: { email: string; password: string },
  run: (page: Page) => Promise<void>
) {
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    locale: "ru-RU"
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  try {
    await login(page, user.email, user.password);
    await run(page);
  } finally {
    await context.close();
  }
}

async function runCheck(
  rows: EvidenceRow[],
  failures: string[],
  page: Page,
  input: Pick<EvidenceRow, "check" | "role" | "route">,
  run: (row: EvidenceRow) => Promise<null>
) {
  const row: EvidenceRow = {
    ...input,
    finalPath: "",
    apiStatus: null,
    screenshot: "",
    status: "FAIL",
    error: ""
  };
  try {
    await run(row);
    row.status = "PASS";
  } catch (error) {
    row.error = errorMessage(error);
    failures.push(input.check + ": " + row.error);
  } finally {
    const screenshotPath = resolve(SCREENSHOT_DIR, input.check + ".png");
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      row.screenshot = relative(REPO_ROOT, screenshotPath).replaceAll("\\", "/");
    } catch (error) {
      const screenshotError = errorMessage(error);
      row.status = "FAIL";
      row.error = row.error
        ? row.error + "\nScreenshot: " + screenshotError
        : "Screenshot: " + screenshotError;
      failures.push(input.check + " screenshot: " + screenshotError);
    } finally {
      rows.push(row);
    }
  }
}

async function exerciseCanonicalSelection(page: Page, first: Project, second: Project) {
  await page.goto("/projects/" + first.id);
  await waitForSettledSurface(page);
  await expect(page.getByRole("heading", { name: first.title, exact: true })).toBeVisible();

  await page.evaluate((projectId) => {
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Проект:"], label select');
    if (!select) throw new Error("project_selector_missing");
    select.value = projectId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, second.id);
  await expectPath(page, "/projects/" + second.id);
  await waitForSettledSurface(page);
  await expect(page.getByRole("heading", { name: second.title, exact: true })).toBeVisible();

  await page.reload();
  await waitForSettledSurface(page);
  await expectPath(page, "/projects/" + second.id);
  await expect(page.getByRole("heading", { name: second.title, exact: true })).toBeVisible();

  await page.goBack();
  await waitForSettledSurface(page);
  await expectPath(page, "/projects/" + first.id);
  await expect(page.getByRole("heading", { name: first.title, exact: true })).toBeVisible();

  await page.goForward();
  await waitForSettledSurface(page);
  await expectPath(page, "/projects/" + second.id);
  await expect(page.getByRole("heading", { name: second.title, exact: true })).toBeVisible();
}

async function exerciseNotFound(page: Page, projectId: string): Promise<number> {
  const responsePromise = waitForProjectResponse(page, projectId);
  await page.goto("/projects/" + projectId);
  const response = await responsePromise;
  await waitForSettledSurface(page);

  expect(response.status()).toBe(404);
  await expectPath(page, "/projects/" + projectId);
  await expect(page.getByText("Проект не найден", { exact: true })).toBeVisible();

  await page.reload();
  await waitForSettledSurface(page);
  await expectPath(page, "/projects/" + projectId);
  await expect(page.getByText("Проект не найден", { exact: true })).toBeVisible();
  return response.status();
}

function waitForProjectResponse(page: Page, projectId: string) {
  const path = "/api/workspace/projects/" + projectId;
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === path && response.request().method() === "GET";
  });
}

async function getProjects(page: Page): Promise<Project[]> {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const body = await response.json() as { projects: Project[] };
  return body.projects;
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
}

async function waitForSettledSurface(page: Page) {
  await page.waitForFunction(() => {
    const text = document.body.textContent ?? "";
    return ![
      "Загрузка проектов…",
      "Загружаем карточку проекта…",
      "Загрузка назначений…",
      "Загрузка календарей…",
      "Загрузка ресурсной загрузки…",
      "Загрузка плана…",
      "Загрузка настроек…",
      "Загрузка…"
    ].some((label) => text.includes(label));
  }, undefined, { timeout: 20_000 });
}

async function expectPath(page: Page, expected: string) {
  await expect.poll(() => pathname(page)).toBe(expected);
}

function pathname(page: Page) {
  return new URL(page.url()).pathname;
}

function statusLabel(status: string) {
  if (status === "closed") return "Закрыт";
  if (status === "draft") return "Черновик";
  return "В работе";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
