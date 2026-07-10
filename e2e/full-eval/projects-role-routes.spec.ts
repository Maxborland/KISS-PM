import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../..");
const EVIDENCE_ROOT = resolve(REPO_ROOT, ".superloopy/evidence/projects-2026-07-10");
const SCREENSHOT_DIR = resolve(EVIDENCE_ROOT, "role-routes/screenshots");
const REPORT_PATH = resolve(EVIDENCE_ROOT, "projects-role-routes.json");

const ROLES = [
  { role: "admin", email: "admin@kiss-pm.local", password: "admin12345" },
  { role: "engineer", email: "engineer@kiss-pm.local", password: "engineer12345" },
  {
    role: "planReader",
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345"
  },
  {
    role: "resourceReader",
    email: "resource-reader@kiss-pm.local",
    password: "resource12345"
  },
  { role: "beta", email: "beta@kiss-pm.local", password: "beta12345" }
] as const;

const PROJECT_SLUGS = [
  "",
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

type Project = { id: string; title: string };
type UiState = "ready" | "empty" | "forbidden" | "error";
type EvidenceRow = {
  role: string;
  route: string;
  projectsApiStatus: number;
  projectsCount: number;
  expectedUiState: UiState;
  uiState: UiState;
  finalUrl: string;
  apiResponses: Array<{ status: number; path: string }>;
  screenshot: string;
  alphaLeak: boolean;
  status: "PASS" | "FAIL";
  error: string;
};

test("Projects role x every route state matrix", async ({ browser }, testInfo) => {
  test.setTimeout(8 * 60_000);
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const rows: EvidenceRow[] = [];
  const failures: string[] = [];
  const alphaTitles = new Set<string>();
  let alphaProjectId = "";

  for (const role of ROLES) {
    const context = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      locale: "ru-RU"
    });
    const page = await context.newPage();
    const routeResponses: Array<{ status: number; path: string }> = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/workspace/projects")) {
        routeResponses.push({ status: response.status(), path: url.pathname });
      }
    });

    try {
      await login(page, role.email, role.password);
      const projectsResponse = await page.request.get("/api/workspace/projects");
      const projectsApiStatus = projectsResponse.status();
      const projectsBody =
        projectsApiStatus === 200
          ? ((await projectsResponse.json()) as { projects?: Project[] })
          : { projects: [] };
      const projects = projectsBody.projects ?? [];

      if (role.role === "admin") {
        expect(projects.length).toBeGreaterThan(0);
        alphaProjectId = projects[0]!.id;
        for (const project of projects) alphaTitles.add(project.title);
      }
      expect(alphaProjectId).not.toBe("");

      const targetProjectId = projects[0]?.id ?? alphaProjectId;
      const routes = [
        "/projects",
        `/projects/${targetProjectId}`,
        ...PROJECT_SLUGS.filter(Boolean).map(
          (slug) => `/projects/${targetProjectId}/${slug}`
        )
      ];
      expect(routes).toHaveLength(11);

      for (const route of routes) {
        routeResponses.length = 0;
        const row: EvidenceRow = {
          role: role.role,
          route,
          projectsApiStatus,
          projectsCount: projects.length,
          expectedUiState: getExpectedUiState(
            projectsApiStatus,
            projects.length,
            route
          ),
          uiState: "error",
          finalUrl: "",
          apiResponses: [],
          screenshot: "",
          alphaLeak: false,
          status: "FAIL",
          error: ""
        };

        try {
          await page.goto(route);
          await waitForSettledSurface(page);
          row.finalUrl = page.url();
          row.uiState = await detectUiState(page);
          row.apiResponses = [...routeResponses];

          const bodyText = await page.locator("body").innerText();
          row.alphaLeak =
            projects.length === 0 &&
            [...alphaTitles].some((title) => bodyText.includes(title));

          expect(row.uiState).toBe(row.expectedUiState);
          if (projects.length === 0) {
            expect(row.alphaLeak).toBe(false);
          }

          row.status = "PASS";
        } catch (error) {
          row.error = error instanceof Error ? error.message : String(error);
          failures.push(`${role.role} ${route}: ${row.error}`);
        } finally {
          const screenshotPath = resolve(
            SCREENSHOT_DIR,
            `${role.role}-${slug(route)}.png`
          );
          try {
            await page.screenshot({ path: screenshotPath });
            row.screenshot = relative(REPO_ROOT, screenshotPath).replaceAll("\\", "/");
          } catch (error) {
            const screenshotError = error instanceof Error ? error.message : String(error);
            row.status = "FAIL";
            row.error = row.error
              ? `${row.error}\nScreenshot: ${screenshotError}`
              : `Screenshot: ${screenshotError}`;
            failures.push(`${role.role} ${route} screenshot: ${screenshotError}`);
          } finally {
            rows.push(row);
          }
        }
      }
    } catch (error) {
      failures.push(
        `${role.role} setup: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await context.close();
    }
  }

  writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseURL: String(testInfo.project.use.baseURL),
        roles: ROLES.map(({ role, email }) => ({ role, email })),
        rows,
        summary: {
          total: rows.length,
          pass: rows.filter((row) => row.status === "PASS").length,
          fail: rows.filter((row) => row.status === "FAIL").length,
          states: Object.fromEntries(
            (["ready", "empty", "forbidden", "error"] as const).map((state) => [
              state,
              rows.filter((row) => row.uiState === state).length
            ])
          )
        },
        failures
      },
      null,
      2
    ),
    "utf8"
  );

  expect(rows).toHaveLength(ROLES.length * 11);
  expect(failures).toEqual([]);
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
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

async function detectUiState(page: Page): Promise<UiState> {
  const text = await page.locator("body").innerText();
  if (text.includes("Доступ ограничен")) return "forbidden";
  if (
    text.includes("Не удалось загрузить") ||
    text.includes("Ошибка загрузки") ||
    text.includes("Произошла ошибка")
  ) {
    return "error";
  }
  if (text.includes("Нет проектов") || text.includes("Проект не найден")) return "empty";
  return "ready";
}

function getExpectedUiState(
  projectsApiStatus: number,
  projectsCount: number,
  route: string
): UiState {
  if (projectsApiStatus === 403) return "forbidden";
  if (projectsCount > 0) return "ready";
  const routeSegments = route.split("/").filter(Boolean);
  return routeSegments.length <= 2 ? "empty" : "error";
}

function slug(route: string) {
  return route.replace(/^\/+|\/+$/g, "").replaceAll("/", "-") || "root";
}