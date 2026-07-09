import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page, type Response } from "@playwright/test";

const EVIDENCE_DIR = join(
  process.cwd(),
  ".superloopy",
  "evidence",
  "auth-shell-2026-07-10",
  "screenshots"
);

const NAV_ITEMS = [
  { label: "Мои задачи", href: "/my-work" },
  { label: "Проекты", href: "/projects" },
  { label: "Сделки", href: "/crm/deals" },
  { label: "Дашборд", href: "/dashboard" },
  { label: "Коммуникации", href: "/communications/chat" },
  { label: "Администрирование", href: "/admin" }
] as const;

type NavLabel = (typeof NAV_ITEMS)[number]["label"];

type RoleCase = {
  code: "AADM" | "EADM" | "PLAN" | "RES" | "BADM";
  email: string;
  password: string;
  userId: string;
  name: string;
  initials: string;
  visibleNav: NavLabel[];
  searchResult?: {
    typeLabel: "Проект";
    title: string;
    route: string;
  };
};

const ROLES: RoleCase[] = [
  {
    code: "AADM",
    email: "admin@kiss-pm.local",
    password: "admin12345",
    userId: "user-alpha-admin",
    name: "Анна Администратор",
    initials: "АА",
    visibleNav: NAV_ITEMS.map((item) => item.label),
    searchResult: {
      typeLabel: "Проект",
      title: "Портал подрядчиков Вектор",
      route: "/projects/project-vektor-portal"
    }
  },
  {
    code: "EADM",
    email: "engineer@kiss-pm.local",
    password: "engineer12345",
    userId: "user-alpha-engineer",
    name: "Игорь Инженер",
    initials: "ИИ",
    visibleNav: NAV_ITEMS.map((item) => item.label),
    searchResult: {
      typeLabel: "Проект",
      title: "Портал подрядчиков Вектор",
      route: "/projects/project-vektor-portal"
    }
  },
  {
    code: "PLAN",
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345",
    userId: "user-alpha-plan-reader-no-resources",
    name: "Никита Без Ресурсов",
    initials: "НБ",
    visibleNav: ["Мои задачи", "Проекты", "Дашборд"],
    searchResult: {
      typeLabel: "Проект",
      title: "Портал подрядчиков Вектор",
      route: "/projects/project-vektor-portal"
    }
  },
  {
    code: "RES",
    email: "resource-reader@kiss-pm.local",
    password: "resource12345",
    userId: "user-alpha-resource-reader",
    name: "Роман Ресурсный",
    initials: "РР",
    visibleNav: []
  },
  {
    code: "BADM",
    email: "beta@kiss-pm.local",
    password: "beta12345",
    userId: "user-beta-admin",
    name: "Борис Администратор",
    initials: "БА",
    visibleNav: NAV_ITEMS.map((item) => item.label)
  }
];

type MeReadback = {
  status: number;
  userId: string | null;
  name: string | null;
};

async function loginAs(
  page: Page,
  role: RoleCase,
  expectedPath = "/dashboard"
): Promise<{ loginStatus: number; me: MeReadback }> {
  await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
  await page.getByLabel("Email").fill(role.email);
  await page.getByLabel("Пароль", { exact: true }).fill(role.password);

  const loginResponsePromise = page.waitForResponse((response) =>
    isApiResponse(response, "POST", "/api/auth/login")
  );
  await page.getByRole("button", { name: "Войти" }).click();
  const loginResponse = await loginResponsePromise;

  expect(loginResponse.status(), `${role.code} POST /api/auth/login`).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(expectedPath)}$`));
  const me = await readMe(page);
  expect(me, `${role.code} GET /api/auth/me readback`).toEqual({
    status: 200,
    userId: role.userId,
    name: role.name
  });

  return { loginStatus: loginResponse.status(), me };
}

async function readMe(page: Page): Promise<MeReadback> {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
      headers: { accept: "application/json" }
    });
    const body = response.ok
      ? ((await response.json()) as { user?: { id?: string; name?: string } })
      : null;
    return {
      status: response.status,
      userId: body?.user?.id ?? null,
      name: body?.user?.name ?? null
    };
  });
}

function isApiResponse(response: Response, method: string, pathname: string): boolean {
  const url = new URL(response.url());
  return response.request().method() === method && url.pathname === pathname;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function capture(page: Page, role: RoleCase, checkpoint: string) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCE_DIR, `${role.code.toLowerCase()}-${checkpoint}.png`),
    fullPage: true
  });
}

test.use({ viewport: { width: 1440, height: 900 } });

for (const role of ROLES) {
  test(`SHELL-NAV + AUTH-LOGOUT ${role.code}: desktop role shell survives logout and relogin`, async ({ page }) => {
    test.setTimeout(120_000);

    const responseStatuses: Array<{ method: string; path: string; status: number }> = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/auth/") || url.pathname === "/api/workspace/search") {
        responseStatuses.push({
          method: response.request().method(),
          path: url.pathname,
          status: response.status()
        });
      }
    });

    await page.goto("/login");
    const initialLogin = await loginAs(page, role);

    const sidebar = page.getByRole("complementary", { name: "Навигация рабочей области" });
    const navigation = sidebar.getByRole("navigation", { name: "Основная навигация" });
    const navLinks = navigation.getByRole("link");
    const avatar = page.getByRole("banner").getByTitle(role.name);

    await expect(sidebar).toBeVisible();
    await expect(avatar).toHaveText(role.initials);
    await expect(navLinks).toHaveCount(role.visibleNav.length);
    expect(await navLinks.allTextContents()).toEqual(role.visibleNav);

    for (const item of NAV_ITEMS) {
      const link = navigation.getByRole("link", { name: item.label, exact: true });
      if (!role.visibleNav.includes(item.label)) {
        await expect(link, `${role.code} must not expose ${item.label}`).toHaveCount(0);
        continue;
      }

      await expect(link).toHaveAttribute("href", item.href);
      await link.click();
      await expect(page, `${role.code} clicked ${item.label}`).toHaveURL(
        new RegExp(`${item.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)
      );
      await expect(
        navigation.getByRole("link", { name: item.label, exact: true }),
        `${role.code} active item ${item.label}`
      ).toHaveClass(/font-semibold/);
      await expect(page.locator("body")).not.toContainText(/permission_missing|Доступ ограничен/);
    }

    await capture(page, role, "desktop-nav");

    const search = page.getByRole("combobox", { name: "Глобальный поиск" });
    const searchResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/workspace/search" &&
        url.searchParams.get("q") === "Вектор"
      );
    });
    await search.fill("Вектор");
    const searchResponse = await searchResponsePromise;
    const searchBody = (await searchResponse.json()) as {
      results: Array<{ title: string; route: string }>;
    };
    expect(searchResponse.status(), `${role.code} GET /api/workspace/search`).toBe(200);

    if (role.searchResult) {
      expect(searchBody.results).toContainEqual(
        expect.objectContaining({
          title: role.searchResult.title,
          route: role.searchResult.route
        })
      );
      const result = page.getByRole("button", {
        name: new RegExp(
          `^${role.searchResult.typeLabel} ${escapeRegExp(role.searchResult.title)}(?:\\s|$)`
        )
      });
      await expect(result).toBeVisible();
      await result.click();
      await expect(page, `${role.code} search result navigation`).toHaveURL(
        new RegExp(`${role.searchResult.route}$`)
      );
    } else {
      expect(searchBody.results, `${role.code} has no routable Вектор result`).toEqual([]);
      await expect(page.getByText("Ничего не найдено по «Вектор»")).toBeVisible();
      await search.press("Escape");
    }

    await avatar.click();
    const userMenu = page.getByRole("menu");
    await expect(userMenu).toContainText(role.name);
    await expect(userMenu).toContainText(role.userId);
    const profileLink = userMenu.getByRole("menuitem", { name: "Профиль" });
    const settingsLink = userMenu.getByRole("menuitem", { name: "Настройки" });
    await expect(profileLink).toHaveAttribute("href", "/profile");
    await expect(settingsLink).toHaveAttribute("href", "/settings");
    await capture(page, role, "identity-menu");

    await profileLink.click();
    await expect(page).toHaveURL(/\/profile$/);
    expect(await readMe(page), `${role.code} profile session readback`).toEqual(initialLogin.me);

    await page.getByRole("banner").getByTitle(role.name).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Настройки" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    expect(await readMe(page), `${role.code} settings session readback`).toEqual(initialLogin.me);

    await page.getByRole("banner").getByTitle(role.name).click();
    const logoutResponsePromise = page.waitForResponse((response) =>
      isApiResponse(response, "POST", "/api/auth/logout")
    );
    const me401ResponsePromise = page.waitForResponse(
      (response) => isApiResponse(response, "GET", "/api/auth/me") && response.status() === 401
    );
    await page.getByRole("menu").getByRole("menuitem", { name: "Выйти" }).click();
    const [logoutResponse, me401Response] = await Promise.all([
      logoutResponsePromise,
      me401ResponsePromise
    ]);
    expect(logoutResponse.status(), `${role.code} POST /api/auth/logout`).toBe(200);
    expect(me401Response.status(), `${role.code} GET /api/auth/me after logout`).toBe(401);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
    expect(await readMe(page), `${role.code} explicit post-logout readback`).toEqual({
      status: 401,
      userId: null,
      name: null
    });
    await capture(page, role, "logged-out-public");

    await page.goBack({ waitUntil: "domcontentloaded" });
    expect.soft(new URL(page.url()).pathname, `${role.code} browser back remains public`).toBe("/login");
    expect(await readMe(page), `${role.code} back-navigation session remains revoked`).toEqual({
      status: 401,
      userId: null,
      name: null
    });
    await capture(page, role, "browser-back-after-logout");
    const reloadResponse = await page.reload({ waitUntil: "domcontentloaded" });
    expect(reloadResponse?.status(), `${role.code} public reload status`).toBe(200);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();

    const relogin = await loginAs(page, role, "/profile");
    await expect(page.getByRole("banner").getByTitle(role.name)).toHaveText(role.initials);
    await expect(
      page
        .getByRole("complementary", { name: "Навигация рабочей области" })
        .getByRole("navigation", { name: "Основная навигация" })
        .getByRole("link")
    ).toHaveCount(role.visibleNav.length);
    await capture(page, role, "relogin-restored");

    console.log(
      `SHELL_ROLE_NAV_RECEIPT ${JSON.stringify({
        role: role.code,
        initialLogin,
        visibleNav: role.visibleNav,
        search: {
          status: searchResponse.status(),
          resultCount: searchBody.results.length,
          navigatedTo: role.searchResult?.route ?? null
        },
        logoutStatus: logoutResponse.status(),
        meAfterLogoutStatus: me401Response.status(),
        publicReloadStatus: reloadResponse?.status() ?? null,
        relogin,
        responseStatuses
      })}`
    );
  });
}
