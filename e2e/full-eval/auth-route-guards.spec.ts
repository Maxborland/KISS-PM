import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../..");
const EVIDENCE_ROOT = resolve(
  REPO_ROOT,
  ".superloopy/evidence/auth-shell-2026-07-10"
);
const SCREENSHOT_DIR = resolve(EVIDENCE_ROOT, "auth-route-guards/screenshots");
const REPORT_PATH = resolve(EVIDENCE_ROOT, "auth-route-guards.md");

const ROLES = [
  {
    role: "admin",
    email: "admin@kiss-pm.local",
    password: "admin12345",
    userId: "user-alpha-admin",
    tenantId: "tenant-alpha",
    accessProfileId: "access-profile-alpha-admin"
  },
  {
    role: "beta",
    email: "beta@kiss-pm.local",
    password: "beta12345",
    userId: "user-beta-admin",
    tenantId: "tenant-beta",
    accessProfileId: "access-profile-beta-admin"
  },
  {
    role: "engineer",
    email: "engineer@kiss-pm.local",
    password: "engineer12345",
    userId: "user-alpha-engineer",
    tenantId: "tenant-alpha",
    accessProfileId: "access-profile-alpha-admin"
  },
  {
    role: "planReader",
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345",
    userId: "user-alpha-plan-reader-no-resources",
    tenantId: "tenant-alpha",
    accessProfileId: "access-profile-plan-reader-no-resources"
  },
  {
    role: "resourceReader",
    email: "resource-reader@kiss-pm.local",
    password: "resource12345",
    userId: "user-alpha-resource-reader",
    tenantId: "tenant-alpha",
    accessProfileId: "access-profile-resource-reader"
  }
] as const;

type Role = (typeof ROLES)[number];

const PUBLIC_AUTH_EXPECTATIONS = [
  { route: "/", finalPath: "/dashboard" },
  { route: "/login", finalPath: "/dashboard" },
  { route: "/register", finalPath: "/dashboard" },
  { route: "/password-reset", finalPath: "/password-reset" },
  { route: "/password-reset/confirm", finalPath: "/password-reset/confirm" }
] as const;

// Every non-public page.tsx route in apps/web/src/app as of 2026-07-10.
const STATIC_PROTECTED_ROUTES = [
  "/admin",
  "/admin/audit",
  "/admin/roles",
  "/admin/security",
  "/admin/users",
  "/agent",
  "/communications/calls",
  "/communications/channels",
  "/communications/chat",
  "/communications/meetings",
  "/communications/notifications",
  "/crm/clients",
  "/crm/contacts",
  "/crm/deals",
  "/crm/deals/opportunity-vektor-portal",
  "/crm/products",
  "/dashboard",
  "/my-work",
  "/profile",
  "/projects",
  "/projects/project-vektor-portal",
  "/projects/project-vektor-portal/assignments",
  "/projects/project-vektor-portal/baseline",
  "/projects/project-vektor-portal/calendars",
  "/projects/project-vektor-portal/commits",
  "/projects/project-vektor-portal/overview",
  "/projects/project-vektor-portal/resources",
  "/projects/project-vektor-portal/scenarios",
  "/projects/project-vektor-portal/schedule",
  "/projects/project-vektor-portal/settings",
  "/settings"
] as const;

type MePayload = {
  user: {
    id: string;
    tenantId: string;
    accessProfileId: string;
    email: string;
    name: string;
  };
  permissions: string[];
  workspace: { id: string };
};

type MeReadback = {
  status: number;
  body: MePayload | { error?: string } | null;
};

type NavigationObservation = {
  documentResponses: string[];
  documentStatuses: number[];
  protectedApiRequests: string[];
  error: string;
};

type EvidenceRow = {
  role: string;
  route: string;
  expectedFinalUrl: string;
  finalUrl: string;
  reloadFinalUrl: string;
  protectedApiLeakCount: number;
  protectedApiRequestCount: number;
  navigationStatus: string;
  reloadStatus: string;
  meStatus: number | "";
  reloadMeStatus: number | "";
  userId: string;
  tenantId: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  error: string;
};

type IdentityEvidence = {
  role: string;
  loginStatus: number;
  meStatus: number;
  userId: string;
  email: string;
  tenantId: string;
  workspaceId: string;
  accessProfileId: string;
};

test("AUTH-ROOT, AUTH-AUTHED-PUBLIC and AUTH-PROTECTED route guards", async ({
  browser,
  request
}, testInfo) => {
  test.setTimeout(10 * 60_000);

  const baseURL = String(testInfo.project.use.baseURL);
  const origin = new URL(baseURL).origin;
  const rows: EvidenceRow[] = [];
  const identities: IdentityEvidence[] = [];
  const failures: string[] = [];
  const screenshots: string[] = [];
  let knownCallRoute = "";

  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  try {
    knownCallRoute = await discoverKnownCallRoute(request);
  } catch (error) {
    const message = errorMessage(error);
    failures.push(`AUTH-PROTECTED call-room discovery: ${message}`);
    rows.push({
      role: "ANON",
      route: "/calls/[roomId]",
      expectedFinalUrl: "/login?from=/calls/[known-working-roomId]",
      finalUrl: "",
      reloadFinalUrl: "",
      protectedApiLeakCount: 0,
      protectedApiRequestCount: 0,
      navigationStatus: "",
      reloadStatus: "",
      meStatus: "",
      reloadMeStatus: "",
      userId: "",
      tenantId: "",
      status: "BLOCKED",
      error: message
    });
  }

  const protectedRoutes = knownCallRoute
    ? [...STATIC_PROTECTED_ROUTES, knownCallRoute]
    : [...STATIC_PROTECTED_ROUTES];
  ensure(
    new Set(protectedRoutes).size === protectedRoutes.length,
    `expected unique protected route inventory; actual ${protectedRoutes.length - new Set(protectedRoutes).size} duplicates`
  );

  const anonymousContext = await browser.newContext({ baseURL });
  const anonymousPage = await anonymousContext.newPage();
  try {
    await exerciseAnonymousRoot({
      page: anonymousPage,
      origin,
      rows,
      failures,
      screenshots
    });

    for (const route of protectedRoutes) {
      await exerciseAnonymousProtectedRoute({
        page: anonymousPage,
        origin,
        route,
        rows,
        failures,
        screenshots
      });
    }
  } finally {
    await anonymousContext.close();
  }

  for (const role of ROLES) {
    const context = await browser.newContext({ baseURL, locale: "ru-RU" });
    const page = await context.newPage();
    try {
      const identity = await loginThroughUi(page, role);
      identities.push(identity);

      for (const expectation of PUBLIC_AUTH_EXPECTATIONS) {
        await exerciseAuthenticatedPublicRoute({
          page,
          origin,
          role,
          route: expectation.route,
          expectedFinalPath: expectation.finalPath,
          rows,
          failures,
          screenshots
        });
      }
    } catch (error) {
      failures.push(`${role.role} setup/login: ${errorMessage(error)}`);
    } finally {
      await context.close();
    }
  }

  writeEvidenceReport({
    baseURL,
    rows,
    identities,
    failures,
    screenshots,
    knownCallRoute
  });

  expect(
    failures,
    `Route-guard matrix failures:\n${failures.map((failure) => `- ${failure}`).join("\n")}`
  ).toEqual([]);
  expect(rows).toHaveLength(1 + STATIC_PROTECTED_ROUTES.length + 1 + ROLES.length * PUBLIC_AUTH_EXPECTATIONS.length);
  expect(identities).toHaveLength(ROLES.length);
});

async function exerciseAnonymousRoot(input: {
  page: Page;
  origin: string;
  rows: EvidenceRow[];
  failures: string[];
  screenshots: string[];
}) {
  const row = emptyRow("ANON", "/", "/login");
  try {
    const initial = await observeNavigation(input.page, input.origin, async () => {
      await input.page.goto("/", { waitUntil: "domcontentloaded" });
      await waitForPath(input.page, "/login");
      await input.page.waitForLoadState("networkidle");
    });
    applyInitialObservation(row, input.page, initial);

    const current = new URL(input.page.url());
    ensure(current.pathname === "/login", `expected final pathname /login; actual ${current.pathname}`);
    ensure(current.search === "", `expected no query on anonymous root redirect; actual ${current.search}`);
    ensure(hasRedirect(initial), `expected redirect document status; actual ${statusText(initial)}`);

    const me = await readMe(input.page);
    row.meStatus = me.status;
    ensure(me.status === 401, `expected anonymous /api/auth/me 401; actual ${me.status}`);

    const reload = await observeNavigation(input.page, input.origin, async () => {
      await input.page.reload({ waitUntil: "domcontentloaded" });
      await waitForPath(input.page, "/login");
      await input.page.waitForLoadState("networkidle");
    });
    applyReloadObservation(row, input.page, reload);
    const reloadMe = await readMe(input.page);
    row.reloadMeStatus = reloadMe.status;
    ensure(reloadMe.status === 401, `expected anonymous reload /api/auth/me 401; actual ${reloadMe.status}`);

    row.protectedApiLeakCount =
      initial.protectedApiRequests.length + reload.protectedApiRequests.length;
    ensure(
      row.protectedApiLeakCount === 0,
      `expected 0 protected API requests; actual ${row.protectedApiLeakCount}: ${[
        ...initial.protectedApiRequests,
        ...reload.protectedApiRequests
      ].join(", ")}`
    );
    row.status = "PASS";
  } catch (error) {
    failRow(row, error, input.failures);
  } finally {
    await captureScreenshot(input.page, "anon-root", row, input.screenshots);
    input.rows.push(row);
  }
}

async function exerciseAnonymousProtectedRoute(input: {
  page: Page;
  origin: string;
  route: string;
  rows: EvidenceRow[];
  failures: string[];
  screenshots: string[];
}) {
  const expectedFinal = `/login?from=${input.route}`;
  const row = emptyRow("ANON", input.route, expectedFinal);
  let initial: NavigationObservation | null = null;
  let reload: NavigationObservation | null = null;

  try {
    initial = await observeNavigation(input.page, input.origin, async () => {
      await input.page.goto(input.route, { waitUntil: "domcontentloaded" });
      await waitForPath(input.page, "/login");
      await input.page.waitForLoadState("networkidle");
    });
    applyInitialObservation(row, input.page, initial);

    const current = new URL(input.page.url());
    ensure(current.pathname === "/login", `expected final pathname /login; actual ${current.pathname}`);
    ensure(
      current.searchParams.get("from") === input.route,
      `expected from=${input.route}; actual from=${current.searchParams.get("from")}`
    );
    ensure(
      [...current.searchParams.keys()].length === 1,
      `expected only from query parameter; actual ${current.search}`
    );
    ensure(hasRedirect(initial), `expected redirect document status; actual ${statusText(initial)}`);

    const me = await readMe(input.page);
    row.meStatus = me.status;
    ensure(me.status === 401, `expected anonymous /api/auth/me 401; actual ${me.status}`);

    reload = await observeNavigation(input.page, input.origin, async () => {
      await input.page.reload({ waitUntil: "domcontentloaded" });
      await waitForPath(input.page, "/login");
      await input.page.waitForLoadState("networkidle");
    });
    applyReloadObservation(row, input.page, reload);
    const reloaded = new URL(input.page.url());
    ensure(
      reloaded.searchParams.get("from") === input.route,
      `expected reload from=${input.route}; actual from=${reloaded.searchParams.get("from")}`
    );
    const reloadMe = await readMe(input.page);
    row.reloadMeStatus = reloadMe.status;
    ensure(reloadMe.status === 401, `expected anonymous reload /api/auth/me 401; actual ${reloadMe.status}`);

    row.protectedApiLeakCount =
      initial.protectedApiRequests.length + reload.protectedApiRequests.length;
    ensure(
      row.protectedApiLeakCount === 0,
      `expected 0 protected API requests before login; actual ${row.protectedApiLeakCount}: ${[
        ...initial.protectedApiRequests,
        ...reload.protectedApiRequests
      ].join(", ")}`
    );
    row.status = "PASS";
  } catch (error) {
    if (initial || reload) {
      row.protectedApiLeakCount =
        (initial?.protectedApiRequests.length ?? 0) +
        (reload?.protectedApiRequests.length ?? 0);
    }
    failRow(row, error, input.failures);
  } finally {
    const shouldCapture =
      row.status !== "PASS" ||
      [
        "/dashboard",
        "/projects/project-vektor-portal/schedule",
        "/crm/deals/opportunity-vektor-portal",
        input.route.startsWith("/calls/") ? input.route : ""
      ].includes(input.route);
    if (shouldCapture) {
      await captureScreenshot(
        input.page,
        `anon-${slug(input.route)}`,
        row,
        input.screenshots
      );
    }
    input.rows.push(row);
  }
}

async function exerciseAuthenticatedPublicRoute(input: {
  page: Page;
  origin: string;
  role: Role;
  route: string;
  expectedFinalPath: string;
  rows: EvidenceRow[];
  failures: string[];
  screenshots: string[];
}) {
  const row = emptyRow(input.role.role, input.route, input.expectedFinalPath);
  let initial: NavigationObservation | null = null;
  let reload: NavigationObservation | null = null;

  try {
    initial = await observeNavigation(input.page, input.origin, async () => {
      await input.page.goto(input.route, { waitUntil: "domcontentloaded" });
      await waitForPath(input.page, input.expectedFinalPath);
      await input.page.waitForLoadState("networkidle");
    });
    applyInitialObservation(row, input.page, initial);
    ensure(
      new URL(input.page.url()).pathname === input.expectedFinalPath,
      `expected final pathname ${input.expectedFinalPath}; actual ${new URL(input.page.url()).pathname}`
    );

    const me = await readMe(input.page);
    row.meStatus = me.status;
    const payload = assertIdentity(me, input.role, `${input.role.role} ${input.route}`);
    row.userId = payload.user.id;
    row.tenantId = payload.user.tenantId;

    reload = await observeNavigation(input.page, input.origin, async () => {
      await input.page.reload({ waitUntil: "domcontentloaded" });
      await waitForPath(input.page, input.expectedFinalPath);
      await input.page.waitForLoadState("networkidle");
    });
    applyReloadObservation(row, input.page, reload);
    const reloadMe = await readMe(input.page);
    row.reloadMeStatus = reloadMe.status;
    assertIdentity(reloadMe, input.role, `${input.role.role} ${input.route} reload`);

    row.protectedApiRequestCount =
      initial.protectedApiRequests.length + reload.protectedApiRequests.length;
    row.protectedApiLeakCount = 0;
    row.status = "PASS";
  } catch (error) {
    row.protectedApiRequestCount =
      (initial?.protectedApiRequests.length ?? 0) +
      (reload?.protectedApiRequests.length ?? 0);
    failRow(row, error, input.failures);
  } finally {
    if (
      row.status !== "PASS" ||
      ["/", "/password-reset", "/password-reset/confirm"].includes(input.route)
    ) {
      await captureScreenshot(
        input.page,
        `${input.role.role}-${slug(input.route)}`,
        row,
        input.screenshots
      );
    }
    input.rows.push(row);
  }
}

async function loginThroughUi(page: Page, role: Role): Promise<IdentityEvidence> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
  await page.getByLabel("Email").fill(role.email);
  await page.getByLabel("Пароль", { exact: true }).fill(role.password);

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Войти" }).click();
  const loginResponse = await loginResponsePromise;
  ensure(
    loginResponse.status() === 200,
    `expected ${role.role} login 200; actual ${loginResponse.status()}: ${await loginResponse.text()}`
  );
  await waitForPath(page, "/dashboard");
  await page.waitForLoadState("networkidle");

  const me = await readMe(page);
  const payload = assertIdentity(me, role, `${role.role} post-login`);
  return {
    role: role.role,
    loginStatus: loginResponse.status(),
    meStatus: me.status,
    userId: payload.user.id,
    email: payload.user.email,
    tenantId: payload.user.tenantId,
    workspaceId: payload.workspace.id,
    accessProfileId: payload.user.accessProfileId
  };
}

async function discoverKnownCallRoute(request: APIRequestContext): Promise<string> {
  const login = await request.post("/api/auth/login", {
    data: { email: "admin@kiss-pm.local", password: "admin12345" }
  });
  ensure(login.status() === 200, `expected call-room discovery login 200; actual ${login.status()}`);

  const response = await request.get(
    "/api/workspace/call-rooms?entityType=project&entityId=project-vektor-portal"
  );
  ensure(response.status() === 200, `expected call-room discovery GET 200; actual ${response.status()}`);
  const payload = (await response.json()) as {
    callRooms?: Array<{ roomId?: string; status?: string }>;
  };
  const room = payload.callRooms?.find(
    (candidate) => candidate.status === "active" && typeof candidate.roomId === "string"
  );
  ensure(room?.roomId, "expected at least one active seeded call room; actual none");
  return `/calls/${encodeURIComponent(room.roomId)}`;
}

async function observeNavigation(
  page: Page,
  origin: string,
  action: () => Promise<void>
): Promise<NavigationObservation> {
  const documentResponses: string[] = [];
  const documentStatuses: number[] = [];
  const protectedApiRequests: string[] = [];

  const onResponse = (response: Parameters<Page["on"]>[1] extends (...args: infer A) => unknown ? A[0] : never) => {
    if (typeof response !== "object" || response === null || !("url" in response)) return;
    const typedResponse = response as import("@playwright/test").Response;
    const url = new URL(typedResponse.url());
    if (url.origin !== origin || typedResponse.request().resourceType() !== "document") return;
    documentStatuses.push(typedResponse.status());
    documentResponses.push(`${url.pathname}${url.search}:${typedResponse.status()}`);
  };
  const onRequest = (request: import("@playwright/test").Request) => {
    const url = new URL(request.url());
    if (
      url.origin === origin &&
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/auth/")
    ) {
      protectedApiRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  };

  page.on("response", onResponse);
  page.on("request", onRequest);
  let error = "";
  try {
    await action();
  } catch (caught) {
    error = errorMessage(caught);
  } finally {
    page.off("response", onResponse);
    page.off("request", onRequest);
  }

  return { documentResponses, documentStatuses, protectedApiRequests, error };
}

async function readMe(page: Page): Promise<MeReadback> {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
      headers: { accept: "application/json" }
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { error: text };
    }
    return { status: response.status, body };
  }) as Promise<MeReadback>;
}

function assertIdentity(me: MeReadback, role: Role, checkpoint: string): MePayload {
  ensure(me.status === 200, `expected ${checkpoint} /api/auth/me 200; actual ${me.status}`);
  const body = me.body as MePayload | null;
  ensure(body?.user, `expected ${checkpoint} user payload; actual ${JSON.stringify(me.body)}`);
  ensure(
    body.user.id === role.userId,
    `expected ${checkpoint} userId ${role.userId}; actual ${body.user.id}`
  );
  ensure(
    body.user.email === role.email,
    `expected ${checkpoint} email ${role.email}; actual ${body.user.email}`
  );
  ensure(
    body.user.tenantId === role.tenantId,
    `expected ${checkpoint} tenantId ${role.tenantId}; actual ${body.user.tenantId}`
  );
  ensure(
    body.workspace.id === role.tenantId,
    `expected ${checkpoint} workspaceId ${role.tenantId}; actual ${body.workspace.id}`
  );
  ensure(
    body.user.accessProfileId === role.accessProfileId,
    `expected ${checkpoint} accessProfileId ${role.accessProfileId}; actual ${body.user.accessProfileId}`
  );
  return body;
}

async function waitForPath(page: Page, expectedPath: string) {
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 15_000 });
}

function applyInitialObservation(row: EvidenceRow, page: Page, observation: NavigationObservation) {
  ensure(!observation.error, `navigation failed: ${observation.error}`);
  row.finalUrl = relativeUrl(page.url());
  row.navigationStatus = statusText(observation);
  row.protectedApiRequestCount += observation.protectedApiRequests.length;
}

function applyReloadObservation(row: EvidenceRow, page: Page, observation: NavigationObservation) {
  ensure(!observation.error, `reload failed: ${observation.error}`);
  row.reloadFinalUrl = relativeUrl(page.url());
  row.reloadStatus = statusText(observation);
  row.protectedApiRequestCount += observation.protectedApiRequests.length;
}

function hasRedirect(observation: NavigationObservation): boolean {
  return observation.documentStatuses.some((status) => status >= 300 && status < 400);
}

function statusText(observation: NavigationObservation): string {
  return observation.documentResponses.join(" > ");
}

function relativeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  return `${url.pathname}${url.search}`;
}

function emptyRow(role: string, route: string, expectedFinalUrl: string): EvidenceRow {
  return {
    role,
    route,
    expectedFinalUrl,
    finalUrl: "",
    reloadFinalUrl: "",
    protectedApiLeakCount: 0,
    protectedApiRequestCount: 0,
    navigationStatus: "",
    reloadStatus: "",
    meStatus: "",
    reloadMeStatus: "",
    userId: "",
    tenantId: "",
    status: "FAIL",
    error: ""
  };
}

function failRow(row: EvidenceRow, error: unknown, failures: string[]) {
  row.status = "FAIL";
  row.error = errorMessage(error);
  failures.push(`${row.role} ${row.route}: ${row.error}`);
}

async function captureScreenshot(
  page: Page,
  name: string,
  row: EvidenceRow,
  screenshots: string[]
) {
  try {
    const path = resolve(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    screenshots.push(relative(REPO_ROOT, path).replaceAll("\\", "/"));
  } catch (error) {
    const message = `screenshot ${name}: ${errorMessage(error)}`;
    row.status = "FAIL";
    row.error = row.error ? `${row.error}; ${message}` : message;
  }
}

function writeEvidenceReport(input: {
  baseURL: string;
  rows: EvidenceRow[];
  identities: IdentityEvidence[];
  failures: string[];
  screenshots: string[];
  knownCallRoute: string;
}) {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const verdict = input.failures.length === 0 ? "PASS" : "FAIL";
  const passed = input.rows.filter((row) => row.status === "PASS").length;
  const failed = input.rows.filter((row) => row.status === "FAIL").length;
  const blocked = input.rows.filter((row) => row.status === "BLOCKED").length;

  const routeHeaders = [
    "role",
    "route",
    "finalUrl",
    "protectedApiLeakCount",
    "status",
    "expectedFinalUrl",
    "reloadFinalUrl",
    "protectedApiRequestCount",
    "navigationStatus",
    "reloadStatus",
    "meStatus",
    "reloadMeStatus",
    "userId",
    "tenantId",
    "error"
  ];
  const routeCsv = [
    routeHeaders.map(csvCell).join(","),
    ...input.rows.map((row) =>
      routeHeaders
        .map((header) => csvCell(row[header as keyof EvidenceRow]))
        .join(",")
    )
  ].join("\n");

  const identityHeaders = [
    "role",
    "loginStatus",
    "meStatus",
    "userId",
    "email",
    "tenantId",
    "workspaceId",
    "accessProfileId"
  ];
  const identityCsv = [
    identityHeaders.map(csvCell).join(","),
    ...input.identities.map((identity) =>
      identityHeaders
        .map((header) => csvCell(identity[header as keyof IdentityEvidence]))
        .join(",")
    )
  ].join("\n");

  const report = `# Lane 2 - Auth route guards

- Verdict: **${verdict}**
- Generated: ${new Date().toISOString()}
- Runtime: ${input.baseURL} (API through same-origin /api proxy)
- Command: \`E2E_WEB_PORT=3180 E2E_API_PORT=4180 .\\node_modules\\.bin\\playwright.cmd test e2e/full-eval/auth-route-guards.spec.ts --project=chromium --workers=1\`
- Rows: ${input.rows.length} total, ${passed} passed, ${failed} failed, ${blocked} blocked
- Known working call route: ${input.knownCallRoute || "BLOCKED: no active room discovered"}
- Mutation scope: UI/API login sessions only; route traversal and all product-data probes are read-only.

## Coverage

- AUTH-ROOT: anonymous \`/\` -> \`/login\`; every seeded role \`/\` -> \`/dashboard\`.
- AUTH-AUTHED-PUBLIC: five seeded roles across \`/login\`, \`/register\`, \`/password-reset\`, and \`/password-reset/confirm\`, including reload and identity/tenant readback.
- AUTH-PROTECTED: anonymous traversal of every real protected App Router page. Dynamic routes use known working project, opportunity, and read-only discovered call-room IDs.
- Protected API leak means any non-\`/api/auth/*\` request emitted while the browser is anonymous. Expected: zero.

## Identity readback (CSV)

\`\`\`csv
${identityCsv}
\`\`\`

## Machine-readable route table (CSV)

Required columns are first: \`role, route, finalUrl, protectedApiLeakCount, status\`. Remaining columns preserve navigation status, readback, reload, and exact failure evidence.

\`\`\`csv
${routeCsv}
\`\`\`

## Screenshots

${input.screenshots.length > 0 ? input.screenshots.map((path) => `- \`${path}\``).join("\n") : "- None captured."}

## Failures

${input.failures.length > 0 ? input.failures.map((failure) => `- ${failure}`).join("\n") : "- None."}
`;

  writeFileSync(REPORT_PATH, report, "utf8");
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function slug(route: string): string {
  return route === "/" ? "root" : route.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "-");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
