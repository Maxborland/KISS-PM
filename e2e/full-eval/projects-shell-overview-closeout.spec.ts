import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../..");
const EVIDENCE_ROOT = resolve(REPO_ROOT, ".superloopy/evidence/project-shell-overview-2026-07-11");
const RECEIPT_PATH = resolve(EVIDENCE_ROOT, "project-shell-overview-machine.json");
const RUN_ID = process.env.PROJECT_SHELL_CLOSEOUT_RUN_ID ?? `project-shell-${Date.now()}`;

const USERS = {
  admin: { email: "admin@kiss-pm.local", password: "admin12345" },
  planReader: { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" },
  resourceReader: { email: "resource-reader@kiss-pm.local", password: "resource12345" }
} as const;

type Role = keyof typeof USERS;
type Bundle = "P01" | "P02" | "P03" | "P04" | "P05" | "P06" | "P07";
type Project = {
  id: string;
  title: string;
  clientName: string;
  status: string;
  plannedStart: string;
  plannedFinish: string;
  contractValue: number;
  plannedHours: number;
  demand: Array<{ positionId: string; requiredHours: number }>;
};
type DetailTask = {
  id: string;
  title: string;
  statusCategory: string;
  statusName: string;
  ownerUserId: string | null;
  plannedFinish: string;
  progress: number;
  requiresAcceptance: boolean;
  plannedWork: number;
  actualWork: number;
};
type ProjectDetail = { project: Project; tasks: DetailTask[] };
type PlanTask = {
  id: string;
  title: string;
  wbsCode: string;
  durationMinutes: number | null;
  workMinutes: number;
  percentComplete: number;
  statusId: string;
  plannedFinish: string | null;
  customFields?: Record<string, unknown>;
};
type ReadModel = {
  planVersion: number;
  project: { deadline: string | null };
  authored: { tasks: PlanTask[] };
  calculatedPlan: {
    projectFinish: string | null;
    criticalPathTaskIds: string[];
    tasks: Array<{ id: string; calculatedFinish: string | null; isCritical: boolean; totalSlackMinutes: number | null }>;
  };
  resourceLoad: { overloads: Array<{ granularity: string; resourceId: string; date: string }> };
  baselineComparison: { tasks: Array<{ taskId: string; baselineFinish: string | null }> };
  validationIssues: unknown[];
};
type ReceiptRow = {
  scenarioId: string;
  role: Role;
  bundle: Bundle;
  key: string;
  status: "pending" | "pass";
  runId: string;
  generatedAt: string | null;
  assertions: string[];
  screenshots: string[];
};

const ALL_ROLES: Role[] = ["admin", "planReader", "resourceReader"];
const READ_ROLES: Role[] = ["admin", "planReader"];

function targetRows(ids: string[], roles: Role[], bundle: Bundle) {
  return ids.flatMap((scenarioId) => roles.map((role) => ({ scenarioId, role, bundle, key: `${scenarioId}:${role}` })));
}

const targets = [
  ...targetRows(["PROJ-001", "PROJ-002", "PROJ-003", "PROJ-004", "PROJ-005", "PROJ-006", "PROJ-007"], ALL_ROLES, "P01"),
  ...targetRows(["PROJ-008", "PROJ-009", "PROJ-010", "PROJ-011", "PROJ-012"], READ_ROLES, "P02"),
  ...targetRows(["PROJ-013"], ALL_ROLES, "P03"),
  ...targetRows(["PROJ-014"], ["resourceReader"], "P03"),
  ...targetRows(["PROJ-015", "PROJ-016", "PROJ-017", "PROJ-018", "PROJ-019", "PROJ-020"], READ_ROLES, "P04"),
  ...targetRows(["PROJ-021"], ALL_ROLES, "P05"),
  ...targetRows(["PROJ-022"], ["resourceReader"], "P05"),
  ...targetRows(["PROJ-023", "PROJ-024", "PROJ-025", "PROJ-026", "PROJ-027", "PROJ-028", "PROJ-029"], READ_ROLES, "P06"),
  ...targetRows(["PROJ-030"], ALL_ROLES, "P07")
];

const rows = new Map<string, ReceiptRow>(targets.map((target) => [target.key, {
  ...target,
  status: "pending",
  runId: RUN_ID,
  generatedAt: null,
  assertions: [],
  screenshots: []
}]));
const sourceFiles = [
  "e2e/full-eval/projects-shell-overview-closeout.spec.ts",
  "apps/web/src/delivery/ui/workspace-shell.tsx",
  "apps/web/src/delivery/ui/global-search.tsx",
  "apps/web/src/delivery/ui/delivery-frame.tsx",
  "apps/web/src/workspace/projects/projects-list-surface.tsx",
  "apps/web/src/workspace/project-detail/project-detail-surface.tsx",
  "apps/web/src/delivery/overview/overview-surface.tsx",
  "apps/web/src/delivery/overview/overview-status.ts",
  "apps/web/src/delivery/lib/project-chrome.ts",
  "apps/web/src/delivery/lib/use-planning.ts",
  "apps/web/src/lib/domain-client.ts"
];
const sourceStateAtStart = sourceState();
let primaryProject: Project | null = null;
let emptyProjectId = "";
let overviewFixtureModel: ReadModel | null = null;
test.describe.serial("Project shell/list/detail/Overview literal closeout: 68 role rows", () => {
  test.beforeAll(() => {
    mkdirSync(EVIDENCE_ROOT, { recursive: true });
    expect(targets).toHaveLength(68);
    expect(new Set(targets.map((target) => target.key)).size).toBe(68);
  });

  test("P01 shared shell and project chrome for every role", async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    for (const role of ALL_ROLES) {
      await withRole(browser, role, testInfo, async (page) => {
        const projectResponse = await page.request.get("/api/workspace/projects");
        if (role === "admin") {
          expect(projectResponse.status()).toBe(200);
          const projects = ((await projectResponse.json()) as { projects: Project[] }).projects;
          expect(projects.length).toBeGreaterThanOrEqual(2);
          const candidates: Array<{ project: Project; taskCount: number }> = [];
          for (const candidate of projects) {
            const readResponse = await page.request.get("/api/workspace/projects/" + candidate.id + "/planning/read-model");
            if (readResponse.status() !== 200) continue;
            const readModel = (await readResponse.json()) as ReadModel;
            candidates.push({ project: candidate, taskCount: readModel.authored.tasks.length });
          }
          candidates.sort((left, right) => right.taskCount - left.taskCount);
          primaryProject = candidates[0]?.project ?? projects[0]!;
        }
        expect(primaryProject).not.toBeNull();
        const project = primaryProject!;
        const overviewHref = "/projects/" + project.id + "/overview";
        await page.goto(overviewHref);
        await waitSettled(page);

        const sidebar = page.getByRole("navigation", { name: "Основная навигация" });
        await expect(sidebar).toBeVisible();
        const expectedSidebarHrefs = role === "admin"
          ? ["/my-work", "/projects", "/crm/deals", "/dashboard", "/communications/chat", "/admin"]
          : role === "planReader"
            ? ["/my-work", "/projects", "/dashboard"]
            : [];
        await expect.poll(() => sidebar.locator("a[href]").evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("href"))
        )).toEqual(expectedSidebarHrefs);
        expect(await sidebar.locator("span[title*='Демо'], [aria-disabled='true']").count()).toBe(0);
        for (const href of expectedSidebarHrefs) {
          const link = page.getByRole("navigation", { name: "Основная навигация" }).locator('a[href="' + href + '"]');
          await expect(link).toHaveCount(1);
          await link.click();
          await expectPath(page, href === "/admin" ? "/admin/users" : href);
        await page.goBack({ waitUntil: "commit" });
          await expectPath(page, overviewHref);
          await waitSettled(page);
        }
        const sidebarScreenshot = await captureScenarioState(page, "PROJ-001", role, "role-aware-links");
        recordScenario("PROJ-001", role, [
          "Compared the exact visible sidebar href set with the authenticated role",
          "Clicked every visible sidebar link and verified destination plus browser Back",
          "Confirmed resourceReader has no inaccessible project navigation"
        ], [sidebarScreenshot]);

        const search = page.getByRole("combobox", { name: "Глобальный поиск" });
        await expect(search).toBeEnabled();
        const searchResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/workspace/search");
        await search.fill(project.title);
        const response = await searchResponse;
        const searchScreenshots: string[] = [];
        if (role === "resourceReader") {
          expect(response.status()).toBe(200);
          const body = (await response.json()) as { results: Array<{ type: string; title: string; route: string }> };
          expect(body.results.filter((item) => item.type === "project" || item.route.startsWith("/projects/"))).toEqual([]);
          await expect(page.getByText(`Ничего не найдено по «${project.title}»`, { exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: /^Проект / })).toHaveCount(0);
          searchScreenshots.push(await captureScenarioState(page, "PROJ-002", role, "acl-filtered-no-leak"));
        } else {
          expect(response.status()).toBe(200);
          const body = (await response.json()) as { results: Array<{ title: string; route: string }> };
          const result = body.results.find((item) => item.title === project.title && item.route.startsWith("/projects/"));
          expect(result).toBeTruthy();
          const projectResult = page.getByRole("button", { name: /^Проект / }).filter({ hasText: project.title });
          await expect(projectResult).toBeVisible();
          searchScreenshots.push(await captureScenarioState(page, "PROJ-002", role, "live-result"));
          await search.press("Enter");
          await expectPath(page, new URL(result!.route, "http://local").pathname);
          searchScreenshots.push(await captureScenarioState(page, "PROJ-002", role, "keyboard-navigation"));
          await page.goto(overviewHref);
          await waitSettled(page);
        }
        recordScenario("PROJ-002", role, [
          role === "resourceReader"
            ? "Search returned 200 with ACL-filtered empty results, an explicit no-matches state, and no project route leak"
            : "Search returned the live project and Enter navigated to the API-provided route",
          "The global search combobox was enabled and keyboard-operable"
        ], searchScreenshots);

        const meResponse = await page.request.get("/api/auth/me");
        expect(meResponse.status()).toBe(200);
        const me = (await meResponse.json()) as { user: { id: string; name: string } };
        const userButton = page.locator('button[aria-haspopup="menu"]');
        await expect(userButton).toHaveAttribute("title", me.user.name);
        await userButton.click();
        const menu = page.getByRole("menu");
        await expect(menu).toContainText(me.user.name);
        await expect(menu).toContainText(me.user.id);
        await expect(menu.getByRole("menuitem", { name: /Профиль/ })).toHaveAttribute("href", "/profile");
        await expect(menu.getByRole("menuitem", { name: /Настройки/ })).toHaveAttribute("href", "/settings");
        await expect(menu.getByRole("menuitem", { name: "Выйти" })).toBeVisible();
        const identityScreenshots = [
          await captureScenarioState(page, "PROJ-003", role, "live-user-menu")
        ];
        await page.locator("div.fixed.inset-0.z-10").click({ position: { x: 1, y: 1 } });
        await expect(menu).toHaveCount(0);

        const tabSlugs = ["overview", "schedule", "resources", "assignments", "calendars", "scenarios", "baseline", "commits", "settings"];
        const expectedTabHrefs = tabSlugs.map((slug) => "/projects/" + project.id + "/" + slug);
        const tabScreenshots: string[] = [];
        const headerScreenshots: string[] = [];
        for (const slug of tabSlugs) {
          const href = "/projects/" + project.id + "/" + slug;
          await page.goto(href);
          await waitSettled(page);
          const tabNav = page.getByRole("navigation").filter({ has: page.locator('a[href="' + href + '"]') });
          const actualTabHrefs = await tabNav.locator("a[href]").evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href"))
          );
          expect(actualTabHrefs).toEqual(expectedTabHrefs);
          await expect(tabNav.locator('[aria-current="page"]')).toHaveAttribute("href", href);
          if (role === "resourceReader") {
            await expect(page.locator("h1")).not.toContainText(project.title);
            await expect(page.locator("body")).not.toContainText(project.title);
          } else {
            await expect(page.locator("h1")).toContainText(project.title);
            await expect(page.getByText("В работе", { exact: true })).toBeVisible();
            await expect(page.getByText(/план v\d+/)).toBeVisible();
          }
          await expect(page.getByText("Сохранено", { exact: true })).toHaveCount(0);
          await expect(page.getByText(/Прототип|in-memory/i)).toHaveCount(0);
          tabScreenshots.push(await captureScenarioState(page, "PROJ-004", role, "route-" + slug));
          headerScreenshots.push(await captureScenarioState(page, "PROJ-005", role, "route-" + slug));
        }

        if (role === "admin") {
          const scheduleHref = "/projects/" + project.id + "/schedule";
          await page.goto(scheduleHref);
          await waitSettled(page);
          const beforeResponse = await page.request.get("/api/workspace/projects/" + project.id + "/planning/read-model");
          expect(beforeResponse.status()).toBe(200);
          const beforeVersion = ((await beforeResponse.json()) as ReadModel).planVersion;
          await page.getByRole("button", { name: "Пакет", exact: true }).click();
          const quickCreate = page.getByPlaceholder("Новая задача — Enter (Tab — подзадачей)", { exact: true });
          await quickCreate.fill("Full eval staged navigation guard");
          await quickCreate.press("Enter");
          await expect(page.getByText("Пакет правок", { exact: true })).toBeVisible();
          await expect(page.locator("body")).toContainText("накоплено: 1");
          tabScreenshots.push(await captureScenarioState(page, "PROJ-004", role, "staged-before-leave"));
          page.once("dialog", async (dialog) => dialog.dismiss());
          await page.locator('a[href="' + overviewHref + '"]').click();
          await expectPath(page, scheduleHref);
          await expect(page.locator("body")).toContainText("накоплено: 1");
          tabScreenshots.push(await captureScenarioState(page, "PROJ-004", role, "cancel-keeps-staged"));
          page.once("dialog", async (dialog) => dialog.accept());
          await page.locator('a[href="' + overviewHref + '"]').click();
          await expectPath(page, overviewHref);
          await waitSettled(page);
          const afterResponse = await page.request.get("/api/workspace/projects/" + project.id + "/planning/read-model");
          expect(afterResponse.status()).toBe(200);
          expect(((await afterResponse.json()) as ReadModel).planVersion).toBe(beforeVersion);
          tabScreenshots.push(await captureScenarioState(page, "PROJ-004", role, "leave-discards-without-write"));
        } else {
          await page.goto("/projects/" + project.id + "/schedule");
          await waitSettled(page);
          await expect(page.getByRole("button", { name: "Пакет", exact: true })).toHaveCount(0);
          tabScreenshots.push(await captureScenarioState(page, "PROJ-004", role, "read-only-no-staging"));
        }

        recordScenario("PROJ-004", role, [
          "Visited all nine project-specific routes and compared the complete tab href set",
          "Verified exactly one aria-current tab on every route",
          role === "admin"
            ? "Dismissed staged-leave confirmation, then accepted it and proved no planning version write"
            : "Verified the read-only role exposes no batch staging control"
        ], tabScreenshots);
        recordScenario("PROJ-005", role, [
          role === "resourceReader"
            ? "Visited all nine routes and verified no requested project identity leaked through forbidden states"
            : "Visited all nine routes and verified live title, status, and plan version",
          "Captured route-specific header evidence for every delivery surface"
        ], headerScreenshots);

        await page.goto(overviewHref);
        await waitSettled(page);
        await expect(page.getByText("Сохранено", { exact: true })).toHaveCount(0);
        const savedScreenshot = await captureScenarioState(page, "PROJ-006", role, "fake-saved-absent");
        recordScenario("PROJ-006", role, [
          "The live project chrome contained no hard-coded saved indicator"
        ], [savedScreenshot]);

        await expect(page.getByText(/Прототип|in-memory/i)).toHaveCount(0);
        const prototypeScreenshot = await captureScenarioState(page, "PROJ-007", role, "live-copy");
        recordScenario("PROJ-007", role, [
          "Prototype and in-memory disclaimers were absent from the live route after all route traversal"
        ], [prototypeScreenshot]);

        await userButton.click();
        await expect(page.getByRole("menu")).toBeVisible();
        await page.getByRole("menuitem", { name: "Выйти" }).click();
        await page.waitForURL("**/login");
        identityScreenshots.push(await captureScenarioState(page, "PROJ-003", role, "logout-redirect"));
        recordScenario("PROJ-003", role, [
          "User-menu title and body matched GET /api/auth/me",
          "Profile and Settings were canonical menu links",
          "Logout ended the session and redirected to /login"
        ], identityScreenshots);
      });
    }
  });
  test("P02 projects list loading, live rows, honest active scope, navigation, and empty", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    for (const role of READ_ROLES) {
      await withRole(browser, role, testInfo, async (page) => {
        await page.addInitScript(() => {
          const originalFetch = window.fetch;
          window.fetch = async (...args) => {
            const input = args[0];
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            if (new URL(url, window.location.origin).pathname === "/api/workspace/projects") {
              await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
            }
            return originalFetch(...args);
          };
        });
        const navigation = page.goto("/projects");
        await expect(page.getByText("Загрузка проектов…", { exact: true })).toBeVisible();
        const loadingScreenshot = await captureScenarioState(page, "PROJ-008", role, "delayed-live-request");
        await navigation;
        await waitSettled(page);
        recordScenario("PROJ-008", role, [
          "Captured the loading surface while the real projects fetch was deliberately delayed",
          "The loading label disappeared only after the live response resolved"
        ], [loadingScreenshot]);

        const response = await page.request.get("/api/workspace/projects");
        expect(response.status()).toBe(200);
        const projects = ((await response.json()) as { projects: Project[] }).projects;
        expect(projects.length).toBeGreaterThan(0);
        expect(projects.every((project) => project.status === "active")).toBe(true);
        expect(await page.getByRole("columnheader").allTextContents()).toEqual([
          "Проект", "Клиент", "Статус", "Срок", "Сумма", "План.часы", "Спрос"
        ]);
        await expect(page.locator("tbody tr")).toHaveCount(projects.length);
        for (const project of projects) {
          const href = "/projects/" + project.id;
          const link = page.locator('tbody a[href="' + href + '"]').filter({ hasText: project.title });
          await expect(link).toHaveCount(1);
          expect(await link.evaluate((node) => node.tagName)).toBe("A");
          const row = link.locator("xpath=ancestor::tr[1]");
          await expect(row).toContainText(project.clientName);
          await expect(row).toContainText("Активен");
          await expect(row).toContainText(formatProjectDate(project.plannedStart) + " — " + formatProjectDate(project.plannedFinish));
          await expect(row).toContainText(formatProjectMoney(project.contractValue));
          await expect(row).toContainText(project.plannedHours.toLocaleString("ru-RU") + " ч");
          if (project.demand.length === 0) {
            await expect(row).toContainText("—");
          } else {
            for (const demand of project.demand) {
              await expect(row).toContainText(demand.positionId + " · " + demand.requiredHours + " ч");
            }
          }
        }
        const liveRowsScreenshot = await captureScenarioState(page, "PROJ-009", role, "live-api-readback");

        await expect(page.getByRole("button", { name: "Все", exact: true })).toHaveCount(0);
        await expect(page.getByText("Активные проекты рабочей области", { exact: true })).toBeVisible();
        const activeScopeScreenshot = await captureScenarioState(page, "PROJ-010", role, "active-only-honest-scope");
        recordScenario("PROJ-010", role, [
          "The live API returned only active projects",
          "The unsupported All filter was absent and the surface explicitly stated active-project scope"
        ], [activeScopeScreenshot]);

        const first = projects[0]!;
        const firstHref = "/projects/" + first.id;
        await page.locator('tbody a[href="' + firstHref + '"]').click();
        await expectPath(page, firstHref);
        const detailScreenshot = await captureScenarioState(page, "PROJ-011", role, "native-link-destination");
        await page.goBack({ waitUntil: "commit" });
        await waitSettled(page);
        await expectPath(page, "/projects");
        const backScreenshot = await captureScenarioState(page, "PROJ-011", role, "browser-back-readback");
        recordScenario("PROJ-011", role, [
          "Every live project title was an A element with its canonical detail href",
          "Clicked a project title, verified the final URL, and restored the list with browser Back"
        ], [detailScreenshot, backScreenshot]);

        const edgeProject: Project = {
          ...first,
          id: "project-list-edge-" + role.toLowerCase(),
          title: "Project list edge " + role,
          clientName: "Unknown client " + role,
          status: "active",
          plannedStart: "invalid-date",
          plannedFinish: "",
          contractValue: 0,
          plannedHours: 0,
          demand: []
        };
        await page.route("**/api/workspace/projects", (route) => route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ projects: [edgeProject] })
        }));
        await page.reload();
        await waitSettled(page);
        const edgeRow = page.locator("tbody tr");
        await expect(edgeRow).toHaveCount(1);
        await expect(edgeRow).toContainText("invalid-date");
        await expect(edgeRow).toContainText("0 тыс ₽");
        await expect(edgeRow).toContainText("0 ч");
        await expect(edgeRow).toContainText("—");
        const edgeScreenshot = await captureScenarioState(page, "PROJ-009", role, "zero-invalid-date-empty-demand");
        recordScenario("PROJ-009", role, [
          "Compared every live row field and format with GET /api/workspace/projects",
          "Verified zero money/hours, invalid-date passthrough, empty demand, and unknown-directory fallback state"
        ], [liveRowsScreenshot, edgeScreenshot]);
        await page.unroute("**/api/workspace/projects");

        await page.route("**/api/workspace/projects", (route) => route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ projects: [] })
        }));
        await page.reload();
        await waitSettled(page);
        await expect(page.getByText("Нет проектов", { exact: true })).toBeVisible();
        const crmLink = page.getByRole("link", { name: "К сделкам", exact: true });
        await expect(crmLink).toHaveAttribute("href", "/crm/deals");
        await expect(page.locator('a[href^="/projects/"]')).toHaveCount(0);
        const emptyScreenshot = await captureScenarioState(page, "PROJ-012", role, "true-empty-response");
        recordScenario("PROJ-012", role, [
          "A true empty active-project response rendered the explicit empty state",
          "The empty state exposed a real CRM link and no false project-detail links"
        ], [emptyScreenshot]);
      });
    }
  });
  test("P03 projects list error/retry and resourceReader denial", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    for (const role of ALL_ROLES) {
      await withRole(browser, role, testInfo, async (page) => {
        await page.addInitScript(() => {
          const originalFetch = window.fetch;
          let consumed = false;
          window.fetch = async (...args) => {
            const input = args[0];
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const path = new URL(url, window.location.origin).pathname;
            const fault = new URL(window.location.href).searchParams.get("evalFault");
            if (!consumed && path === "/api/workspace/projects" && fault) {
              consumed = true;
              if (fault === "http") {
                return new Response(JSON.stringify({ error: "load_failed" }), {
                  status: 500,
                  headers: { "content-type": "application/json" }
                });
              }
              if (fault === "json") {
                return new Response("{", { status: 200, headers: { "content-type": "application/json" } });
              }
              if (fault === "network") {
                throw new TypeError("full-eval-network-failure");
              }
            }
            return originalFetch(...args);
          };
        });

        const faults = [
          { mode: "http", message: "Не удалось загрузить проекты" },
          { mode: "network", message: "Запрос не выполнен" },
          { mode: "json", message: "Некорректный ответ сервера" }
        ];
        const scenarioScreenshots: string[] = [];
        for (const fault of faults) {
          await page.goto("/projects?evalFault=" + fault.mode);
          await waitSettled(page);
          await expect(page.getByText(fault.message, { exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Повторить", exact: true })).toBeVisible();
          scenarioScreenshots.push(await captureScenarioState(page, "PROJ-013", role, fault.mode + "-error"));
          await page.getByRole("button", { name: "Повторить", exact: true }).click();
          await waitSettled(page);
          if (role === "resourceReader") {
            await expect(page.getByText("Доступ ограничен", { exact: true })).toBeVisible();
            if (primaryProject) await expect(page.locator("body")).not.toContainText(primaryProject.title);
            scenarioScreenshots.push(await captureScenarioState(page, "PROJ-013", role, fault.mode + "-retry-forbidden"));
          } else {
            await expect(page.locator("tbody tr").first()).toBeVisible();
            scenarioScreenshots.push(await captureScenarioState(page, "PROJ-013", role, fault.mode + "-retry-live"));
          }
        }
        recordScenario("PROJ-013", role, [
          "Forced and observed HTTP 500, network failure, and malformed successful JSON as distinct RU error states",
          role === "resourceReader"
            ? "Each Retry reached the live backend and settled into the role-correct forbidden state"
            : "Each Retry reached the live backend and restored project rows",
          "Captured every error and post-Retry state separately"
        ], scenarioScreenshots);

        if (role === "resourceReader") {
          const response = await page.request.get("/api/workspace/projects");
          expect(response.status()).toBe(403);
          await page.goto("/projects");
          await waitSettled(page);
          await expect(page.getByText("Доступ ограничен", { exact: true })).toBeVisible();
          await expect(page.getByText("Загрузка проектов…", { exact: true })).toHaveCount(0);
          if (primaryProject) await expect(page.locator("body")).not.toContainText(primaryProject.title);
          const forbiddenScreenshot = await captureScenarioState(page, "PROJ-014", role, "live-403-no-leak");
          recordScenario("PROJ-014", role, [
            "Direct projects API returned 403 for resourceReader",
            "The UI rendered a human-readable forbidden state, stopped loading, and leaked no project identity"
          ], [forbiddenScreenshot]);
        }
      });
    }
  });
  test("P04 detail canonical selection, live fields/tasks, and real zero-task project", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    for (const role of READ_ROLES) {
      await withRole(browser, role, testInfo, async (page) => {
        const projects = await getProjects(page);
        expect(projects.length).toBeGreaterThanOrEqual(2);
        const first = projects.find((project) => project.id === primaryProject?.id) ?? projects[0]!;
        const second = projects.find((project) => project.id !== first.id)!;
        await page.goto("/projects/" + first.id);
        await waitSettled(page);
        const detailResponse = await page.request.get("/api/workspace/projects/" + first.id);
        expect(detailResponse.status()).toBe(200);
        const detail = (await detailResponse.json()) as ProjectDetail;
        const header = page.getByRole("heading", { name: detail.project.title, exact: true }).locator("xpath=ancestor::section[1]");
        await expect(header).toContainText(detail.project.clientName);
        await expect(header).toContainText(detail.project.status === "active" ? "В работе" : detail.project.status);
        await expect(header).toContainText(formatProjectDate(detail.project.plannedStart));
        await expect(header).toContainText(formatProjectDate(detail.project.plannedFinish));
        await expect(header).toContainText(formatProjectMoney(detail.project.contractValue));
        await expect(header).toContainText(detail.project.plannedHours.toLocaleString("ru-RU") + " ч");
        await expect(header).toContainText(String(detail.tasks.length));
        const liveHeaderScreenshot = await captureScenarioState(page, "PROJ-017", role, "live-header-readback");

        const edgeProject: Project = {
          ...detail.project,
          title: "Long project title for full evaluation " + role + " ".repeat(20),
          clientName: "Long client name for full evaluation " + role + " ".repeat(20),
          plannedFinish: "",
          contractValue: 0,
          plannedHours: 0
        };
        await page.route("**/api/workspace/projects/" + first.id, (route) => route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ project: edgeProject, tasks: detail.tasks })
        }));
        await page.reload();
        await waitSettled(page);
        const edgeHeader = page.getByRole("heading", { name: edgeProject.title, exact: true }).locator("xpath=ancestor::section[1]");
        await expect(edgeHeader).toContainText(edgeProject.clientName);
        await expect(edgeHeader).toContainText("—");
        await expect(edgeHeader).toContainText("0 тыс ₽");
        await expect(edgeHeader).toContainText("0 ч");
        const edgeHeaderScreenshot = await captureScenarioState(page, "PROJ-017", role, "zero-null-long-values");
        recordScenario("PROJ-017", role, [
          "Compared title, client, status, dates, money, planned hours, and task count with the live detail response",
          "Verified long title/client, absent finish, zero contract value, and zero planned hours"
        ], [liveHeaderScreenshot, edgeHeaderScreenshot]);
        await page.unroute("**/api/workspace/projects/" + first.id);
        await page.reload();
        await waitSettled(page);

        const expectedTasks = [...detail.tasks].sort((left, right) => {
          const leftDone = left.statusCategory === "done" ? 1 : 0;
          const rightDone = right.statusCategory === "done" ? 1 : 0;
          if (leftDone !== rightDone) return leftDone - rightDone;
          return left.plannedFinish.localeCompare(right.plannedFinish);
        });
        expect(await page.locator("tbody tr td:first-child > div:first-child").allTextContents())
          .toEqual(expectedTasks.map((task) => task.title));
        for (const task of expectedTasks) {
          const row = page.locator("tbody tr").filter({ hasText: task.title });
          await expect(row).toContainText(task.statusName);
          await expect(row).toContainText(formatProjectDate(task.plannedFinish));
          await expect(row).toContainText(Math.min(100, Math.max(0, task.progress)) + "%");
          if (task.requiresAcceptance) await expect(row).toContainText("требует приёмки");
        }
        const liveTasksScreenshot = await captureScenarioState(page, "PROJ-018", role, "live-sorted-task-readback");

        const templateTask = detail.tasks[0]!;
        const edgeTasks: DetailTask[] = [
          {
            ...templateTask,
            id: "edge-open-" + role,
            title: "Edge open task " + role,
            statusCategory: "unknown",
            statusName: "Unknown status",
            ownerUserId: null,
            plannedFinish: "2029-12-31",
            progress: 150,
            requiresAcceptance: true
          },
          {
            ...templateTask,
            id: "edge-done-" + role,
            title: "Edge done task " + role,
            statusCategory: "done",
            statusName: "Готово",
            ownerUserId: null,
            plannedFinish: "2020-01-01",
            progress: -10,
            requiresAcceptance: false
          }
        ];
        await page.route("**/api/workspace/projects/" + first.id, (route) => route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ project: detail.project, tasks: edgeTasks })
        }));
        await page.reload();
        await waitSettled(page);
        expect(await page.locator("tbody tr td:first-child > div:first-child").allTextContents())
          .toEqual(["Edge open task " + role, "Edge done task " + role]);
        const openEdgeRow = page.locator("tbody tr").filter({ hasText: "Edge open task " + role });
        await expect(openEdgeRow).toContainText("Unknown status");
        await expect(openEdgeRow).toContainText("—");
        await expect(openEdgeRow).toContainText("100%");
        await expect(openEdgeRow).toContainText("требует приёмки");
        const doneEdgeRow = page.locator("tbody tr").filter({ hasText: "Edge done task " + role });
        await expect(doneEdgeRow).toContainText("0%");
        const edgeTasksScreenshot = await captureScenarioState(page, "PROJ-018", role, "nullable-unknown-clamped");
        recordScenario("PROJ-018", role, [
          "Compared exact UI task order with unfinished-first then planned-finish sorting",
          "Compared status, finish, progress, and acceptance copy for every live task",
          "Verified nullable owner, unknown status, acceptance marker, and progress clamping to 0..100"
        ], [liveTasksScreenshot, edgeTasksScreenshot]);
        await page.unroute("**/api/workspace/projects/" + first.id);
        await page.reload();
        await waitSettled(page);

        const totalPlanned = detail.tasks.reduce((sum, task) => sum + task.plannedWork, 0);
        const totalActual = detail.tasks.reduce((sum, task) => sum + task.actualWork, 0);
        const weightedProgress = totalPlanned > 0
          ? Math.round(detail.tasks.reduce((sum, task) => sum + task.plannedWork * task.progress, 0) / totalPlanned)
          : 0;
        const done = detail.tasks.filter((task) => task.statusCategory === "done").length;
        const inProgress = detail.tasks.filter((task) => task.statusCategory === "in_progress").length;
        const open = detail.tasks.length - done;
        const detailSummary = page.locator("main aside");
        await expect(detailSummary.getByText("Прогресс", { exact: true }).locator("..")).toContainText(weightedProgress + "%");
        await expect(detailSummary.getByText("Прогресс", { exact: true }).locator("..")).toContainText(done + " закрыто · " + inProgress + " в работе");
        await expect(detailSummary.getByText("Открыто задач", { exact: true }).locator("..")).toContainText(String(open));
        await expect(detailSummary.getByText("План. трудоёмкость", { exact: true }).locator("..")).toContainText(Math.round(totalPlanned).toLocaleString("ru-RU") + " ч");
        await expect(page.getByText("Факт. трудоёмкость", { exact: true }).locator("..")).toContainText(Math.round(totalActual).toLocaleString("ru-RU") + " ч");
        await page.getByRole("radiogroup").getByText("Спрос", { exact: true }).click();
        await expect(page.getByRole("radio", { name: "Спрос", exact: true })).toBeChecked();
        const demandTotal = detail.project.demand.reduce((sum, demand) => sum + demand.requiredHours, 0);
        await expect(page.getByRole("heading", { name: "Спрос по позициям", exact: true }).locator(".."))
          .toContainText(demandTotal.toLocaleString("ru-RU") + " ч");
        for (const demand of detail.project.demand) {
          const share = demandTotal > 0 ? Math.round(demand.requiredHours / demandTotal * 100) : 0;
          await expect(page.locator("li").filter({ hasText: demand.positionId }))
            .toContainText(demand.requiredHours + " ч · " + share + "%");
        }
        const liveSummaryScreenshot = await captureScenarioState(page, "PROJ-020", role, "live-weighted-volume-demand");

        const selector = page.getByLabel("Проект:");
        await selector.selectOption(second.id);
        await expectPath(page, "/projects/" + second.id);
        await waitSettled(page);
        await expect(page.getByRole("heading", { name: second.title, exact: true })).toBeVisible();
        const selectScreenshot = await captureScenarioState(page, "PROJ-015", role, "second-project-url-readback");
        await page.reload();
        await waitSettled(page);
        await expectPath(page, "/projects/" + second.id);
        await expect(page.getByRole("heading", { name: second.title, exact: true })).toBeVisible();
        const reloadScreenshot = await captureScenarioState(page, "PROJ-015", role, "reload-readback");
        await page.goBack({ waitUntil: "commit" });
        await waitSettled(page);
        await expectPath(page, "/projects/" + first.id);
        await expect(page.getByRole("heading", { name: first.title, exact: true })).toBeVisible();
        const backScreenshot = await captureScenarioState(page, "PROJ-015", role, "back-readback");
        await page.goForward({ waitUntil: "commit" });
        await waitSettled(page);
        await expectPath(page, "/projects/" + second.id);
        await expect(page.getByRole("heading", { name: second.title, exact: true })).toBeVisible();
        const forwardScreenshot = await captureScenarioState(page, "PROJ-015", role, "forward-readback");
        recordScenario("PROJ-015", role, [
          "Select changed both canonical URL and visible project identity",
          "Reload, browser Back, and browser Forward preserved URL-to-card agreement"
        ], [selectScreenshot, reloadScreenshot, backScreenshot, forwardScreenshot]);

        const missingId = "project-shell-missing-" + role.toLowerCase();
        const missing = await page.request.get("/api/workspace/projects/" + missingId);
        expect(missing.status()).toBe(404);
        await page.goto("/projects/" + missingId);
        await waitSettled(page);
        await expectPath(page, "/projects/" + missingId);
        await expect(page.getByText("Проект не найден", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: first.title, exact: true })).toHaveCount(0);
        const missingScreenshot = await captureScenarioState(page, "PROJ-016", role, "live-404");
        await page.reload();
        await waitSettled(page);
        await expectPath(page, "/projects/" + missingId);
        await expect(page.getByText("Проект не найден", { exact: true })).toBeVisible();
        const missingReloadScreenshot = await captureScenarioState(page, "PROJ-016", role, "reload-stays-404");
        recordScenario("PROJ-016", role, [
          "Direct API returned project_not_found and the UI preserved the unknown ID",
          "Reload kept the exact URL and explicit not-found state without substituting another project"
        ], [missingScreenshot, missingReloadScreenshot]);

        if (role === "admin") emptyProjectId = await createEmptyProject(page);
        expect(emptyProjectId).not.toBe("");
        await page.goto("/projects/" + emptyProjectId);
        await waitSettled(page);
        const emptyDetailResponse = await page.request.get("/api/workspace/projects/" + emptyProjectId);
        expect(emptyDetailResponse.status()).toBe(200);
        const emptyDetail = (await emptyDetailResponse.json()) as ProjectDetail;
        expect(emptyDetail.tasks).toEqual([]);
        await expect(page.getByText("У проекта пока нет задач.", { exact: true })).toBeVisible();
        const emptyTasksScreenshot = await captureScenarioState(page, "PROJ-019", role, "real-zero-task-project");
        recordScenario("PROJ-019", role, [
          role === "admin"
            ? "Created a project through opportunity feasibility and activation"
            : "Read the zero-task project created by the preceding admin write flow without claiming a planReader write",
          "Read back zero tasks from the live detail API and observed the explicit no-tasks state"
        ], [emptyTasksScreenshot]);

        const emptySummary = page.locator("main aside");
        await expect(emptySummary.getByText("Прогресс", { exact: true }).locator("..")).toContainText("0%");
        await expect(emptySummary.getByText("Открыто задач", { exact: true }).locator("..")).toContainText("0");
        await expect(emptySummary.getByText("План. трудоёмкость", { exact: true }).locator("..")).toContainText("0 ч");
        await expect(emptySummary.getByText("Факт. трудоёмкость", { exact: true }).locator("..")).toContainText("0 ч");
        await expect(page.locator("main")).not.toContainText("NaN");
        const emptyVolumeScreenshot = await captureScenarioState(page, "PROJ-020", role, "zero-work-no-nan");

        await page.route("**/api/workspace/projects/" + emptyProjectId, (route) => route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ project: { ...emptyDetail.project, demand: [] }, tasks: [] })
        }));
        await page.reload();
        await waitSettled(page);
        await page.getByRole("radiogroup").getByText("Спрос", { exact: true }).click();
        await expect(page.getByRole("radio", { name: "Спрос", exact: true })).toBeChecked();
        await expect(page.getByText("Спрос по позициям не задан.", { exact: true })).toBeVisible();
        const emptyDemandScreenshot = await captureScenarioState(page, "PROJ-020", role, "empty-demand");
        recordScenario("PROJ-020", role, [
          "Compared weighted progress, open/done/in-progress counts, planned work, and actual work with live tasks",
          "Compared every demand position hour/share and total with the live project",
          "Verified zero planned work produces 0 without NaN and empty demand has explicit copy"
        ], [liveSummaryScreenshot, emptyVolumeScreenshot, emptyDemandScreenshot]);
        await page.unroute("**/api/workspace/projects/" + emptyProjectId);
      });
    }
  });
  test("P05 detail loading/error/retry/not-found/forbidden states", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    for (const role of ALL_ROLES) {
      await withRole(browser, role, testInfo, async (page) => {
        expect(primaryProject).not.toBeNull();
        const project = primaryProject!;
        const detailPath = "/api/workspace/projects/" + project.id;
        await page.addInitScript(() => {
          const originalFetch = window.fetch;
          let consumed = false;
          window.fetch = async (...args) => {
            const input = args[0];
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const path = new URL(url, window.location.origin).pathname;
            const fault = new URL(window.location.href).searchParams.get("evalFault");
            const targetPath = "/api/workspace" + new URL(window.location.href).pathname;
            if (!consumed && path === targetPath && fault) {
              consumed = true;
              await new Promise((resolveDelay) => setTimeout(resolveDelay, 450));
              if (fault === "http") {
                return new Response(JSON.stringify({ error: "load_failed" }), {
                  status: 500,
                  headers: { "content-type": "application/json" }
                });
              }
              if (fault === "network") throw new TypeError("full-eval-detail-network-failure");
              if (fault === "json") {
                return new Response("{", { status: 200, headers: { "content-type": "application/json" } });
              }
              if (fault === "forbidden") {
                return new Response(JSON.stringify({ error: "permission_missing" }), {
                  status: 403,
                  headers: { "content-type": "application/json" }
                });
              }
            }
            return originalFetch(...args);
          };
        });

        const faults = [
          { mode: "http", message: "Не удалось загрузить данные" },
          { mode: "network", message: "Запрос не выполнен" },
          { mode: "json", message: "Некорректный ответ сервера" },
          { mode: "forbidden", message: "Доступ ограничен" }
        ];
        const screenshots: string[] = [];
        for (const fault of faults) {
          const navigation = page.goto("/projects/" + project.id + "?evalFault=" + fault.mode);
          await expect(page.getByText("Загружаем карточку проекта…", { exact: true })).toBeVisible();
          screenshots.push(await captureScenarioState(page, "PROJ-021", role, fault.mode + "-loading"));
          await navigation;
          await waitSettled(page);
          await expect(page.getByText(fault.message, { exact: true })).toBeVisible();
          screenshots.push(await captureScenarioState(page, "PROJ-021", role, fault.mode + "-state"));
          const retry = page.getByRole("button", { name: "Повторить", exact: true });
          if (fault.mode === "forbidden") {
            await expect(retry).toHaveCount(0);
            continue;
          }
          await expect(retry).toBeVisible();
          await retry.click();
          await waitSettled(page);
          if (role === "resourceReader") {
            await expect(page.getByText("Доступ ограничен", { exact: true })).toBeVisible();
            await expect(page.locator("body")).not.toContainText(project.title);
            screenshots.push(await captureScenarioState(page, "PROJ-021", role, fault.mode + "-retry-forbidden"));
          } else {
            await expect(page.getByRole("heading", { name: project.title, exact: true })).toBeVisible();
            screenshots.push(await captureScenarioState(page, "PROJ-021", role, fault.mode + "-retry-live"));
          }
        }

        if (role !== "resourceReader") {
          const missingId = "project-detail-state-missing-" + role.toLowerCase();
          const missingResponse = await page.request.get("/api/workspace/projects/" + missingId);
          expect(missingResponse.status()).toBe(404);
          await page.goto("/projects/" + missingId);
          await waitSettled(page);
          await expect(page.getByText("Проект не найден", { exact: true })).toBeVisible();
          await expectPath(page, "/projects/" + missingId);
          screenshots.push(await captureScenarioState(page, "PROJ-021", role, "live-404"));
        } else {
          const response = await page.request.get(detailPath);
          expect(response.status()).toBe(403);
          await page.goto("/projects/" + project.id);
          await waitSettled(page);
          await expect(page.getByText("Доступ ограничен", { exact: true })).toBeVisible();
          await expect(page.locator("body")).not.toContainText(project.title);
          screenshots.push(await captureScenarioState(page, "PROJ-021", role, "live-403"));
        }

        recordScenario("PROJ-021", role, [
          "Captured loading before each delayed detail response",
          "Distinguished HTTP, network, malformed JSON, synthetic forbidden, and role-correct Retry outcomes",
          role === "resourceReader"
            ? "Verified the live detail API and UI remain forbidden without identity leakage"
            : "Verified a live unknown project remains a canonical 404 state"
        ], screenshots);

        if (role === "resourceReader") {
          const response = await page.request.get(detailPath);
          expect(response.status()).toBe(403);
          await page.goto("/projects/" + project.id);
          await waitSettled(page);
          await expect(page.getByText("Доступ ограничен", { exact: true })).toBeVisible();
          await expect(page.locator("body")).not.toContainText(project.title);
          const forbiddenScreenshot = await captureScenarioState(page, "PROJ-022", role, "direct-api-and-ui-403");
          recordScenario("PROJ-022", role, [
            "Direct project detail API returned 403 for resourceReader",
            "The detail UI rendered forbidden and exposed no project identity"
          ], [forbiddenScreenshot]);
        }
      });
    }
  });
  test("P06 Overview literal KPI, signal, CTA, milestone, key-task, commit, and date evidence", async ({ browser }, testInfo) => {
    test.setTimeout(360_000);
    for (const role of READ_ROLES) {
      await withRole(browser, role, testInfo, async (page) => {
        expect(primaryProject).not.toBeNull();
        const project = primaryProject!;
        const readPath = "/api/workspace/projects/" + project.id + "/planning/read-model";
        const readPattern = "**" + readPath;
        const overviewPath = "/projects/" + project.id + "/overview";
        const response = await page.request.get(readPath);
        expect(response.status()).toBe(200);
        const base = (await response.json()) as ReadModel;
        if (role === "admin") overviewFixtureModel = structuredClone(base) as ReadModel;
        const templateTask = base.authored.tasks.find((task) => task.durationMinutes != null) ?? base.authored.tasks[0]!;
        const templateCalc = base.calculatedPlan.tasks[0] ?? {
          id: templateTask.id,
          calculatedFinish: templateTask.plannedFinish,
          isCritical: false,
          totalSlackMinutes: 480
        };
        const makeTask = (id: string, title: string, overrides: Partial<PlanTask> = {}): PlanTask => ({
          ...templateTask,
          id,
          title,
          wbsCode: overrides.wbsCode ?? id,
          durationMinutes: 480,
          workMinutes: 100,
          percentComplete: 0,
          statusId: "task-status-new",
          plannedFinish: "2026-07-20",
          customFields: {},
          ...overrides
        });
        const makeCalc = (
          task: PlanTask,
          calculatedFinish: string | null,
          isCritical = false,
          totalSlackMinutes: number | null = 480
        ) => ({
          ...templateCalc,
          id: task.id,
          calculatedFinish,
          isCritical,
          totalSlackMinutes
        });
        const showModel = async (model: ReadModel, scenarioId: string, state: string) => {
          await page.unroute(readPattern);
          await page.route(readPattern, (route) => route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(model)
          }));
          await page.goto(overviewPath + "?scenario=" + scenarioId.toLowerCase() + "&state=" + state);
          await waitSettled(page);
          await expect(page.getByRole("heading", { name: "Обзор проекта", exact: true })).toBeVisible();
        };
        const tile = (label: string) => page.getByText(label, { exact: true }).locator("..");

        const rich = structuredClone(base) as ReadModel;
        const richDone = makeTask("kpi-done", "KPI done", {
          workMinutes: 100,
          percentComplete: 100,
          statusId: "task-status-done",
          plannedFinish: "2026-07-08"
        });
        const richActive = makeTask("kpi-active", "KPI active", {
          workMinutes: 300,
          percentComplete: 50,
          statusId: "task-status-in-progress",
          plannedFinish: "2026-07-15"
        });
        const richMilestone = makeTask("kpi-milestone", "KPI milestone excluded", {
          durationMinutes: 0,
          workMinutes: 1000,
          percentComplete: 100,
          statusId: "task-status-done",
          plannedFinish: "2026-07-12",
          customFields: { kind: "milestone" }
        });
        rich.authored.tasks = [richDone, richActive, richMilestone];
        rich.project = { ...rich.project, deadline: "2026-07-12" };
        rich.calculatedPlan = {
          ...rich.calculatedPlan,
          projectFinish: "2026-07-15",
          criticalPathTaskIds: [],
          tasks: [
            makeCalc(richDone, "2026-07-08"),
            makeCalc(richActive, "2026-07-15"),
            makeCalc(richMilestone, "2026-07-12")
          ]
        };
        rich.baselineComparison = {
          ...rich.baselineComparison,
          tasks: [
            { taskId: richDone.id, baselineFinish: "2026-07-08" },
            { taskId: richActive.id, baselineFinish: "2026-07-12" }
          ]
        };
        rich.resourceLoad = {
          ...rich.resourceLoad,
          overloads: [
            { granularity: "day", resourceId: "resource-a", date: "2026-07-10" },
            { granularity: "day", resourceId: "resource-a", date: "2026-07-11" },
            { granularity: "day", resourceId: "resource-b", date: "2026-07-10" },
            { granularity: "week", resourceId: "resource-c", date: "2026-07-07" }
          ]
        };
        rich.validationIssues = [{ code: "one" }, { code: "two" }, { code: "three" }];
        await showModel(rich, "PROJ-023", "rich");
        await expect(tile("Прогресс")).toContainText("63%");
        await expect(tile("Прогресс")).toContainText("1 закрыто · 1 в работе");
        await expect(tile("Финиш (расчёт)")).toContainText("15.07");
        await expect(tile("Финиш (расчёт)")).toContainText("3 дн за дедлайном");
        await expect(tile("К базовому плану")).toContainText("+3 дн");
        await expect(tile("К базовому плану")).toContainText("отставание");
        await expect(tile("Перегрузы")).toContainText("2");
        await expect(tile("Риски плана")).toContainText("3");
        await expect(page.locator("main")).not.toContainText(/NaN|Infinity|Invalid Date/);
        const richKpiScreenshot = await captureScenarioState(page, "PROJ-023", role, "five-exact-kpis");

        const zero = structuredClone(base) as ReadModel;
        zero.authored.tasks = [];
        zero.project = { ...zero.project, deadline: null };
        zero.calculatedPlan = {
          ...zero.calculatedPlan,
          projectFinish: null,
          criticalPathTaskIds: [],
          tasks: []
        };
        zero.baselineComparison = { ...zero.baselineComparison, tasks: [] };
        zero.resourceLoad = { ...zero.resourceLoad, overloads: [] };
        zero.validationIssues = [];
        await showModel(zero, "PROJ-023", "zero");
        await expect(tile("Прогресс")).toContainText("0%");
        await expect(tile("Прогресс")).toContainText("0 закрыто · 0 в работе");
        await expect(tile("Финиш (расчёт)")).toContainText("—");
        await expect(tile("Финиш (расчёт)")).toContainText("дедлайн не задан");
        await expect(tile("К базовому плану")).toContainText("0 дн");
        await expect(tile("К базовому плану")).toContainText("в графике");
        await expect(tile("Перегрузы")).toContainText("0");
        await expect(tile("Риски плана")).toContainText("0");
        await expect(page.locator("main")).not.toContainText(/NaN|Infinity|Invalid Date/);
        const zeroKpiScreenshot = await captureScenarioState(page, "PROJ-023", role, "zero-nullable");
        recordScenario("PROJ-023", role, [
          "KPI values matched deterministic read-model calculations: 63%, 15.07 and 3 days late, +3 baseline days, 2 unique day-overload resources, 3 risks",
          "Zero/null model rendered 0%, no finish, no deadline, zero baseline delta, zero overloads and zero risks without NaN"
        ], [richKpiScreenshot, zeroKpiScreenshot]);

        await page.clock.setFixedTime(new Date("2026-07-11T05:00:00Z"));
        const allSignals = structuredClone(base) as ReadModel;
        const overdueTask = makeTask("signal-overdue", "Signal overdue", { plannedFinish: "2026-07-10" });
        const boundaryTask = makeTask("signal-boundary", "Signal boundary", { plannedFinish: "2026-07-11" });
        const doneOldTask = makeTask("signal-done", "Signal done", {
          plannedFinish: "2026-07-09",
          percentComplete: 100,
          statusId: "task-status-done"
        });
        const criticalTask = makeTask("signal-critical", "Signal critical", { plannedFinish: "2026-07-12" });
        allSignals.authored.tasks = [overdueTask, boundaryTask, doneOldTask, criticalTask];
        allSignals.project = { ...allSignals.project, deadline: "2026-07-13" };
        allSignals.calculatedPlan = {
          ...allSignals.calculatedPlan,
          projectFinish: "2026-07-16",
          criticalPathTaskIds: [criticalTask.id],
          tasks: [
            makeCalc(overdueTask, "2026-07-10"),
            makeCalc(boundaryTask, "2026-07-11"),
            makeCalc(doneOldTask, "2026-07-09", true, 0),
            makeCalc(criticalTask, "2026-07-12", true, 0)
          ]
        };
        allSignals.baselineComparison = {
          ...allSignals.baselineComparison,
          tasks: [{ taskId: criticalTask.id, baselineFinish: "2026-07-11" }]
        };
        allSignals.resourceLoad = {
          ...allSignals.resourceLoad,
          overloads: [
            { granularity: "day", resourceId: "resource-a", date: "2026-07-10" },
            { granularity: "day", resourceId: "resource-a", date: "2026-07-11" },
            { granularity: "day", resourceId: "resource-b", date: "2026-07-10" }
          ]
        };
        allSignals.validationIssues = [];
        await showModel(allSignals, "PROJ-024", "all-five");
        const signalSection = sectionByHeading(page, "Внимание · сигналы планирования");
        const signalRows = signalSection.locator("li.v4-row");
        await expect(signalRows).toHaveCount(5);
        const signalTexts = await signalRows.allTextContents();
        const expectedSignalTitles = [
          "Финиш за дедлайном: +3 дн.",
          "Перегруз ресурсов: 2",
          "Финиш сдвинут +5 дн от базового плана",
          "Просрочено задач: 1",
          "На критическом пути: 1 задача"
        ];
        expectedSignalTitles.forEach((title, index) => expect(signalTexts[index]).toContain(title));
        expect(signalTexts[0]).toContain("16.07.2026");
        expect(signalTexts[0]).toContain("13.07.2026");
        expect(signalTexts[1]).toContain("3 дн с превышением");
        expect(signalTexts[3]).toContain("11.07.2026");
        expect(signalTexts[4]).toContain("резерв 0 дн");
        const allSignalsScreenshot = await captureScenarioState(page, "PROJ-024", role, "all-five-ordered");

        const noSignals = structuredClone(allSignals) as ReadModel;
        noSignals.authored.tasks = [makeTask("signal-all-done", "All done critical", {
          percentComplete: 100,
          statusId: "task-status-done",
          plannedFinish: "2026-07-10"
        })];
        noSignals.project = { ...noSignals.project, deadline: "2026-07-11" };
        noSignals.calculatedPlan = {
          ...noSignals.calculatedPlan,
          projectFinish: "2026-07-11",
          criticalPathTaskIds: ["signal-all-done"],
          tasks: [{
            ...templateCalc,
            id: "signal-all-done",
            calculatedFinish: "2026-07-10",
            isCritical: true,
            totalSlackMinutes: 0
          }]
        };
        noSignals.baselineComparison = {
          ...noSignals.baselineComparison,
          tasks: [{ taskId: "signal-all-done", baselineFinish: "2026-07-11" }]
        };
        noSignals.resourceLoad = { ...noSignals.resourceLoad, overloads: [] };
        await showModel(noSignals, "PROJ-024", "empty");
        const emptySignalSection = sectionByHeading(page, "Внимание · сигналы планирования");
        await expect(emptySignalSection.getByText("Критичных сигналов нет — план в норме.", { exact: true })).toBeVisible();
        await expect(emptySignalSection.locator("li.v4-row")).toHaveCount(0);
        await expect(emptySignalSection.locator("a[href]")).toHaveCount(0);
        const emptySignalsScreenshot = await captureScenarioState(page, "PROJ-024", role, "all-done-empty");
        recordScenario("PROJ-024", role, [
          "Signal titles matched the exact five derived conditions in deadline, overload, baseline, overdue, critical order",
          "Signal details matched boundary dates, overload-day count, and zero-slack semantics",
          "An all-done critical task produced the honest no-signal state"
        ], [allSignalsScreenshot, emptySignalsScreenshot]);

        await showModel(allSignals, "PROJ-025", "cta-source");
        const ctaSection = sectionByHeading(page, "Внимание · сигналы планирования");
        await expect(ctaSection.locator("a[href]")).toHaveCount(5);
        const ctas = [
          { title: expectedSignalTitles[0]!, action: "Открыть График", href: "/projects/" + project.id + "/schedule" },
          { title: expectedSignalTitles[1]!, action: "Открыть Сценарии", href: "/projects/" + project.id + "/scenarios" },
          { title: expectedSignalTitles[2]!, action: "Открыть Baseline", href: "/projects/" + project.id + "/baseline" },
          { title: expectedSignalTitles[3]!, action: "Открыть График", href: "/projects/" + project.id + "/schedule" },
          { title: expectedSignalTitles[4]!, action: "Показать путь", href: "/projects/" + project.id + "/schedule" }
        ];
        const ctaScreenshots: string[] = [];
        const ctaAssertions: string[] = [];
        for (let index = 0; index < ctas.length; index += 1) {
          const expectedCta = ctas[index]!;
          const row = sectionByHeading(page, "Внимание · сигналы планирования")
            .locator("li.v4-row")
            .filter({ hasText: expectedCta.title });
          await expect(row).toHaveCount(1);
          const link = row.locator('a[href="' + expectedCta.href + '"]');
          await expect(link).toHaveCount(1);
          await expect(link).toContainText(expectedCta.action);
          await link.click();
          await expectPath(page, expectedCta.href);
          await expect(page.locator('[aria-current="page"]')).toHaveAttribute("href", expectedCta.href);
          ctaScreenshots.push(await captureScenarioState(page, "PROJ-025", role, "cta-" + (index + 1) + "-destination"));
        await page.goBack({ waitUntil: "commit" });
          await expectPath(page, overviewPath);
          await waitSettled(page);
          await expect(sectionByHeading(page, "Внимание · сигналы планирования").getByText(expectedCta.title, { exact: true })).toBeVisible();
          ctaScreenshots.push(await captureScenarioState(page, "PROJ-025", role, "cta-" + (index + 1) + "-back"));
          ctaAssertions.push(expectedCta.action + " -> " + expectedCta.href + " -> Back restored " + expectedCta.title);
        }
        recordScenario("PROJ-025", role, ctaAssertions, ctaScreenshots);

        const milestones = structuredClone(base) as ReadModel;
        const milestoneCalc = makeTask("milestone-calc", "M-calc", {
          durationMinutes: 0,
          percentComplete: 99,
          plannedFinish: "2026-07-15",
          customFields: { kind: "milestone" }
        });
        const milestoneFallback = makeTask("milestone-fallback", "M-planned-fallback", {
          durationMinutes: 0,
          percentComplete: 100,
          plannedFinish: "2026-07-12",
          customFields: { kind: "milestone" }
        });
        const milestoneNoDate = makeTask("milestone-no-date", "M-no-date", {
          durationMinutes: 0,
          percentComplete: 0,
          plannedFinish: null,
          customFields: { kind: "milestone" }
        });
        milestones.authored.tasks = [milestoneCalc, milestoneFallback, milestoneNoDate];
        milestones.project = { ...milestones.project, deadline: "2026-07-11" };
        milestones.calculatedPlan = {
          ...milestones.calculatedPlan,
          projectFinish: "2026-07-12",
          criticalPathTaskIds: [],
          tasks: [
            makeCalc(milestoneCalc, "2026-07-10"),
            makeCalc(milestoneFallback, null),
            makeCalc(milestoneNoDate, null)
          ]
        };
        milestones.baselineComparison = { ...milestones.baselineComparison, tasks: [] };
        milestones.resourceLoad = { ...milestones.resourceLoad, overloads: [] };
        milestones.validationIssues = [];
        await showModel(milestones, "PROJ-026", "ordered");
        const milestoneSection = sectionByHeading(page, "Контрольные точки");
        const milestoneRows = milestoneSection.locator("li.v4-row");
        await expect(milestoneRows).toHaveCount(4);
        const milestoneTexts = await milestoneRows.allTextContents();
        expect(milestoneTexts[0]).toContain("M-calc");
        expect(milestoneTexts[0]).toContain("10.07.2026");
        expect(milestoneTexts[0]).not.toContain("готово");
        expect(milestoneTexts[1]).toContain("Дедлайн релиза");
        expect(milestoneTexts[1]).toContain("11.07.2026");
        expect(milestoneTexts[2]).toContain("M-planned-fallback");
        expect(milestoneTexts[2]).toContain("12.07.2026");
        expect(milestoneTexts[2]).toContain("готово");
        expect(milestoneTexts[3]).toContain("M-no-date");
        expect(milestoneTexts[3]).toContain("—");
        const milestoneScreenshot = await captureScenarioState(page, "PROJ-026", role, "ordered-done-fallback");

        const noMilestones = structuredClone(zero) as ReadModel;
        await showModel(noMilestones, "PROJ-026", "empty");
        const noMilestoneSection = sectionByHeading(page, "Контрольные точки");
        await expect(noMilestoneSection.getByText("Контрольных точек пока нет.", { exact: true })).toBeVisible();
        await expect(noMilestoneSection.locator("li.v4-row")).toHaveCount(0);
        const noMilestoneScreenshot = await captureScenarioState(page, "PROJ-026", role, "explicit-empty");
        recordScenario("PROJ-026", role, [
          "Milestones, deadline, planned-date fallback, no-date row, and done semantics matched exact chronological order",
          "No milestones and no deadline rendered the explicit empty copy"
        ], [milestoneScreenshot, noMilestoneScreenshot]);

        const keys = structuredClone(base) as ReadModel;
        const keyTasks = [
          makeTask("key-done", "Done critical", { statusId: "task-status-done", percentComplete: 100, plannedFinish: "2026-07-08" }),
          makeTask("key-c10", "Critical 10 Jul", { plannedFinish: "2026-07-10", customFields: { resLabel: "Иван Петров" } }),
          makeTask("key-c12", "Critical 12 Jul", { plannedFinish: "2026-07-12" }),
          makeTask("key-c13", "Critical planned fallback", { plannedFinish: "2026-07-13" }),
          makeTask("key-n09", "Normal 09 Jul", { plannedFinish: "2026-07-09" }),
          makeTask("key-n11", "Normal 11 Jul", { plannedFinish: "2026-07-11" }),
          makeTask("key-n14", "Normal 14 Jul", { plannedFinish: "2026-07-14" }),
          makeTask("key-n15", "Normal 15 Jul", { plannedFinish: "2026-07-15" })
        ];
        keys.authored.tasks = keyTasks;
        keys.project = { ...keys.project, deadline: null };
        keys.calculatedPlan = {
          ...keys.calculatedPlan,
          projectFinish: "2026-07-15",
          criticalPathTaskIds: ["key-done", "key-c10", "key-c12", "key-c13"],
          tasks: keyTasks.map((task) => makeCalc(
            task,
            task.id === "key-c13" ? null : task.plannedFinish,
            ["key-done", "key-c10", "key-c12", "key-c13"].includes(task.id),
            0
          ))
        };
        keys.baselineComparison = { ...keys.baselineComparison, tasks: [] };
        keys.resourceLoad = { ...keys.resourceLoad, overloads: [] };
        keys.validationIssues = [];
        await showModel(keys, "PROJ-027", "ordered");
        const keySection = sectionByHeading(page, "Ключевые задачи");
        const keyRows = keySection.locator("tbody tr");
        await expect(keyRows).toHaveCount(5);
        const keyTexts = await keyRows.allTextContents();
        const expectedKeyTitles = ["Critical 10 Jul", "Critical 12 Jul", "Critical planned fallback", "Normal 09 Jul", "Normal 11 Jul"];
        expectedKeyTitles.forEach((title, index) => expect(keyTexts[index]).toContain(title));
        await expect(keySection.getByText("Done critical", { exact: true })).toHaveCount(0);
        await expect(keySection.getByText("Normal 14 Jul", { exact: true })).toHaveCount(0);
        await expect(keySection.getByText("Normal 15 Jul", { exact: true })).toHaveCount(0);
        expect(keyTexts[0]).toContain("ИП");
        expect(keyTexts[1]).toContain("—");
        expect(keyTexts[2]).toContain("13.07");
        const keyScreenshot = await captureScenarioState(page, "PROJ-027", role, "ordered-cap-done-excluded");

        const allDoneKeys = structuredClone(keys) as ReadModel;
        allDoneKeys.authored.tasks = keyTasks.map((task) => ({ ...task, statusId: "task-status-done", percentComplete: 100 }));
        await showModel(allDoneKeys, "PROJ-027", "all-done");
        const allDoneKeySection = sectionByHeading(page, "Ключевые задачи");
        await expect(allDoneKeySection.getByText("Открытых ключевых задач нет.", { exact: true })).toBeVisible();
        await expect(allDoneKeySection.locator("tbody tr")).toHaveCount(1);
        const keyEmptyScreenshot = await captureScenarioState(page, "PROJ-027", role, "all-done-empty");
        recordScenario("PROJ-027", role, [
          "Verified exact critical-first then finish-date order, top-five cap, done exclusion, avatar fallback, and planned-finish display fallback",
          "All-done model rendered one explicit empty row and no task rows"
        ], [keyScreenshot, keyEmptyScreenshot]);

        const auditPath = "/api/tenant/current/audit-events?projectId=" + encodeURIComponent(project.id);
        const auditPattern = "**" + auditPath;
        const auditEvents = Array.from({ length: 5 }, (_, index) => ({
          id: "audit-" + (9 - index),
          actionType: "task.update_progress",
          sourceWorkflow: "planning",
          input: { command: { type: index === 0 ? "task.create" : "task.update_progress" } },
          afterState: {
            planVersion: 9 - index,
            changedTaskIds: Array.from({ length: index + 1 }, (_unused, taskIndex) => "task-" + taskIndex),
            compensatingCommands: index === 0 ? [{ type: "task.delete_or_archive" }] : []
          },
          executionResult: { status: "succeeded" },
          createdAt: "2026-07-" + String(10 - index).padStart(2, "0") + "T10:0" + index + ":00.000Z"
        })).concat([{
          id: "audit-non-planning",
          actionType: "user.login",
          sourceWorkflow: "auth",
          input: {},
          afterState: { planVersion: 99, changedTaskIds: [], compensatingCommands: [] },
          executionResult: { status: "succeeded" },
          createdAt: "2026-07-11T11:00:00.000Z"
        }]);
        const commitScreenshots: string[] = [];
        await showModel(rich, "PROJ-028", "loading");
        await page.unroute(auditPattern);
        let releaseAudit!: () => void;
        const auditGate = new Promise<void>((resolveGate) => { releaseAudit = resolveGate; });
        await page.route(auditPattern, async (route) => {
          await auditGate;
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ auditEvents }) });
        });
        await page.reload();
        await waitSettled(page);
        await expect(sectionByHeading(page, "Последние коммиты").getByText("Загрузка истории…", { exact: true })).toBeVisible();
        commitScreenshots.push(await captureScenarioState(page, "PROJ-028", role, "loading"));
        releaseAudit();
        const readyCommitSection = sectionByHeading(page, "Последние коммиты");
        await expect(readyCommitSection.getByText("v9", { exact: true })).toBeVisible();
        await expect(readyCommitSection.locator("li.v4-row")).toHaveCount(4);
        const commitTexts = await readyCommitSection.locator("li.v4-row").allTextContents();
        ["v9", "v8", "v7", "v6"].forEach((version, index) => expect(commitTexts[index]).toContain(version));
        await expect(readyCommitSection.getByText("v5", { exact: true })).toHaveCount(0);
        commitScreenshots.push(await captureScenarioState(page, "PROJ-028", role, "ready-four"));
        await page.unroute(auditPattern);

        await page.route(auditPattern, (route) => route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ auditEvents: [] })
        }));
        await page.reload();
        await waitSettled(page);
        await expect(sectionByHeading(page, "Последние коммиты").getByText("История пуста.", { exact: true })).toBeVisible();
        commitScreenshots.push(await captureScenarioState(page, "PROJ-028", role, "true-empty"));
        await page.unroute(auditPattern);

        await page.route(auditPattern, (route) => route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "audit_events_forbidden" })
        }));
        await page.reload();
        await waitSettled(page);
        await expect(sectionByHeading(page, "Последние коммиты").getByText("История изменений недоступна: недостаточно прав.", { exact: true })).toBeVisible();
        commitScreenshots.push(await captureScenarioState(page, "PROJ-028", role, "forbidden"));
        await page.unroute(auditPattern);

        await page.route(auditPattern, (route) => route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "audit_events_failed" })
        }));
        await page.reload();
        await waitSettled(page);
        await expect(sectionByHeading(page, "Последние коммиты").getByText("Не удалось загрузить историю изменений.", { exact: true })).toBeVisible();
        commitScreenshots.push(await captureScenarioState(page, "PROJ-028", role, "error"));
        await page.unroute(auditPattern);

        await page.route(auditPattern, (route) => route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ auditEvents })
        }));
        await page.reload();
        await waitSettled(page);
        await expect(sectionByHeading(page, "Последние коммиты").getByText("v9", { exact: true })).toBeVisible();
        const allCommits = page.getByRole("link", { name: "Все", exact: true });
        await expect(allCommits).toHaveAttribute("href", "/projects/" + project.id + "/commits");
        await allCommits.click();
        await expectPath(page, "/projects/" + project.id + "/commits");
        commitScreenshots.push(await captureScenarioState(page, "PROJ-028", role, "commits-destination"));
        await page.goBack({ waitUntil: "commit" });
        await expectPath(page, overviewPath);
        await waitSettled(page);
        await expect(sectionByHeading(page, "Последние коммиты").getByText("v9", { exact: true })).toBeVisible();
        commitScreenshots.push(await captureScenarioState(page, "PROJ-028", role, "back-ready"));
        recordScenario("PROJ-028", role, [
          "Captured distinct loading, four-item ready, true-empty, forbidden, and error commit states",
          "Filtered out non-planning and fifth planning events while preserving descending versions",
          "The All link navigated to canonical Commits and browser Back restored ready Overview"
        ], commitScreenshots);
        await page.unroute(auditPattern);

        const overdueModel = structuredClone(base) as ReadModel;
        const overdueTasks = [
          makeTask("overdue-calc", "Overdue calc", { plannedFinish: "2026-07-20" }),
          makeTask("overdue-boundary", "Boundary today", { plannedFinish: "2026-07-11" }),
          makeTask("overdue-future", "Future task", { plannedFinish: "2026-07-12" }),
          makeTask("overdue-done", "Done old", { plannedFinish: "2026-07-09", statusId: "task-status-done", percentComplete: 100 }),
          makeTask("overdue-fallback", "Overdue fallback", { plannedFinish: "2026-07-10" }),
          makeTask("overdue-null", "No finish", { plannedFinish: null })
        ];
        overdueModel.authored.tasks = overdueTasks;
        overdueModel.project = { ...overdueModel.project, deadline: null };
        overdueModel.calculatedPlan = {
          ...overdueModel.calculatedPlan,
          projectFinish: null,
          criticalPathTaskIds: [],
          tasks: [
            makeCalc(overdueTasks[0]!, "2026-07-10"),
            makeCalc(overdueTasks[1]!, "2026-07-11"),
            makeCalc(overdueTasks[2]!, "2026-07-12"),
            makeCalc(overdueTasks[3]!, "2026-07-09"),
            makeCalc(overdueTasks[4]!, null),
            makeCalc(overdueTasks[5]!, null)
          ]
        };
        overdueModel.baselineComparison = { ...overdueModel.baselineComparison, tasks: [] };
        overdueModel.resourceLoad = { ...overdueModel.resourceLoad, overloads: [] };
        overdueModel.validationIssues = [];
        await page.clock.setFixedTime(new Date("2026-07-11T05:00:00Z"));
        await showModel(overdueModel, "PROJ-029", "2026-07-11");
        const overdueSection = sectionByHeading(page, "Внимание · сигналы планирования");
        await expect(overdueSection.getByText("Просрочено задач: 2", { exact: true })).toBeVisible();
        await expect(overdueSection).toContainText("срок раньше 11.07.2026, не закрыты");
        await expect(overdueSection).not.toContainText("23.06.2026");
        const overdue11Screenshot = await captureScenarioState(page, "PROJ-029", role, "current-date-2026-07-11");

        await page.clock.setFixedTime(new Date("2026-07-13T05:00:00Z"));
        await page.reload();
        await waitSettled(page);
        const overdue13Section = sectionByHeading(page, "Внимание · сигналы планирования");
        await expect(overdue13Section.getByText("Просрочено задач: 4", { exact: true })).toBeVisible();
        await expect(overdue13Section).toContainText("срок раньше 13.07.2026, не закрыты");
        const overdue13Screenshot = await captureScenarioState(page, "PROJ-029", role, "current-date-2026-07-13");
        recordScenario("PROJ-029", role, [
          "At 2026-07-11 exactly two open effective finishes were overdue; boundary-today, future, done, and null were excluded",
          "Moving current time to 2026-07-13 changed the same model to four overdue tasks and updated the visible boundary date",
          "The removed fixed 23.06.2026 date was absent"
        ], [overdue11Screenshot, overdue13Screenshot]);
        await page.unroute(readPattern);
      });
    }
  });
  test("P07 Overview loading, server/network error, retry, 404, and 403 for every role", async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    for (const role of ALL_ROLES) {
      await withRole(browser, role, testInfo, async (page) => {
        expect(primaryProject).not.toBeNull();
        expect(overviewFixtureModel).not.toBeNull();
        const project = primaryProject!;
        const validModel = structuredClone(overviewFixtureModel!) as ReadModel;
        const path = "/api/workspace/projects/" + project.id + "/planning/read-model";
        const pattern = "**" + path;
        const overviewPath = "/projects/" + project.id + "/overview";
        const screenshots: string[] = [];

        if (role === "resourceReader") {
          const direct = await page.request.get(path);
          expect(direct.status()).toBe(403);
        }

        let releaseLoading!: () => void;
        const loadingGate = new Promise<void>((resolveGate) => { releaseLoading = resolveGate; });
        await page.route(pattern, async (route) => {
          await loadingGate;
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(validModel) });
        });
        const loadingNavigation = page.goto(overviewPath + "?evalState=loading");
        await expect(page.getByText("Загрузка…", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Обзор проекта", exact: true })).toHaveCount(0);
        screenshots.push(await captureScenarioState(page, "PROJ-030", role, "loading"));
        releaseLoading();
        await loadingNavigation;
        await waitSettled(page);
        await expect(page.getByRole("heading", { name: "Обзор проекта", exact: true })).toBeVisible();
        await page.unroute(pattern);

        await page.route(pattern, (route) => route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "load_failed" })
        }));
        await page.goto(overviewPath + "?evalState=500");
        await waitSettled(page);
        await expect(page.getByText("Не удалось загрузить план проекта", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Повторить", exact: true })).toBeVisible();
        await expect(page.getByText("Доступ ограничен", { exact: true })).toHaveCount(0);
        screenshots.push(await captureScenarioState(page, "PROJ-030", role, "500-error"));
        await page.unroute(pattern);

        await page.route(pattern, (route) => route.abort("failed"));
        await page.goto(overviewPath + "?evalState=network");
        await waitSettled(page);
        await expect(page.getByText("Не удалось связаться с сервисом планирования. Проверьте подключение и повторите", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Повторить", exact: true })).toBeVisible();
        screenshots.push(await captureScenarioState(page, "PROJ-030", role, "network-error"));
        await page.unroute(pattern);

        let retryRequests = 0;
        await page.route(pattern, async (route) => {
          retryRequests += 1;
          if (retryRequests === 1) {
            await route.abort("failed");
            return;
          }
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(validModel) });
        });
        await page.goto(overviewPath + "?evalState=retry");
        await waitSettled(page);
        await expect(page.getByText("Не удалось связаться с сервисом планирования. Проверьте подключение и повторите", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Повторить", exact: true }).click();
        await waitSettled(page);
        expect(retryRequests).toBe(2);
        await expect(page.getByRole("heading", { name: "Обзор проекта", exact: true })).toBeVisible();
        await expect(page.getByText("Прогресс", { exact: true })).toBeVisible();
        await expectPath(page, overviewPath);
        screenshots.push(await captureScenarioState(page, "PROJ-030", role, "retry-ready"));
        await page.unroute(pattern);

        const missingId = "project-overview-state-missing-" + role.toLowerCase();
        const missingPath = "/api/workspace/projects/" + missingId + "/planning/read-model";
        const missingPattern = "**" + missingPath;
        await page.route(missingPattern, (route) => route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "project_not_found" })
        }));
        await page.goto("/projects/" + missingId + "/overview");
        await waitSettled(page);
        await expect(page.locator("main")).toContainText("Проект не найден");
        await expect(page.getByText("Доступ ограничен", { exact: true })).toHaveCount(0);
        await expectPath(page, "/projects/" + missingId + "/overview");
        await expect(page.locator("body")).not.toContainText(project.title);
        screenshots.push(await captureScenarioState(page, "PROJ-030", role, "404-no-leak"));
        await page.unroute(missingPattern);

        await page.route(pattern, (route) => route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "forbidden" })
        }));
        await page.goto(overviewPath + "?evalState=403");
        await waitSettled(page);
        await expect(page.getByText("Доступ ограничен", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Повторить", exact: true })).toHaveCount(0);
        if (role === "resourceReader") await expect(page.locator("body")).not.toContainText(project.title);
        screenshots.push(await captureScenarioState(page, "PROJ-030", role, "403-forbidden"));
        await page.unroute(pattern);

        recordScenario("PROJ-030", role, [
          "Held an intercepted read-model request and captured loading before any KPI content",
          "Observed distinct server and network errors with Retry controls",
          "Retry issued exactly two requests for the same project and reached ready KPI content",
          "Synthetic 404 preserved the missing project URL without identity leakage",
          role === "resourceReader"
            ? "Direct live API and synthetic state both proved 403 without project identity leakage"
            : "Synthetic 403 mapped to the dedicated forbidden surface without Retry"
        ], screenshots);
      });
    }
  });
  test.afterAll(() => {
    const sourceStateAtEnd = sourceState();
    const receiptRows = [...rows.values()];
    writeFileSync(RECEIPT_PATH, JSON.stringify({
      schemaVersion: 1,
      runId: RUN_ID,
      generatedAt: new Date().toISOString(),
      targetRowCount: targets.length,
      bundleCount: 7,
      statusCounts: Object.fromEntries(["pass", "pending"].map((status) => [
        status,
        receiptRows.filter((row) => row.status === status).length
      ])),
      sourceStateAtStart,
      sourceStateAtEnd,
      rows: receiptRows
    }, null, 2), "utf8");
    expect(sourceStateAtEnd, "source changed during browser evidence run").toEqual(sourceStateAtStart);
    expect(receiptRows.filter((row) => row.status !== "pass").map((row) => row.key)).toEqual([]);
    expect(receiptRows).toHaveLength(68);
    const screenshotOwners = new Map<string, string>();
    const screenshotHashes = new Map<string, string>();
    for (const row of receiptRows) {
      expect(row.assertions.length, row.key + " requires assertions").toBeGreaterThan(0);
      expect(row.screenshots.length, row.key + " requires screenshots").toBeGreaterThan(0);
      const [scenarioId, role] = row.key.split(":");
      for (const screenshot of row.screenshots) {
        expect(screenshot).toContain(scenarioId.toLowerCase() + "-" + role + "-");
        expect(screenshotOwners.has(screenshot), screenshot + " reused by " + row.key).toBe(false);
        screenshotOwners.set(screenshot, row.key);
        const screenshotPath = resolve(EVIDENCE_ROOT, screenshot);
        expect(statSync(screenshotPath).size, screenshot + " is empty").toBeGreaterThan(0);
        const screenshotHash = createHash("sha256").update(readFileSync(screenshotPath)).digest("hex");
        expect(screenshotHashes.has(screenshotHash), screenshot + " duplicates pixels from " + screenshotHashes.get(screenshotHash)).toBe(false);
        screenshotHashes.set(screenshotHash, screenshot);
      }
    }
  });
});
async function captureScenarioState(page: Page, scenarioId: string, role: Role, state: string) {
  const safeState = state.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const screenshot = scenarioId.toLowerCase() + "-" + role + "-" + safeState + ".png";
  const evidenceLabel = scenarioId + ":" + role + ":" + safeState;
  await page.evaluate((label) => {
    document.querySelector('[data-full-eval-evidence="true"]')?.remove();
    const stamp = document.createElement("div");
    stamp.dataset.fullEvalEvidence = "true";
    stamp.textContent = "Full Eval evidence | " + label;
    Object.assign(stamp.style, {
      position: "fixed",
      right: "8px",
      bottom: "8px",
      zIndex: "2147483647",
      padding: "4px 6px",
      background: "rgba(0, 0, 0, 0.82)",
      color: "white",
      font: "11px/1.2 monospace",
      pointerEvents: "none"
    });
    document.body.append(stamp);
  }, evidenceLabel);
  try {
    await page.screenshot({ path: resolve(EVIDENCE_ROOT, screenshot), fullPage: true });
  } finally {
    await page.evaluate(() => document.querySelector('[data-full-eval-evidence="true"]')?.remove());
  }
  return screenshot;
}

function recordScenario(
  scenarioId: string,
  role: Role,
  executedAssertions: string[],
  screenshots: string[]
) {
  const key = scenarioId + ":" + role;
  const row = rows.get(key);
  expect(row, "unexpected evidence key " + key).toBeTruthy();
  expect(row!.status, "duplicate evidence key " + key).toBe("pending");
  expect(executedAssertions.length, key + " requires executed assertions").toBeGreaterThan(0);
  expect(screenshots.length, key + " requires scenario-state screenshots").toBeGreaterThan(0);
  for (const screenshot of screenshots) {
    expect(existsSync(resolve(EVIDENCE_ROOT, screenshot)), key + " missing screenshot " + screenshot).toBe(true);
  }
  rows.set(key, {
    ...row!,
    status: "pass",
    generatedAt: new Date().toISOString(),
    assertions: executedAssertions,
    screenshots
  });
}

async function withRole(
  browser: Browser,
  role: Role,
  testInfo: TestInfo,
  run: (page: Page) => Promise<void>
) {
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    locale: "ru-RU"
  });
  const page = await context.newPage();
  try {
    await login(page, role);
    await run(page);
  } finally {
    await context.close();
  }
}
async function login(page: Page, role: Role) {
  const user = USERS[role];
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

async function getProjects(page: Page): Promise<Project[]> {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  return ((await response.json()) as { projects: Project[] }).projects;
}

async function createEmptyProject(page: Page) {
  const suffix = String(Date.now());
  const opportunityId = "opportunity-shell-" + suffix;
  const projectId = "project-shell-" + suffix;
  const headers = { "content-type": "application/json", "x-kiss-pm-action": "same-origin" };
  const created = await page.request.post("/api/workspace/opportunities", {
    headers,
    data: {
      id: opportunityId,
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      title: "Empty shell project " + suffix,
      plannedStart: "2028-01-10",
      plannedFinish: "2028-02-10",
      contractValue: 100000,
      plannedHourlyRate: 2500,
      probability: 80,
      demand: [{ positionId: "position-engineer", requiredHours: 8 }]
    }
  });
  expect(created.status()).toBe(201);
  const feasibility = await page.request.post(
    "/api/workspace/opportunities/" + opportunityId + "/feasibility",
    { headers: { "x-kiss-pm-action": "same-origin" } }
  );
  expect(feasibility.status()).toBe(200);
  const activated = await page.request.post(
    "/api/workspace/opportunities/" + opportunityId + "/activate",
    {
      headers,
      data: {
        id: projectId,
        acceptedRiskReason: "Full evaluation disposable empty-project state"
      }
    }
  );
  expect(activated.status()).toBe(201);
  return projectId;
}

async function waitSettled(page: Page) {
  await page.waitForFunction(() => {
    const text = document.body.textContent ?? "";
    return !["Загрузка проектов…", "Загружаем карточку проекта…"]
      .some((label) => text.includes(label));
  }, undefined, { timeout: 20_000 });
}

async function expectPath(page: Page, expected: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(expected);
}

function doneStatus(statusId: string) {
  return statusId.replace(/^task-status-/, "").replaceAll("-", "_") === "done";
}

function inProgressStatus(statusId: string) {
  return statusId.replace(/^task-status-/, "").replaceAll("-", "_") === "in_progress";
}

function sectionByHeading(page: Page, name: string) {
  return page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::section[1]");
}

function formatProjectDate(iso: string | null) {
  if (iso == null) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? match[3] + "." + match[2] + "." + match[1] : iso;
}

function formatProjectMoney(value: number) {
  return value >= 1_000_000
    ? (value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " млн ₽"
    : Math.round(value / 1000).toLocaleString("ru-RU") + " тыс ₽";
}
function formatDate(date: Date) {
  return String(date.getDate()).padStart(2, "0")
    + "." + String(date.getMonth() + 1).padStart(2, "0")
    + "." + String(date.getFullYear());
}

function sourceState() {
  return Object.fromEntries(sourceFiles.map((path) => {
    const absolute = resolve(REPO_ROOT, path);
    expect(existsSync(absolute), "guarded source missing: " + path).toBe(true);
    return [path, createHash("sha256").update(readFileSync(absolute)).digest("hex")];
  }));
}

