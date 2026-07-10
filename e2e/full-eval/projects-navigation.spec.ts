import { expect, test, type Locator, type Page } from "@playwright/test";
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

const OVERVIEW_SIGNAL_ROUTES: Record<string, string> = {
  "Открыть График": "schedule",
  "Открыть Сценарии": "scenarios",
  "Открыть Baseline": "baseline",
  "Показать путь": "schedule"
};

type Project = { id: string; title: string };
type CalendarException = {
  id: string;
  calendarId: string;
  resourceId: null;
  date: string;
  workingMinutes: number;
  reason: string;
};
type NavigationReadModel = {
  planVersion: number;
  project: { calendarId: string | null };
  calendars: Array<{
    id: string;
    workingWeekdays: number[];
    workingMinutesPerDay: number;
  }>;
  calendarExceptions: CalendarException[];
  authored: { tasks: Array<{ title: string }> };
  calculatedPlan: {
    tasks: Array<{
      id: string;
      calculatedStart: string | null;
      calculatedFinish: string | null;
    }>;
  };
};
type EvidenceStatus = "PASS" | "FAIL" | "INCONCLUSIVE";
type RouteEvidence = {
  route: string;
  finalUrl: string;
  restoredUrl: string;
  activeTab: string;
  tabLinks: number;
  screenshot: string;
  status: "PASS" | "FAIL";
  error: string;
};
type NavigationEvidence = {
  check: string;
  origin: string;
  expectedHref: string;
  actualHref: string;
  finalUrl: string;
  restoredUrl: string;
  status: EvidenceStatus;
  error: string;
};

test("Projects navigation: native links, every delivery route, CTAs, selector and reload", async ({ page }, testInfo) => {
  test.setTimeout(6 * 60_000);
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const rows: RouteEvidence[] = [];
  const navigations: NavigationEvidence[] = [];
  const failures: string[] = [];
  const inconclusive: string[] = [];
  await loginAsAdmin(page);

  const projectsResponse = await page.request.get("/api/workspace/projects");
  expect(projectsResponse.status()).toBe(200);
  const projectsBody = (await projectsResponse.json()) as { projects: Project[] };
  expect(projectsBody.projects.length).toBeGreaterThanOrEqual(2);
  const [firstProject, secondProject] = projectsBody.projects;
  expect(firstProject).toBeTruthy();
  expect(secondProject).toBeTruthy();

  const listEvidence = await captureProjectListNavigation(page, projectsBody.projects);
  navigations.push(listEvidence);
  collectEvidence(listEvidence, failures, inconclusive);

  for (const [label, slug] of TABS) {
    const route = `/projects/${firstProject!.id}/${slug}`;
    const originSlug = slug === "overview" ? "settings" : "overview";
    const origin = `/projects/${firstProject!.id}/${originSlug}`;
    const row: RouteEvidence = {
      route,
      finalUrl: "",
      restoredUrl: "",
      activeTab: label,
      tabLinks: 0,
      screenshot: "",
      status: "FAIL",
      error: ""
    };
    const screenshotPath = resolve(SCREENSHOT_DIR, `${slug}.png`);
    let screenshotWritten = false;
    try {
      await page.goto(origin);
      await waitForSettledSurface(page);
      const originNav = deliveryNav(page, firstProject!.id);
      await assertTabContracts(originNav, firstProject!.id, originSlug);
      const targetLink = originNav.locator(`a[href="${route}"]`);
      await expect(targetLink).toHaveCount(1);
      await expect(targetLink).toHaveAttribute("href", route);
      expect(await targetLink.evaluate((node) => node.tagName)).toBe("A");
      await targetLink.click();
      await expectPath(page, route);
      await waitForSettledSurface(page);
      row.finalUrl = page.url();
      await assertTabContracts(deliveryNav(page, firstProject!.id), firstProject!.id, slug);
      row.tabLinks = TABS.length;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshotWritten = true;
      row.screenshot = relative(REPO_ROOT, screenshotPath).replaceAll("\\", "/");
      await page.goBack();
      await waitForSettledSurface(page);
      await expectPath(page, origin);
      row.restoredUrl = page.url();
      row.status = "PASS";
    } catch (error) {
      row.error = errorMessage(error);
      failures.push(`${route}: ${row.error}`);
    } finally {
      if (!screenshotWritten) {
        if (!row.finalUrl) {
          await page.goto(route).catch(() => undefined);
          await waitForSettledSurface(page).catch(() => undefined);
        }
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshotWritten = true;
        row.screenshot = relative(REPO_ROOT, screenshotPath).replaceAll("\\", "/");
      }
      rows.push(row);
    }
  }

  const guardEvidence = await captureScheduleStagedNavigationGuard(page, firstProject!.id);
  record(guardEvidence);

  const overviewPath = `/projects/${firstProject!.id}/overview`;
  await page.goto(overviewPath);
  await waitForSettledSurface(page);
  const signalLinks = page
    .getByRole("heading", { name: "Внимание · сигналы планирования", exact: true })
    .locator("xpath=ancestor::section[1]")
    .locator("li a");
  const signalCount = await signalLinks.count();
  if (signalCount === 0) {
    record(inconclusiveEvidence("overview-visible-signals", overviewPath, "current live project has no visible planning signals"));
  } else {
    for (let index = 0; index < signalCount; index += 1) {
      const link = signalLinks.nth(index);
      const action = (await link.innerText()).trim();
      const expectedSlug = OVERVIEW_SIGNAL_ROUTES[action];
      record(expectedSlug
        ? await captureNavigationAndBack({
            page,
            check: `overview-signal-${index + 1}:${action}`,
            origin: overviewPath,
            expectedHref: `/projects/${firstProject!.id}/${expectedSlug}`,
            link
          })
        : failedEvidence(`overview-signal-${index + 1}:${action}`, overviewPath, "known project signal route", `unknown visible signal CTA: ${action}`));
    }
  }

  record(await captureNavigationAndBack({
    page,
    check: "overview-all-commits",
    origin: overviewPath,
    expectedHref: `/projects/${firstProject!.id}/commits`,
    link: page.getByRole("link", { name: "Все", exact: true })
  }));

  record(await capturePageNavigation({
    page,
    check: "baseline-open-schedule",
    origin: `/projects/${firstProject!.id}/baseline`,
    expectedHref: `/projects/${firstProject!.id}/schedule`,
    link: () => page.getByRole("link", { name: "Слой в «Графике»", exact: true })
  }));

  const calendarsPath = `/projects/${firstProject!.id}/calendars`;
  const conflictException = await createCalendarConflict(page, firstProject!.id);
  try {
    await page.goto(calendarsPath);
    await waitForSettledSurface(page);
    record(await captureNavigationAndBack({
      page,
      check: "calendars-conflict-open-schedule",
      origin: calendarsPath,
      expectedHref: `/projects/${firstProject!.id}/schedule`,
      link: page.getByRole("link", { name: "Открыть График", exact: true })
    }));
  } finally {
    await cleanupCalendarConflict(page, firstProject!.id, conflictException);
  }

  record(await capturePageNavigation({
    page,
    check: "settings-open-calendars",
    origin: `/projects/${firstProject!.id}/settings`,
    expectedHref: `/projects/${firstProject!.id}/calendars`,
    link: () => page.getByRole("link", { name: "Открыть Календарь", exact: true })
  }));
  record(await captureEmptyPlanningHistory(page, projectsBody.projects));

  const selectorEvidence = {
    from: firstProject!.id,
    to: secondProject!.id,
    reloadPersisted: false,
    backRestored: false,
    status: "FAIL" as "PASS" | "FAIL",
    error: ""
  };
  try {
    await page.goto(`/projects/${firstProject!.id}`);
    await waitForSettledSurface(page);
    await expect(page.getByRole("heading", { name: "Карточка проекта" })).toBeVisible();
    const selector = page.getByLabel("Проект:");
    await expect(selector).toHaveCount(1);
    await selector.selectOption(secondProject!.id);
    await expectPath(page, `/projects/${secondProject!.id}`);
    await waitForSettledSurface(page);
    await expect(page.getByRole("heading", { name: secondProject!.title, exact: true })).toBeVisible();
    await page.reload();
    await waitForSettledSurface(page);
    await expectPath(page, `/projects/${secondProject!.id}`);
    await expect(page.getByRole("heading", { name: secondProject!.title, exact: true })).toBeVisible();
    selectorEvidence.reloadPersisted = true;
    await page.goBack();
    await waitForSettledSurface(page);
    await expectPath(page, `/projects/${firstProject!.id}`);
    selectorEvidence.backRestored = true;
    selectorEvidence.status = "PASS";
  } catch (error) {
    selectorEvidence.error = errorMessage(error);
    failures.push(`project-selector: ${selectorEvidence.error}`);
  }

  record(await captureForbiddenPlanningHistory(page));

  const passCount = rows.filter((row) => row.status === "PASS").length
    + navigations.filter((item) => item.status === "PASS").length
    + (selectorEvidence.status === "PASS" ? 1 : 0);
  const failCount = rows.filter((row) => row.status === "FAIL").length
    + navigations.filter((item) => item.status === "FAIL").length
    + (selectorEvidence.status === "FAIL" ? 1 : 0);
  const inconclusiveCount = navigations.filter((item) => item.status === "INCONCLUSIVE").length;

  writeFileSync(REPORT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseURL: String(testInfo.project.use.baseURL),
    projects: projectsBody.projects.map(({ id, title }) => ({ id, title })),
    routes: rows,
    navigation: navigations,
    selector: selectorEvidence,
    summary: { total: rows.length + navigations.length + 1, pass: passCount, fail: failCount, inconclusive: inconclusiveCount },
    failures,
    inconclusive
  }, null, 2), "utf8");

  expect(failures).toEqual([]);
  expect(inconclusive).toEqual([]);
  expect(rows).toHaveLength(TABS.length);
  expect(rows.every((row) => row.status === "PASS")).toBe(true);

  function record(evidence: NavigationEvidence) {
    navigations.push(evidence);
    collectEvidence(evidence, failures, inconclusive);
  }
});

async function captureProjectListNavigation(page: Page, projects: Project[]): Promise<NavigationEvidence> {
  const origin = "/projects";
  const expectedHref = `/projects/${projects[0]!.id}`;
  try {
    await page.goto(origin);
    await waitForSettledSurface(page);
    for (const project of projects) {
      const href = `/projects/${project.id}`;
      const link = page.locator(`tbody a[href="${href}"]`).filter({ hasText: project.title });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", href);
      expect(await link.evaluate((node) => node.tagName)).toBe("A");
    }
    const firstLink = page.locator(`tbody a[href="${expectedHref}"]`).filter({ hasText: projects[0]!.title });
    await firstLink.click();
    await expectPath(page, expectedHref);
    await waitForSettledSurface(page);
    const finalUrl = page.url();
    await page.goBack();
    await waitForSettledSurface(page);
    await expectPath(page, origin);
    return { check: "projects-list-native-anchor", origin, expectedHref, actualHref: expectedHref, finalUrl, restoredUrl: page.url(), status: "PASS", error: "" };
  } catch (error) {
    return failedEvidence("projects-list-native-anchor", origin, expectedHref, errorMessage(error));
  }
}

async function captureScheduleStagedNavigationGuard(page: Page, projectId: string): Promise<NavigationEvidence> {
  const check = "schedule-staged-navigation-guard";
  const origin = `/projects/${projectId}/schedule`;
  const expectedHref = `/projects/${projectId}/settings`;
  const stagedTitle = `Navigation staged ${Date.now()}`;
  try {
    const before = await getNavigationReadModel(page, projectId);
    await page.goto(origin);
    await waitForSettledSurface(page);
    await page.getByRole("button", { name: "Пакет", exact: true }).click();
    const quickCreate = page.getByRole("textbox", { name: "Создать задачу (Enter; Tab — подзадачей)" }).last();
    await quickCreate.fill(stagedTitle);
    await quickCreate.press("Enter");
    await expect(page.getByText("накоплено:")).toContainText("1");

    const settingsLink = deliveryNav(page, projectId).locator(`a[href="${expectedHref}"]`);
    let dismissedMessage = "";
    page.once("dialog", async (dialog) => {
      dismissedMessage = dialog.message();
      await dialog.dismiss();
    });
    await settingsLink.click();
    await expectPath(page, origin);
    await expect(page.getByText("накоплено:")).toContainText("1");
    expect(dismissedMessage).toContain("неприменённые изменения");

    let baselineMessage = "";
    page.once("dialog", async (dialog) => {
      baselineMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.locator(`a[href="/projects/${projectId}/baseline"]`).last().click();
    await expectPath(page, origin);
    await expect(page.getByText("накоплено:")).toContainText("1");
    expect(baselineMessage).toContain("неприменённые изменения");

    let sidebarMessage = "";
    page.once("dialog", async (dialog) => {
      sidebarMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole("navigation", { name: "Основная навигация" }).getByRole("link", { name: "Проекты", exact: true }).click();
    await expectPath(page, origin);
    await expect(page.getByText("накоплено:")).toContainText("1");
    expect(sidebarMessage).toContain("неприменённые изменения");

    let backMessage = "";
    page.once("dialog", async (dialog) => {
      backMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.back());
    await expectPath(page, origin);
    await expect(page.getByText("накоплено:")).toContainText("1");
    expect(backMessage).toContain("неприменённые изменения");

    let acceptedMessage = "";
    page.once("dialog", async (dialog) => {
      acceptedMessage = dialog.message();
      await dialog.accept();
    });
    await settingsLink.click();
    await expectPath(page, expectedHref);
    await waitForSettledSurface(page);
    expect(acceptedMessage).toContain("неприменённые изменения");

    const after = await getNavigationReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion);
    expect(after.authored.tasks.some((task) => task.title === stagedTitle)).toBe(false);
    return {
      check,
      origin,
      expectedHref,
      actualHref: expectedHref,
      finalUrl: page.url(),
      restoredUrl: "tab/baseline/sidebar/back cancelled on origin before confirm",
      status: "PASS",
      error: ""
    };
  } catch (error) {
    return failedEvidence(check, origin, expectedHref, errorMessage(error));
  }
}
async function capturePageNavigation({ page, check, origin, expectedHref, link }: {
  page: Page;
  check: string;
  origin: string;
  expectedHref: string;
  link: () => Locator;
}): Promise<NavigationEvidence> {
  try {
    await page.goto(origin);
    await waitForSettledSurface(page);
  } catch (error) {
    return failedEvidence(check, origin, expectedHref, errorMessage(error));
  }
  return captureNavigationAndBack({ page, check, origin, expectedHref, link: link() });
}

async function captureNavigationAndBack({ page, check, origin, expectedHref, link }: {
  page: Page;
  check: string;
  origin: string;
  expectedHref: string;
  link: Locator;
}): Promise<NavigationEvidence> {
  let actualHref = "";
  let finalUrl = "";
  try {
    await expect(link).toHaveCount(1);
    await expect(link).toBeVisible();
    actualHref = (await link.getAttribute("href")) ?? "";
    expect(actualHref).toBe(expectedHref);
    expect(await link.evaluate((node) => node.tagName)).toBe("A");
    await link.click();
    await expectPath(page, expectedHref);
    await waitForSettledSurface(page);
    finalUrl = page.url();
    await page.goBack();
    await waitForSettledSurface(page);
    await expectPath(page, origin);
    return { check, origin, expectedHref, actualHref, finalUrl, restoredUrl: page.url(), status: "PASS", error: "" };
  } catch (error) {
    if (new URL(page.url()).pathname !== origin) {
      await page.goto(origin).catch(() => undefined);
      await waitForSettledSurface(page).catch(() => undefined);
    }
    return { check, origin, expectedHref, actualHref, finalUrl, restoredUrl: page.url(), status: "FAIL", error: errorMessage(error) };
  }
}

function deliveryNav(page: Page, projectId: string): Locator {
  return page.getByRole("navigation").filter({ has: page.locator(`a[href="/projects/${projectId}/overview"]`) });
}

async function assertTabContracts(nav: Locator, projectId: string, activeSlug: string) {
  await expect(nav).toHaveCount(1);
  for (const [, slug] of TABS) {
    const href = `/projects/${projectId}/${slug}`;
    const link = nav.locator(`a[href="${href}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", href);
    if (slug === activeSlug) await expect(link).toHaveAttribute("aria-current", "page");
    else expect(await link.getAttribute("aria-current")).toBeNull();
  }
}

async function expectPath(page: Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path);
}

function collectEvidence(evidence: NavigationEvidence, failures: string[], inconclusive: string[]) {
  if (evidence.status === "FAIL") failures.push(`${evidence.check}: ${evidence.error}`);
  if (evidence.status === "INCONCLUSIVE") inconclusive.push(`${evidence.check}: ${evidence.error}`);
}

function failedEvidence(check: string, origin: string, expectedHref: string, error: string): NavigationEvidence {
  return { check, origin, expectedHref, actualHref: "", finalUrl: "", restoredUrl: "", status: "FAIL", error };
}

function inconclusiveEvidence(check: string, origin: string, reason: string): NavigationEvidence {
  return { check, origin, expectedHref: "", actualHref: "", finalUrl: "", restoredUrl: origin, status: "INCONCLUSIVE", error: reason };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function captureEmptyPlanningHistory(page: Page, projects: Project[]): Promise<NavigationEvidence> {
  const check = "overview-empty-planning-history";
  try {
    let emptyProject: Project | undefined;
    for (const project of projects) {
      const response = await page.request.get(
        `/api/tenant/current/audit-events?projectId=${encodeURIComponent(project.id)}`
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        auditEvents: Array<{ sourceWorkflow?: string }>;
      };
      if (!body.auditEvents.some((event) => event.sourceWorkflow === "planning")) {
        emptyProject = project;
        break;
      }
    }
    expect(emptyProject).toBeTruthy();
    const origin = `/projects/${emptyProject!.id}/overview`;
    await page.goto(origin);
    await waitForSettledSurface(page);
    await expect(page.getByText("История пуста.", { exact: true })).toBeVisible();
    return { check, origin, expectedHref: origin, actualHref: origin, finalUrl: page.url(), restoredUrl: page.url(), status: "PASS", error: "" };
  } catch (error) {
    return failedEvidence(check, "/projects/:id/overview", "successful empty planning history", errorMessage(error));
  }
}

async function captureForbiddenPlanningHistory(page: Page): Promise<NavigationEvidence> {
  const check = "overview-forbidden-planning-history";
  try {
    await page.context().clearCookies();
    await login(page, "plan-reader-no-resources@kiss-pm.local", "reader12345");
    const projectsResponse = await page.request.get("/api/workspace/projects");
    expect(projectsResponse.status()).toBe(200);
    const projects = ((await projectsResponse.json()) as { projects: Project[] }).projects;
    expect(projects.length).toBeGreaterThan(0);
    const origin = `/projects/${projects[0]!.id}/overview`;
    const auditResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/tenant/current/audit-events" && url.searchParams.get("projectId") === projects[0]!.id;
    });
    await page.goto(origin);
    const auditResponse = await auditResponsePromise;
    expect(auditResponse.status()).toBe(403);
    await waitForSettledSurface(page);
    await expect(page.getByText("История изменений недоступна: недостаточно прав.", { exact: true })).toBeVisible();
    return { check, origin, expectedHref: origin, actualHref: origin, finalUrl: page.url(), restoredUrl: page.url(), status: "PASS", error: "" };
  } catch (error) {
    return failedEvidence(check, "/projects/:id/overview", "audit-events 403 with explicit forbidden state", errorMessage(error));
  }
}
async function createCalendarConflict(page: Page, projectId: string): Promise<CalendarException> {
  const model = await getNavigationReadModel(page, projectId);
  const calendar = model.calendars.find((item) => item.id === model.project.calendarId);
  expect(calendar).toBeTruthy();
  const existingDates = new Set(
    model.calendarExceptions
      .filter((item) => item.calendarId === calendar!.id && item.workingMinutes < calendar!.workingMinutesPerDay)
      .map((item) => item.date)
  );
  const task = model.calculatedPlan.tasks.find((item) => item.calculatedStart && item.calculatedFinish);
  expect(task).toBeTruthy();
  const date = findWorkingDate(task!.calculatedStart!, task!.calculatedFinish!, calendar!.workingWeekdays, existingDates);
  expect(date).toBeTruthy();
  const exception: CalendarException = {
    id: `navigation-conflict-${Date.now()}`,
    calendarId: calendar!.id,
    resourceId: null,
    date: date!,
    workingMinutes: 0,
    reason: "Navigation CTA acceptance"
  };
  const response = await page.request.post(
    `/api/workspace/projects/${projectId}/planning/apply-command`,
    {
      headers: sameOriginMutationHeaders(page),
      data: {
        clientPlanVersion: model.planVersion,
        command: { type: "calendar.exception.upsert", payload: exception }
      }
    }
  );
  expect(response.status()).toBe(200);
  return exception;
}

async function cleanupCalendarConflict(page: Page, projectId: string, exception: CalendarException) {
  const model = await getNavigationReadModel(page, projectId);
  const calendar = model.calendars.find((item) => item.id === exception.calendarId);
  if (!calendar) return;
  const response = await page.request.post(
    `/api/workspace/projects/${projectId}/planning/apply-command`,
    {
      headers: sameOriginMutationHeaders(page),
      data: {
        clientPlanVersion: model.planVersion,
        command: {
          type: "calendar.exception.upsert",
          payload: { ...exception, workingMinutes: calendar.workingMinutesPerDay, reason: "" }
        }
      }
    }
  );
  expect(response.status()).toBe(200);
}

async function getNavigationReadModel(page: Page, projectId: string): Promise<NavigationReadModel> {
  const response = await page.request.get(`/api/workspace/projects/${projectId}/planning/read-model`);
  expect(response.status()).toBe(200);
  return (await response.json()) as NavigationReadModel;
}

function findWorkingDate(start: string, finish: string, workingWeekdays: number[], excluded: Set<string>): string | null {
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const end = new Date(`${finish}T00:00:00.000Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (workingWeekdays.includes(cursor.getUTCDay()) && !excluded.has(date)) return date;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

function sameOriginMutationHeaders(page: Page) {
  return { Origin: new URL(page.url()).origin, "x-kiss-pm-action": "same-origin" };
}
async function loginAsAdmin(page: Page) {
  await login(page, "admin@kiss-pm.local", "admin12345");
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
      "Загрузка настроек…"
    ].some((label) => text.includes(label)) && !text.includes("Загрузка…");
  }, undefined, { timeout: 20_000 });
}
