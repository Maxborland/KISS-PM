import { expect, test as browserTest } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { loginAsAdmin } from "../planning/planningHelpers";
import { test as runtimeTest } from "../runtime/runtimeQaFixtures";

const PROJECT_ID = "project-demo-crm-intake";
const PROJECT_NAV_LABEL = "Разделы проекта";
const isCommitsReadUrl = (url: URL) =>
  url.pathname === `/api/workspace/projects/${PROJECT_ID}/planning/commits`;

type ProjectTab = {
  label: string;
  slug: string;
  ready: (page: Page) => Locator;
};

const PROJECT_TABS: readonly ProjectTab[] = [
  {
    label: "Обзор",
    slug: "overview",
    ready: (page) => page.getByRole("heading", { name: "Обзор проекта", exact: true })
  },
  {
    label: "График",
    slug: "schedule",
    ready: (page) => page.getByRole("button", { name: "Пакет", exact: true })
  },
  {
    label: "Ресурсы",
    slug: "resources",
    ready: (page) => page.getByRole("button", { name: "Только перегруженные", exact: true })
  },
  {
    label: "Назначения",
    slug: "assignments",
    ready: (page) =>
      page.getByText(/^Задача → исполнители с дневной кривой распределения\./)
  },
  {
    label: "Календари",
    slug: "calendars",
    ready: (page) =>
      page.getByRole("heading", { name: "Календари проекта и ресурсов", exact: true })
  },
  {
    label: "Сценарии",
    slug: "scenarios",
    ready: (page) => page.getByRole("heading", { name: "Сценарии планирования", exact: true })
  },
  {
    label: "Baseline",
    slug: "baseline",
    ready: (page) => page.getByRole("heading", { name: "Базовый план", exact: true })
  },
  {
    label: "Коммиты",
    slug: "commits",
    ready: (page) => page.getByRole("heading", { name: "Коммиты плана", exact: true })
  },
  {
    label: "Настройки",
    slug: "settings",
    ready: (page) => page.getByRole("heading", { name: "Настройки проекта", exact: true })
  }
];

runtimeTest("project delivery tabs navigate through all current routes", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(projectPath("overview"));

  const projectNavigation = projectTabs(page);
  await expect(PROJECT_TABS[0]!.ready(page)).toBeVisible();
  await expectProjectTabs(projectNavigation, "overview");

  const scheduleTab = tabLink(projectNavigation, PROJECT_TABS[1]!);
  await scheduleTab.focus();
  await expect(scheduleTab).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(projectUrl("schedule"));
  await expect(PROJECT_TABS[1]!.ready(page)).toBeVisible();
  await expectProjectTabs(projectNavigation, "schedule");

  for (const tab of PROJECT_TABS.slice(2)) {
    await tabLink(projectNavigation, tab).click();
    await expect(page).toHaveURL(projectUrl(tab.slug));
    await expect(tab.ready(page)).toBeVisible();
    await expectProjectTabs(projectNavigation, tab.slug);
  }
});

runtimeTest("project route actions use their existing destinations", async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto(projectPath("overview"));
  await expect(PROJECT_TABS[0]!.ready(page)).toBeVisible();
  const overview = page.getByRole("main");
  await expect(
    overview.getByRole("link", { name: "Открыть График", exact: true }).first()
  ).toHaveAttribute("href", projectPath("schedule"));
  await expect(
    overview.getByRole("link", { name: "Открыть Сценарии", exact: true })
  ).toHaveAttribute("href", projectPath("scenarios"));
  await expect(
    overview.getByRole("link", { name: "Открыть Baseline", exact: true })
  ).toHaveAttribute("href", projectPath("baseline"));
  await expect(
    overview.getByRole("link", { name: "Показать путь", exact: true })
  ).toHaveAttribute("href", projectPath("schedule"));
  await expect(overview.getByRole("link", { name: "Все", exact: true })).toHaveAttribute(
    "href",
    projectPath("commits")
  );

  await page.goto(projectPath("schedule"));
  await expect(PROJECT_TABS[1]!.ready(page)).toBeVisible();
  const schedule = page.getByRole("main");
  await expect(schedule.getByRole("link", { name: "Baseline", exact: true })).toHaveAttribute(
    "href",
    projectPath("baseline")
  );

  await page.goto(projectPath("settings"));
  await expect(PROJECT_TABS[8]!.ready(page)).toBeVisible();
  const settings = page.getByRole("main");
  await expect(
    settings.getByRole("link", { name: "Открыть Календарь", exact: true })
  ).toHaveAttribute("href", projectPath("calendars"));
  await expect(settings.getByRole("button", { name: "Подключить", exact: true })).toBeDisabled();
});

runtimeTest("project tabs remain semantic links while the read model loads", async ({ page }) => {
  await loginAsAdmin(page);

  let releaseReadModel: (() => void) | undefined;
  const readModelReleased = new Promise<void>((resolve) => {
    releaseReadModel = resolve;
  });

  await page.route(readModelUrl(), async (route) => {
    await readModelReleased;
    await route.continue();
  });

  await page.goto(projectPath("overview"));
  const projectNavigation = projectTabs(page);
  await expect(page.locator("[aria-busy=\"true\"]")).toBeVisible();
  await expectProjectTabs(projectNavigation, "overview");

  releaseReadModel?.();
  await expect(PROJECT_TABS[0]!.ready(page)).toBeVisible();
  await page.unroute(readModelUrl());
});

runtimeTest("project commits preserves tab navigation while its history loads empty", async ({ page }) => {
  await loginAsAdmin(page);

  let releaseAuditEvents: (() => void) | undefined;
  const auditEventsReleased = new Promise<void>((resolve) => {
    releaseAuditEvents = resolve;
  });
  await page.route(isCommitsReadUrl, async (route) => {
    await auditEventsReleased;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ auditEvents: [] })
    });
  });

  try {
    await page.goto(projectPath("commits"));
    const projectNavigation = projectTabs(page);
    await expect(page.getByText("Загрузка истории…", { exact: true })).toBeVisible();
    await expect(page.getByText("История пуста.", { exact: true })).not.toBeVisible();
    await expectProjectTabs(projectNavigation, "commits");
  } finally {
    releaseAuditEvents?.();
  }

  await expect(page.getByText("История пуста.", { exact: true })).toBeVisible();
  await page.unroute(isCommitsReadUrl);
});

browserTest("project commits preserves tab navigation when its history fails", async ({ page }) => {
  await loginAsAdmin(page);
  await page.route(isCommitsReadUrl, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "audit_events_failed" })
    });
  });

  await page.goto(projectPath("commits"));
  const projectNavigation = projectTabs(page);
  const historyError = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: "Не удалось загрузить" });
  await expect(historyError).toContainText("Не удалось выполнить операцию планирования");
  await expect(historyError.getByRole("button", { name: "Повторить", exact: true })).toBeVisible();
  await expectProjectTabs(projectNavigation, "commits");
  await page.unroute(isCommitsReadUrl);
});

runtimeTest("project tab strip reveals the active mobile deep link", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);
  await page.goto(projectPath("settings"));
  await expect(PROJECT_TABS[8]!.ready(page)).toBeVisible();

  const settingsTab = tabLink(projectTabs(page), PROJECT_TABS[8]!);
  await expect(settingsTab).toHaveAttribute("aria-current", "page");
  await expect(settingsTab).toBeInViewport();
});

runtimeTest("project commits selects the compensating commit after a revert", async ({ page }) => {
  await loginAsAdmin(page);

  const readModelResponse = await page.request.get(
    `/api/workspace/projects/${PROJECT_ID}/planning/read-model`
  );
  expect(readModelResponse.ok()).toBeTruthy();
  const readModel = (await readModelResponse.json()) as {
    planVersion: number;
    authored: { tasks: Array<{ id: string; percentComplete: number }> };
  };
  const task = readModel.authored.tasks.find(
    (candidate) => candidate.id === "task-demo-resource-estimate"
  );
  expect(task).toBeTruthy();
  if (!task) throw new Error("Seeded project is missing task-demo-resource-estimate");

  const applyResponse = await page.request.post(
    `/api/workspace/projects/${PROJECT_ID}/planning/apply-command`,
    {
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      data: {
        command: {
          type: "task.update_progress",
          payload: {
            taskId: task.id,
            percentComplete: task.percentComplete === 0 ? 1 : 0
          }
        },
        clientPlanVersion: readModel.planVersion
      }
    }
  );
  expect(applyResponse.ok()).toBeTruthy();

  await page.goto(projectPath("commits"));
  await expect(PROJECT_TABS[7]!.ready(page)).toBeVisible();
  const revertResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/workspace/projects/${PROJECT_ID}/planning/revert-last`)
  );
  await page.getByRole("button", { name: "Откатить последний", exact: true }).click();
  const reverted = (await (await revertResponse).json()) as { newPlanVersion: number };

  await expect(
    page.getByText(`v${reverted.newPlanVersion - 1} → v${reverted.newPlanVersion}`, { exact: true })
  ).toBeVisible();
});

for (const failureCase of [
  {
    name: "error",
    status: 500,
    body: { error: "planning_read_failed" },
    state: (page: Page) => page.getByRole("alert").filter({ hasText: "Не удалось загрузить" })
  },
  {
    name: "permission denial",
    status: 403,
    body: { error: "forbidden" },
    state: (page: Page) => page.getByText("Доступ ограничен", { exact: true })
  }
] as const) {
  browserTest(`project tabs remain navigable after ${failureCase.name}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.route(readModelUrl(), async (route) => {
      await route.fulfill({
        status: failureCase.status,
        contentType: "application/json",
        body: JSON.stringify(failureCase.body)
      });
    });

    for (const tab of PROJECT_TABS) {
      await page.goto(projectPath(tab.slug));
      const projectNavigation = projectTabs(page);
      await expect(failureCase.state(page)).toBeVisible();
      await expectProjectTabs(projectNavigation, tab.slug);
    }

    await page.unroute(readModelUrl());
  });
}

function projectTabs(page: Page): Locator {
  return page.getByRole("navigation", { name: PROJECT_NAV_LABEL });
}

function tabLink(projectNavigation: Locator, tab: ProjectTab): Locator {
  return projectNavigation.getByRole("link", { name: tab.label, exact: true });
}

async function expectProjectTabs(projectNavigation: Locator, activeSlug: string) {
  for (const tab of PROJECT_TABS) {
    const link = tabLink(projectNavigation, tab);
    await expect(link).toHaveAttribute("href", projectPath(tab.slug));
    if (tab.slug === activeSlug) {
      await expect(link).toHaveAttribute("aria-current", "page");
    } else {
      await expect(link).not.toHaveAttribute("aria-current");
    }
  }
}

function projectPath(slug: string) {
  return `/projects/${PROJECT_ID}/${slug}`;
}

function projectUrl(slug: string) {
  return new RegExp(`${projectPath(slug)}$`);
}

function readModelUrl() {
  return `**/api/workspace/projects/${PROJECT_ID}/planning/read-model`;
}
