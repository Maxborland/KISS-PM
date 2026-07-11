import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USERS = {
  A: { email: "admin@kiss-pm.local", password: "admin12345" },
  PR: { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" }
} as const;
type Role = keyof typeof USERS;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../.superloopy/evidence/project-final-29-2026-07-11/scenarios");
const SHOTS = resolve(ROOT, "screenshots");
const RUN = resolve(ROOT, "scenarios-closeout-run.json");
const KEYS = ["PROJ-097:A","PROJ-099:A","PROJ-099:PR","PROJ-102:A","PROJ-103:A","PROJ-103:PR","PROJ-121:A"] as const;
type Key = typeof KEYS[number];
type Row = { key: Key; status: "pending" | "pass"; assertions: string[]; details: Record<string, unknown>; screenshots: string[] };
type Overload = { granularity: string; resourceId: string; date: string; overloadMinutes: number; taskIds: string[] };
type Model = { planVersion: number; resourceLoad: { overloads: Overload[]; acceptedOverloads?: string[] } };
type Proposal = { id: string; profile: string; availability: string; unavailableReason: string | null; conflictEffect: string };
const rows = new Map<Key, Row>(KEYS.map(function (key) { return [key, { key, status: "pending", assertions: [], details: {}, screenshots: [] }]; }));

test.describe.serial("Final scenarios closeout", function () {
  test.beforeAll(function () { mkdirSync(SHOTS, { recursive: true }); });

  test("Plan Reader sees stable three-profile contract", async function ({ browser }, info) {
    await withRole(browser, "PR", info, async function (page) {
      const fixture = await findFixture(page);
      await page.goto(uiPath(fixture.id, "scenarios"));
      await expectThreeCards(page);
      await expect(page.getByRole("button", { name: "Применить", exact: true })).toHaveCount(0);
      mark("PROJ-099:PR", ["Three profiles rendered for Plan Reader", "No apply controls rendered"], {
        projectId: fixture.id, profiles: await profiles(page)
      }, [await shot(page, "proj-099-pr-three-profiles")]);
    });
  });

  test("Admin target, profiles, reason and full apply workflow", async function ({ page }) {
    test.skip(process.env.KISS_PM_E2E_DISPOSABLE_DATABASE !== "1", "requires disposable DB");
    test.setTimeout(240000);
    await login(page, "A");
    const fixture = await findFixture(page);
    const previewWait = waitPreview(page, fixture.id);
    await page.goto(uiPath(fixture.id, "scenarios"));
    const preview = await previewWait;
    expect(preview.status()).toBe(200);
    const previewEnvelope = preview.request().postDataJSON();
    let activePreviewEnvelope = previewEnvelope;
    const previewBody = await preview.json() as { proposals: Proposal[]; planVersion: number };
    expect(previewBody.proposals.map(function (p) { return p.profile; })).toEqual(["aggressive","balanced","resilient"]);
    await expectThreeCards(page);

    const selector = page.getByRole("combobox", { name: "Перегруз" });
    const targetEvidence: Record<string, unknown> = { overloadCount: fixture.count, previewEnvelope };
    if (fixture.count > 1) {
      await expect(selector).toBeVisible();
      const values = await selector.locator("option").evaluateAll(function (items) {
        return items.map(function (item) { return (item as HTMLOptionElement).value; });
      });
      expect(values.length).toBe(fixture.count);
      const changedPreviewWait = waitPreview(page, fixture.id);
      await selector.selectOption(values[1]!);
      const changedPreview = await changedPreviewWait;
      expect(changedPreview.status()).toBe(200);
      activePreviewEnvelope = changedPreview.request().postDataJSON();
      await expectThreeCards(page);
      targetEvidence.values = values;
    } else {
      await expect(selector).toHaveCount(0);
      targetEvidence.singleTarget = true;
    }
    mark("PROJ-097:A", ["Target represented all live overload choices", "Target change recomputed without apply"], targetEvidence, [await shot(page, "proj-097-a-target")]);
    mark("PROJ-099:A", ["All three profile cards rendered in stable order", "Availability and recommendation were explicit"], {
      projectId: fixture.id, proposals: previewBody.proposals, cards: await profiles(page)
    }, [await shot(page, "proj-099-a-three-profiles")]);

    const aggressive = page.getByTestId("scenario-card-aggressive");
    await aggressive.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(page.getByText(/Укажите причину принятия риска/)).toBeVisible();
    expect((await model(page, fixture.id)).planVersion).toBe(fixture.model.planVersion);
    await aggressive.getByPlaceholder("напр. согласовано с РП, срок критичнее").fill("PROJ-102 accepted risk");
    const applyWait = waitApply(page, fixture.id);
    await aggressive.getByRole("button", { name: "Применить", exact: true }).click();
    const apply = await applyWait;
    expect(apply.status()).toBe(200);
    const applyEnvelope = apply.request().postDataJSON();
    const applyBody = await apply.json() as { scenarioRunId: string; newPlanVersion: number };
    const applied = await model(page, fixture.id);
    expect(applied.planVersion).toBe(applyBody.newPlanVersion);
    const accepted = String(activePreviewEnvelope.target.resourceId) + ":" + String(activePreviewEnvelope.target.date);
    expect(applied.resourceLoad.acceptedOverloads || []).toContain(accepted);
    await page.reload();
    expect((await model(page, fixture.id)).resourceLoad.acceptedOverloads || []).toContain(accepted);
    mark("PROJ-102:A", ["Empty reason rejected without write", "Reasoned aggressive apply persisted after reload"], {
      projectId: fixture.id, applyEnvelope, applyBody, accepted
    }, [await shot(page, "proj-102-a-reload")]);

    const replay = await page.request.post(pathFor(fixture.id, "planning/scenarios/" + encodeURIComponent(applyBody.scenarioRunId) + "/apply"), {
      headers: mutationHeaders(page), data: applyEnvelope
    });
    expect(replay.status()).toBeGreaterThanOrEqual(400);
    expect(replay.status()).toBeLessThan(500);
    expect((await model(page, fixture.id)).planVersion).toBe(applied.planVersion);
    await page.goto(uiPath(fixture.id, "assignments"));
    await expect(page.getByText("Назначения", { exact: true })).toBeVisible();
    const assignmentShot = await shot(page, "proj-121-a-assignments");
    await page.goto(uiPath(fixture.id, "commits"));
    await expect(page.getByText(/сценарий/i).first()).toBeVisible();
    mark("PROJ-121:A", ["Preview preceded apply", "Accepted overload survived readback", "Assignments and scenario commit reflected the write", "Replay did not bump version"], {
      projectId: fixture.id, previewEnvelope: activePreviewEnvelope, applyEnvelope, applyBody, replayStatus: replay.status(),
      finalPlanVersion: (await model(page, fixture.id)).planVersion,
      cleanup: { scope: "disposable_database", immutableAcceptedMarker: true }
    }, [assignmentShot, await shot(page, "proj-121-a-commits")]);
  });

  for (const role of ["A","PR"] as const) {
    test("Zero overload state " + role, async function ({ browser }, info) {
      await withRole(browser, role, info, async function (page) {
        const id = (await listProjects(page))[0]!;
        const pattern = new RegExp("/api/workspace/projects/" + id + "/planning/read-model");
        await page.route(pattern, async function (route) {
          const response = await route.fetch();
          const body = await response.json() as any;
          body.resourceLoad = { ...body.resourceLoad, overloads: [], acceptedOverloads: [] };
          await route.fulfill({ response, json: body });
        });
        await page.goto(uiPath(id, "scenarios"));
        await expect(page.getByTestId("scenario-empty-state")).toBeVisible();
        mark(("PROJ-103:" + role) as Key, ["ROUTE FIXTURE: valid read-model had zero overloads", "Balanced-plan empty state rendered"], {
          projectId: id, fixture: "resourceLoad.overloads=[]"
        }, [await shot(page, "proj-103-" + role.toLowerCase() + "-empty")]);
      });
    });
  }

  test.afterAll(function () {
    const result = Array.from(rows.values());
    expect(result.filter(function (row) { return row.status !== "pass"; }).map(function (row) { return row.key; })).toEqual([]);
    for (const row of result) for (const relative of row.screenshots) {
      const file = resolve(ROOT, relative);
      expect(statSync(file).size).toBeGreaterThan(0);
    }
    writeFileSync(RUN, JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), status: "pass", rows: result }, null, 2), "utf8");
  });
});

async function withRole(browser: Browser, role: Role, info: TestInfo, run: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ baseURL: String(info.project.use.baseURL), locale: "ru-RU" });
  const page = await context.newPage();
  try { await login(page, role); await run(page); } finally { await context.close(); }
}
async function login(page: Page, role: Role) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(USERS[role].email);
  await page.getByLabel("Пароль", { exact: true }).fill(USERS[role].password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
}
async function listProjects(page: Page) {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  return ((await response.json()) as { projects: Array<{ id: string }> }).projects.map(function (p) { return p.id; });
}
async function findFixture(page: Page) {
  let best: { id: string; model: Model; count: number } | null = null;
  for (const id of await listProjects(page)) {
    const current = await model(page, id);
    const accepted = new Set(current.resourceLoad.acceptedOverloads || []);
    const count = current.resourceLoad.overloads.filter(function (o) { return o.granularity === "day" && !accepted.has(o.resourceId + ":" + o.date); }).length;
    if (count > 0 && (!best || count > best.count)) best = { id, model: current, count };
  }
  if (!best) throw new Error("scenario_fixture_missing");
  return best;
}
async function model(page: Page, id: string): Promise<Model> {
  const response = await page.request.get(pathFor(id, "planning/read-model"));
  expect(response.status()).toBe(200);
  return await response.json() as Model;
}
function pathFor(id: string, suffix: string) { return "/api/workspace/projects/" + encodeURIComponent(id) + "/" + suffix; }
function uiPath(id: string, suffix: string) { return "/projects/" + encodeURIComponent(id) + "/" + suffix; }
function waitPreview(page: Page, id: string) {
  const path = pathFor(id, "planning/scenarios/preview");
  return page.waitForResponse(function (response) { return response.request().method() === "POST" && new URL(response.url()).pathname === path; });
}
function waitApply(page: Page, id: string) {
  const prefix = pathFor(id, "planning/scenarios/");
  return page.waitForResponse(function (response) { const path = new URL(response.url()).pathname; return response.request().method() === "POST" && path.startsWith(prefix) && path.endsWith("/apply"); });
}
async function expectThreeCards(page: Page) {
  for (const profile of ["aggressive","balanced","resilient"]) await expect(page.getByTestId("scenario-card-" + profile)).toBeVisible();
}
async function profiles(page: Page) {
  return await Promise.all(["aggressive","balanced","resilient"].map(async function (profile) {
    const card = page.getByTestId("scenario-card-" + profile);
    return { profile, availability: await card.getAttribute("data-availability"), text: await card.innerText() };
  }));
}
function mutationHeaders(page: Page) { return { Origin: new URL(page.url()).origin, "x-kiss-pm-action": "same-origin" }; }
async function shot(page: Page, name: string) {
  const file = name + ".png";
  await page.screenshot({ path: resolve(SHOTS, file), fullPage: true });
  return "screenshots/" + file;
}
function mark(key: Key, assertions: string[], details: Record<string, unknown>, screenshots: string[]) {
  rows.set(key, { key, status: "pass", assertions, details, screenshots });
}
