// E2E: P1-C — замыкание CRUD (канал-архив, редактирование клиента, реактивация пользователя).
import { launch, USERS } from "./browser.mjs";
const BASE = "http://127.0.0.1:3010";
const H = { "x-kiss-pm-action": "same-origin" };
const out = [];
const check = (n, ok, note = "") => { out.push({ n, ok }); console.log(ok ? "PASS" : "FAIL", n, note); };
const { browser, context } = await launch();
await context.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });

// 1) Канал: создать → архивировать → исчез из списка; workspace_general → 400
let r = await context.request.post(`${BASE}/api/workspace/communication-channels`, { headers: H, data: { channelType: "custom", title: `uiux-eval-канал-${Date.now()}`, description: null } });
check("channel-create", r.status() === 201 || r.status() === 200, String(r.status()));
const ch = (await r.json()).channel;
r = await context.request.delete(`${BASE}/api/workspace/communication-channels/${ch.id}`, { headers: H });
check("channel-archive-200", r.status() === 200, String(r.status()));
const list = await (await context.request.get(`${BASE}/api/workspace/communication-channels`)).json();
check("channel-gone-from-list", !(list.channels ?? []).some((c) => c.id === ch.id), "");
const general = (list.channels ?? []).find((c) => c.channelType === "workspace_general");
if (general) {
  r = await context.request.delete(`${BASE}/api/workspace/communication-channels/${general.id}`, { headers: H });
  check("workspace-general-immutable", r.status() === 400, String(r.status()));
} else check("workspace-general-immutable", true, "нет системного канала в списке");

// 2) Клиент: редактирование через UI
const page = await context.newPage();
await page.goto(`${BASE}/crm/clients`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.locator('button[title="Изменить"]').first().click();
await page.waitForTimeout(600);
const nameInput = page.locator('div[role="dialog"] input').first();
const newName = (await nameInput.inputValue()).replace(/ uiux-eval-e\d+/g, "") + ` uiux-eval-e${Math.floor(Math.random() * 1e4)}`;
await nameInput.fill(newName);
await page.locator('div[role="dialog"] button:has-text("Сохранить")').first().click();
await page.waitForTimeout(1500);
const body = await page.textContent("body");
check("client-edit-saved", body.includes(newName), "");
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p1c-client-edit.png", fullPage: false });

// 3) Пользователь: деактивация → реактивация (API-путь, UI-кнопка проверена по наличию)
const users = await (await context.request.get(`${BASE}/api/workspace/users`)).json();
const target = (users.users ?? []).find((u) => u.email.startsWith("ok-") || u.name.includes("uiux-eval"));
if (target) {
  r = await context.request.patch(`${BASE}/api/workspace/users/${target.id}`, { headers: H, data: { status: "inactive" } });
  check("user-deactivate", r.status() === 200, String(r.status()));
  await page.goto(`${BASE}/admin/users`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const reactivateBtn = await page.locator('button[title="Активировать снова"]').count();
  check("user-reactivate-button-visible", reactivateBtn > 0, `count=${reactivateBtn}`);
  await page.locator('button[title="Активировать снова"]').first().click();
  await page.waitForTimeout(1500);
  const usersAfter = await (await context.request.get(`${BASE}/api/workspace/users`)).json();
  check("user-reactivated", usersAfter.users.find((u) => u.id === target.id)?.status === "active", "");
  await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p1c-user-reactivate.png", fullPage: false });
} else { check("user-deactivate", false, "нет тестового пользователя"); }

console.log(JSON.stringify(out));
await browser.close();
if (out.some((x) => !x.ok)) process.exit(1);
