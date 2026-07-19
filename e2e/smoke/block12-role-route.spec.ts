import { expect, test, type Page, type Response } from "@playwright/test";

// Блок 12 · Д3 — role×route батч честности.
// Под НЕ-admin ролями из seed (scripts/seed-dev.ts) обходим ключевые роуты рабочей
// области. Инвариант: каждый роут либо ОТКРЫВАЕТСЯ (право есть — рендерится живая
// поверхность), либо честно ЗАКРЫТ (права нет — «Доступ ограничен»/«…недоступно»
// в оболочке WorkspaceShell), либо ведёт на /login. Запрещены: белый экран (нет
// landmark-навигации), краш-бандари (`app/error.tsx` — h1 «Ошибка» + «Повторить»),
// любой 5xx на документ или /api/*. /admin обязан быть forbidden для не-админа.

type RouteState = "ready" | "forbidden" | "redirect";

type NonAdminRole = {
  code: "CRM" | "PLAN" | "RES";
  email: string;
  password: string;
  userId: string;
  // Доступ к /admin определяется правами: /admin (AdminIndexRedirect) ведёт на первую
  // доступную вкладку, AdminFrame закрывает её при отсутствии ВСЕХ ADMIN_PERMISSIONS.
  // crm-reader имеет tenant.users.read (одно из админ-прав) → /admin/users открыт;
  // plan-reader/resource-reader админ-прав не имеют → честный «нет доступа».
  adminAccess: "open" | "closed";
};

// Живые не-admin роли (у engineer в seed профиль alpha-admin — он admin, поэтому
// исключён). Пароли и профили — scripts/seed-dev.ts:255-300, permissions :57-88.
const ROLES: NonAdminRole[] = [
  {
    code: "CRM",
    email: "crm-reader@kiss-pm.local",
    password: "crmreader12345",
    userId: "user-alpha-crm-reader",
    adminAccess: "open"
  },
  {
    code: "PLAN",
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345",
    userId: "user-alpha-plan-reader-no-resources",
    adminAccess: "closed"
  },
  {
    code: "RES",
    email: "resource-reader@kiss-pm.local",
    password: "resource12345",
    userId: "user-alpha-resource-reader",
    adminAccess: "closed"
  }
];

const ROUTES = [
  "/crm/deals",
  "/crm/clients",
  "/crm/contacts",
  "/crm/products",
  "/projects",
  "/capacity",
  "/admin",
  "/agent"
] as const;

async function login(page: Page, role: NonAdminRole) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(role.email);
  await page.getByLabel("Пароль", { exact: true }).fill(role.password);
  const loginResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/login" && r.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  expect((await loginResponse).status(), `${role.code} POST /api/auth/login`).toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const me = await page.evaluate(async () => {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    const body = res.ok ? ((await res.json()) as { user?: { id?: string } }) : null;
    return { status: res.status, userId: body?.user?.id ?? null };
  });
  expect(me, `${role.code} GET /api/auth/me readback`).toEqual({
    status: 200,
    userId: role.userId
  });
}

async function classifyRoute(page: Page, role: NonAdminRole, route: string): Promise<RouteState> {
  const landmark = page.getByRole("complementary", { name: "Навигация рабочей области" });
  const onLogin = () => new URL(page.url()).pathname.startsWith("/login");

  // Ждём ТЕРМИНАЛЬНОЕ состояние: оболочка отрисована ИЛИ ушли на /login. Клиентские
  // редиректы (/admin → /admin/<tab> через shell-less LoadingState, root-guard) не
  // мгновенны — ранняя проверка landmark ловила бы фазу загрузки. 15с с запасом.
  try {
    await landmark.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    if (onLogin()) return "redirect";
    throw new Error(
      `${role.code} ${route}: нет ни оболочки, ни /login (белый экран?) — url=${page.url()}`
    );
  }

  // Краш-бандари app/error.tsx: h1 «Ошибка» + кнопка «Повторить».
  const crashBoundary = page
    .getByRole("heading", { name: "Ошибка", exact: true })
    .and(page.locator(".page-intro__title"));
  await expect(crashBoundary, `${role.code} ${route}: no app crash boundary`).toHaveCount(0);

  // RBAC-гейт (AdminFrame/SurfaceState) применяется ПОСЛЕ загрузки сессии с правами —
  // landmark появляется раньше, поэтому единичное чтение body ловило фазу до гейта
  // и давало «ready» вместо «forbidden». Ждём терминальное состояние по СТРУКТУРНОМУ
  // маркеру загрузки LoadingState (aria-busy) — текстовые эвристики ловили заголовки
  // (напр. «Загрузка ресурсов» на /capacity). settled = нет активных загрузчиков.
  const forbiddenRe = /Доступ ограничен|недоступн|нет прав на просмотр/i;
  const busy = page.locator('[aria-busy="true"]');
  await expect
    .poll(async () => (await busy.count()) === 0, {
      timeout: 10_000,
      message: `${role.code} ${route}: поверхность не осела (загрузчик активен)`
    })
    .toBe(true);
  const bodyText = await page.locator("body").innerText();
  return forbiddenRe.test(bodyText) ? "forbidden" : "ready";
}

test.describe("Блок 12 · Д3 role×route честность (не-admin роли)", () => {
  for (const role of ROLES) {
    test(`ROLE-ROUTE ${role.code}: каждый роут открыт, честно закрыт или redirect — без белых экранов и 5xx`, async ({
      page
    }) => {
      test.setTimeout(120_000);

      const serverErrors: string[] = [];
      page.on("response", (response: Response) => {
        const url = new URL(response.url());
        const isDoc = response.request().resourceType() === "document";
        const isApi = url.pathname.startsWith("/api/");
        if ((isDoc || isApi) && response.status() >= 500) {
          serverErrors.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
        }
      });

      // Неперехваченное исключение страницы — тоже нечестный экран (крах рендера
      // ловится error.tsx и в pageerror не приходит, но необёрнутые ошибки — сюда).
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => {
        pageErrors.push(`${new URL(page.url()).pathname}: ${error.message}`);
      });

      await login(page, role);

      const outcomes: Array<{ route: string; state: RouteState }> = [];
      for (const route of ROUTES) {
        const gotoResponse = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(
          gotoResponse?.status() ?? 0,
          `${role.code} ${route}: document status`
        ).toBeLessThan(500);
        // Осадку поверхности (загрузчики/RBAC-редиректы) ждёт сам classifyRoute по
        // landmark/`/login`; networkidle тут не годится — /agent держит SSE-стрим.
        const state = await classifyRoute(page, role, route);
        outcomes.push({ route, state });
      }

      // Инвариант: 5xx на документ/API запрещены для любого роута.
      expect(serverErrors, `${role.code}: server 5xx during route sweep`).toEqual([]);
      // Инвариант: ни один роут не выбросил необёрнутое исключение страницы.
      expect(pageErrors, `${role.code}: uncaught page errors during route sweep`).toEqual([]);

      // Правило блока: /admin закрыт для ролей без единого админ-права (PLAN/RES →
      // forbidden/redirect). crm-reader имеет tenant.users.read → /admin/users открыт
      // честно (это не дыра, а RBAC): для него проверяем лишь честный исход (выше).
      const admin = outcomes.find((o) => o.route === "/admin");
      if (role.adminAccess === "closed") {
        expect(admin?.state, `${role.code} /admin must be closed (no admin permission)`).not.toBe(
          "ready"
        );
      }

      // Каждый роут разрешился в один из честных исходов (classifyRoute кидает иначе).
      for (const outcome of outcomes) {
        expect(
          ["ready", "forbidden", "redirect"],
          `${role.code} ${outcome.route} honest state`
        ).toContain(outcome.state);
      }

      // Позитивная сторона инварианта: crm-reader имеет CRM-read → /crm/deals ОТКРЫТ
      // (право есть → поверхность рендерится, а не forbidden).
      if (role.code === "CRM") {
        const deals = outcomes.find((o) => o.route === "/crm/deals");
        expect(deals?.state, "CRM /crm/deals must open (has CRM read)").toBe("ready");
      }

      console.log(
        `BLOCK12_ROLE_ROUTE_RECEIPT ${JSON.stringify({ role: role.code, outcomes })}`
      );
    });
  }
});
