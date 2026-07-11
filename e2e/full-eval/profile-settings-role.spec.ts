import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page, type Response } from "@playwright/test";

type Persona = {
  key: "AADM" | "EADM" | "PLAN" | "RES" | "BADM";
  email: string;
  password: string;
  tenantId: "tenant-alpha" | "tenant-beta";
  canEdit: boolean;
};

type WorkspaceUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  phone: string | null;
  telegram: string | null;
  theme: "light" | "dark";
  accentColor: string;
};

type NetworkRecord = {
  method: string;
  path: string;
  status: number;
};

const personas: Persona[] = [
  {
    key: "AADM",
    email: "admin@kiss-pm.local",
    password: "admin12345",
    tenantId: "tenant-alpha",
    canEdit: true
  },
  {
    key: "EADM",
    email: "engineer@kiss-pm.local",
    password: "engineer12345",
    tenantId: "tenant-alpha",
    canEdit: true
  },
  {
    key: "PLAN",
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345",
    tenantId: "tenant-alpha",
    canEdit: false
  },
  {
    key: "RES",
    email: "resource-reader@kiss-pm.local",
    password: "resource12345",
    tenantId: "tenant-alpha",
    canEdit: false
  },
  {
    key: "BADM",
    email: "beta@kiss-pm.local",
    password: "beta12345",
    tenantId: "tenant-beta",
    canEdit: true
  }
];

const evidenceRoot = path.resolve(
  ".superloopy/evidence/auth-shell-2026-07-10/screenshots"
);

test.beforeAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
});

for (const persona of personas) {
  test(`${persona.key}: /profile and /settings expose the role-correct edit shape`, async ({ page }) => {
    const network = trackProfileNetwork(page);
    await login(page, persona);
    const baseline = await readMe(page);
    const deniedStatuses: number[] = [];

    for (const route of ["/profile", "/settings"] as const) {
      await page.goto(route);
      await expectProfileFormReady(page);
      await expect(page.getByText(persona.tenantId, { exact: true }).first()).toBeVisible();

      const name = page.getByLabel("Имя");
      const phone = page.getByLabel("Телефон");
      const telegram = page.getByLabel("Telegram");
      const accent = page.getByPlaceholder("#0f766e");
      const lightTheme = themeButton(page, "Светлая");
      const darkTheme = themeButton(page, "Тёмная");
      const save = page.getByRole("button", { name: "Сохранить", exact: true });

      if (persona.canEdit) {
        await expect(name).toBeEnabled();
        await expect(phone).toBeEnabled();
        await expect(telegram).toBeEnabled();
        await expect(accent).toBeEnabled();
        await expect(lightTheme).toBeEnabled();
        await expect(darkTheme).toBeEnabled();
        await expect(save).toBeDisabled();
        await expect(page.getByText("Недостаточно прав для редактирования профиля.")).toHaveCount(0);
      } else {
        await expect(name).toBeDisabled();
        await expect(phone).toBeDisabled();
        await expect(telegram).toBeDisabled();
        await expect(accent).toBeDisabled();
        await expect(lightTheme).toBeDisabled();
        await expect(darkTheme).toBeDisabled();
        await expect(save).toBeDisabled();
        await expect(page.getByText("Недостаточно прав для редактирования профиля.")).toBeVisible();
      }

      if (persona.key === "BADM") {
        const bodyText = await page.locator("body").innerText();
        expect(bodyText).not.toContain("tenant-alpha");
        expect(bodyText).not.toContain("admin@kiss-pm.local");
        expect(bodyText).not.toContain("engineer@kiss-pm.local");
      }

      await screenshot(page, `${persona.key.toLowerCase()}-${route.slice(1)}-shape.png`);
    }

    if (!persona.canEdit) {
      const headers = { "x-kiss-pm-action": "same-origin" };
      const profileDenied = await page.request.patch("/api/profile", {
        headers,
        data: { name: `${baseline.name} denied` }
      });
      const themeDenied = await page.request.patch("/api/profile/theme", {
        headers,
        data: { theme: baseline.theme === "light" ? "dark" : "light" }
      });
      deniedStatuses.push(profileDenied.status(), themeDenied.status());
      expect(deniedStatuses).toEqual([403, 403]);
      expect(await readMe(page)).toMatchObject(baseline);
    }

    evidence(`${persona.key}-shape`, {
      expected: persona.canEdit ? "profile/theme controls enabled" : "all mutation controls disabled",
      tenantId: persona.tenantId,
      deniedStatuses,
      network
    });
  });
}

test("AADM /profile saves profile+theme, retries 409, clears nullable fields, and survives reload", async ({ page }) => {
  const persona = personaByKey("AADM");
  const network = trackProfileNetwork(page);
  let original: WorkspaceUser | undefined;

  try {
    await login(page, persona);
    original = await readMe(page);
    await page.goto("/profile");
    await expectProfileFormReady(page);

    const name = page.getByLabel("Имя");
    const phone = page.getByLabel("Телефон");
    const telegram = page.getByLabel("Telegram");
    const accent = page.getByPlaceholder("#0f766e");
    const save = page.getByRole("button", { name: "Сохранить", exact: true });
    const targetTheme = original.theme === "light" ? "dark" : "light";
    const targetAccent = original.accentColor.toLowerCase() === "#b83280" ? "#0f766e" : "#b83280";
    const targetName = `${original.name} lane6`;

    await name.fill(targetName);
    await phone.fill("+7 999 000-06-06");
    await telegram.fill("@lane6_aadm");
    await expect(page.getByText(/Изменено полей: [1-9]/)).toBeVisible();

    await accent.fill("#123");
    await expect(accent).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Формат: #RRGGBB")).toBeVisible();
    await expect(save).toBeDisabled();

    await accent.fill(targetAccent);
    await themeButton(page, targetTheme === "dark" ? "Тёмная" : "Светлая").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", targetTheme);
    await expect.poll(() => page.locator("html").evaluate((root) => root.style.getPropertyValue("--accent").trim().toLowerCase())).toBe(targetAccent);

    let conflictInjected = false;
    await page.route("**/api/profile", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (!conflictInjected && request.method() === "PATCH" && pathname === "/api/profile") {
        conflictInjected = true;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "request_failed" })
        });
        return;
      }
      await route.continue();
    });

    const conflictResponse = waitForProfileResponse(page, "/api/profile", 409);
    await save.click();
    await conflictResponse;
    await expect(page.getByText("Не удалось выполнить запрос", { exact: true })).toBeVisible();
    await expect(save).toBeEnabled();

    const profileResponse = waitForProfileResponse(page, "/api/profile", 200);
    const themeResponse = waitForProfileResponse(page, "/api/profile/theme", 200);
    await save.click();
    await Promise.all([profileResponse, themeResponse]);
    const successNoticeCount = await page.getByText("Сохранено", { exact: true }).count();

    const saved = await readMe(page);
    expect(saved).toMatchObject({
      tenantId: "tenant-alpha",
      name: targetName,
      phone: "+7 999 000-06-06",
      telegram: "@lane6_aadm",
      theme: targetTheme,
      accentColor: targetAccent
    });

    await page.reload();
    await expectProfileFormReady(page);
    await expect(page.getByLabel("Имя")).toHaveValue(targetName);
    await expect(page.locator("html")).toHaveAttribute("data-theme", targetTheme);
    await expect.poll(() => page.locator("html").evaluate((root) => root.style.getPropertyValue("--accent").trim().toLowerCase())).toBe(targetAccent);

    await page.getByLabel("Телефон").fill("");
    await page.getByLabel("Telegram").fill("");
    const nullableResponse = waitForProfileResponse(page, "/api/profile", 200);
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await nullableResponse;
    const nullableReadback = await readMe(page);
    expect(nullableReadback.phone).toBeNull();
    expect(nullableReadback.telegram).toBeNull();

    await page.reload();
    await expectProfileFormReady(page);
    await expect(page.getByLabel("Телефон")).toHaveValue("");
    await expect(page.getByLabel("Telegram")).toHaveValue("");
    await screenshot(page, "aadm-profile-nullable-reload.png");

    evidence("AADM-profile-mutation", {
      expected: "409 leaves dirty form retryable; successful PATCH values survive readback/reload; empty contacts persist as null",
      readback: nullableReadback,
      successNoticeCount,
      network
    });
  } finally {
    if (original) await restoreProfile(page, original, "AADM-profile");
  }
});

test("EADM /settings saves a dirty profile field and persists it after reload", async ({ page }) => {
  const persona = personaByKey("EADM");
  const network = trackProfileNetwork(page);
  let original: WorkspaceUser | undefined;

  try {
    await login(page, persona);
    original = await readMe(page);
    await page.goto("/settings");
    await expectProfileFormReady(page);

    const marker = `+7 999 000-${Date.now().toString().slice(-2)}-06`;
    await page.getByLabel("Телефон").fill(marker);
    await expect(page.getByText("Изменено полей: 1")).toBeVisible();
    const patchResponse = waitForProfileResponse(page, "/api/profile", 200);
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await patchResponse;
    const successNoticeCount = await page.getByText("Сохранено", { exact: true }).count();
    expect((await readMe(page)).phone).toBe(marker);

    await page.reload();
    await expectProfileFormReady(page);
    await expect(page.getByLabel("Телефон")).toHaveValue(marker);
    await screenshot(page, "eadm-settings-saved-reload.png");

    evidence("EADM-settings-mutation", {
      expected: "dirty field saved through /settings and persisted after reload",
      phone: marker,
      successNoticeCount,
      network
    });
  } finally {
    if (original) await restoreProfile(page, original, "EADM-settings");
  }
});

test("BADM /settings mutation remains isolated to tenant-beta", async ({ page }) => {
  const persona = personaByKey("BADM");
  const network = trackProfileNetwork(page);
  let original: WorkspaceUser | undefined;

  try {
    await login(page, persona);
    original = await readMe(page);
    await page.goto("/settings");
    await expectProfileFormReady(page);

    const targetAccent = original.accentColor.toLowerCase() === "#2563eb" ? "#0f766e" : "#2563eb";
    await page.getByPlaceholder("#0f766e").fill(targetAccent);
    const patchResponse = waitForProfileResponse(page, "/api/profile/theme", 200);
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await patchResponse;

    const betaReadback = await readMe(page);
    expect(betaReadback).toMatchObject({
      tenantId: "tenant-beta",
      email: "beta@kiss-pm.local",
      accentColor: targetAccent
    });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("tenant-alpha");
    expect(bodyText).not.toContain("admin@kiss-pm.local");

    await page.reload();
    await expectProfileFormReady(page);
    await expect(page.getByPlaceholder("#0f766e")).toHaveValue(targetAccent);
    await screenshot(page, "badm-settings-beta-isolation-reload.png");

    evidence("BADM-settings-isolation", {
      expected: "beta write/readback stays tenant-beta and alpha identity is absent",
      readback: betaReadback,
      network
    });
  } finally {
    if (original) await restoreProfile(page, original, "BADM-settings");
  }
});

test("AADM /profile exposes a retry after an intercepted 5xx load failure", async ({ page }) => {
  const persona = personaByKey("AADM");
  const network = trackProfileNetwork(page);
  await login(page, persona);

  let failMe = true;
  let injectedFailures = 0;
  await page.route("**/api/auth/me", async (route) => {
    if (failMe) {
      injectedFailures += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "request_failed" })
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/profile");
  const retry = page.locator("main").getByRole("button", { name: "Повторить", exact: true });
  await expect(retry).toBeVisible();
  await screenshot(page, "aadm-profile-503-retry.png");

  failMe = false;
  await retry.click();
  await expectProfileFormReady(page);
  expect(injectedFailures).toBeGreaterThan(0);
  expect(network.some((entry) => entry.path === "/api/auth/me" && entry.status === 503)).toBe(true);
  expect(network.some((entry) => entry.path === "/api/auth/me" && entry.status === 200)).toBe(true);

  evidence("AADM-profile-5xx-retry", {
    expected: "503 renders readable error with retry; retry reaches ready profile",
    injectedFailures,
    network
  });
});

test("BUG: a successful /settings save keeps visible success confirmation", async ({ page }) => {
  const persona = personaByKey("EADM");
  let original: WorkspaceUser | undefined;
  let actual = 0;

  try {
    await login(page, persona);
    original = await readMe(page);
    await page.goto("/settings");
    await expectProfileFormReady(page);

    await page.getByLabel("Telegram").fill("@lane6_success_feedback");
    const patchResponse = waitForProfileResponse(page, "/api/profile", 200);
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await patchResponse;
    await expectProfileFormReady(page);
    expect((await readMe(page)).telegram).toBe("@lane6_success_feedback");
    actual = await page.getByText("Сохранено", { exact: true }).count();
    await screenshot(page, "bug-settings-success-feedback-missing.png");
  } finally {
    if (original) await restoreProfile(page, original, "EADM-success-feedback");
  }

  evidence("BUG-settings-success-feedback", {
    expected: 1,
    actual,
    note: "PATCH and /api/auth/me readback succeed, but ProfileForm remount removes the saved state"
  });
  expect(actual, "Expected visible Сохранено confirmation after a successful PATCH").toBe(1);
});

test("BUG: dirty profile forms on /profile and /settings provide a cancel action", async ({ page }) => {
  await login(page, personaByKey("AADM"));
  const actual: Record<string, number> = {};

  for (const route of ["/profile", "/settings"] as const) {
    await page.goto(route);
    await expectProfileFormReady(page);
    const currentName = await page.getByLabel("Имя").inputValue();
    await page.getByLabel("Имя").fill(`${currentName} unsaved`);
    await expect(page.getByText("Изменено полей: 1")).toBeVisible();
    actual[route] = await page.getByRole("button", { name: "Отменить", exact: true }).count();
    await screenshot(page, `bug-cancel-missing-${route.slice(1)}.png`);
  }

  evidence("BUG-profile-settings-cancel", {
    expected: { "/profile": 1, "/settings": 1 },
    actual
  });
  expect(
    actual,
    "Expected a visible Отменить action that restores the server-backed values without saving"
  ).toEqual({ "/profile": 1, "/settings": 1 });
});

async function login(page: Page, persona: Persona) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(persona.email);
  await page.getByLabel("Пароль", { exact: true }).fill(persona.password);
  const loginResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/login")
  );
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const response = await loginResponse;
  expect(response.status(), `${persona.key} login response`).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);

  const me = await readMe(page);
  expect(me).toMatchObject({ email: persona.email, tenantId: persona.tenantId });
}

async function expectProfileFormReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Редактирование профиля" })).toBeVisible();
  await expect(page.getByLabel("Имя")).toBeVisible();
  await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeVisible();
}

async function readMe(page: Page): Promise<WorkspaceUser> {
  const response = await page.request.get("/api/auth/me");
  expect(response.status(), `GET /api/auth/me: ${await response.text()}`).toBe(200);
  const payload = (await response.json()) as { user: WorkspaceUser };
  return payload.user;
}

async function restoreProfile(page: Page, original: WorkspaceUser, label: string) {
  const headers = { "x-kiss-pm-action": "same-origin" };
  const profileResponse = await page.request.patch("/api/profile", {
    headers,
    data: {
      name: original.name,
      phone: original.phone,
      telegram: original.telegram
    }
  });
  const themeResponse = await page.request.patch("/api/profile/theme", {
    headers,
    data: {
      theme: original.theme,
      accentColor: original.accentColor
    }
  });
  expect(profileResponse.status(), `${label} profile restore`).toBe(200);
  expect(themeResponse.status(), `${label} theme restore`).toBe(200);

  const restored = await readMe(page);
  expect(restored).toMatchObject({
    name: original.name,
    phone: original.phone,
    telegram: original.telegram,
    theme: original.theme,
    accentColor: original.accentColor
  });
  evidence(`${label}-restore`, {
    profileStatus: profileResponse.status(),
    themeStatus: themeResponse.status(),
    readback: restored
  });
}

function waitForProfileResponse(page: Page, pathname: string, status: number): Promise<Response> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "PATCH" && url.pathname === pathname && response.status() === status;
  });
}

function trackProfileNetwork(page: Page): NetworkRecord[] {
  const records: NetworkRecord[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/me" ||
      url.pathname === "/api/profile" ||
      url.pathname === "/api/profile/theme"
    ) {
      records.push({
        method: response.request().method(),
        path: url.pathname,
        status: response.status()
      });
    }
  });
  return records;
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({ path: path.join(evidenceRoot, filename), fullPage: true });
}

function themeButton(page: Page, label: "Светлая" | "Тёмная") {
  return page.locator('button[aria-pressed]').filter({ hasText: label });
}

function evidence(label: string, payload: unknown) {
  console.log(`LANE6_EVIDENCE ${label} ${JSON.stringify(payload)}`);
}

function personaByKey(key: Persona["key"]): Persona {
  const persona = personas.find((candidate) => candidate.key === key);
  if (!persona) throw new Error(`Unknown persona: ${key}`);
  return persona;
}
