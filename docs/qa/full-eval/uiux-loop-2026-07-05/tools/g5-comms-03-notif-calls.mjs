// G5: уведомления (прочитать, фильтры, настройки) + звонок при provider=disabled + 1280x800.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 400)); });
const report = { steps: [], consoleErrors };
const log = (step, detail) => { report.steps.push({ step, detail }); console.log(step, "|", detail); };

// ===== Уведомления =====
await page.goto(`${BASE_URL}/communications/notifications`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

// клик «Перейти» — куда ведёт?
const goLink = page.getByRole("link", { name: "Перейти" }).first();
if (await goLink.isVisible().catch(() => false)) {
  const href = await goLink.getAttribute("href");
  log("notif-route-href", href);
}

// «Прочитать» одно уведомление
const readBtn = page.getByRole("button", { name: "Прочитать", exact: true }).first();
if (await readBtn.isVisible().catch(() => false)) {
  await readBtn.click();
  await page.waitForTimeout(1500);
  await shot(page, "g5-comms-notif-read-one");
  const body = await page.locator("body").innerText();
  log("notif-read-one", body.includes("отмечено прочитанным") || body.includes("прочитано") ? "статус обновился" : "не видно обновления");
  // бейдж в табе обновился?
  const tabText = await page.locator("nav").filter({ hasText: "Уведомления" }).first().innerText();
  log("notif-tab-badge-after-read", JSON.stringify(tabText.replace(/\n/g, " ")));
}

// фильтры
await page.getByText("Непрочитанные", { exact: true }).click();
await page.waitForTimeout(1200);
await shot(page, "g5-comms-notif-filter-unread");
log("notif-filter-unread", (await page.locator("body").innerText()).includes("Непрочитанных уведомлений нет") ? "пустое состояние ок" : "есть элементы");

// повторный «Прочитать» на уже прочитанном — не идемпотентно, но UI кнопку прячет; проверим двойной клик race через API
// настройки
await page.getByText("Настройки", { exact: true }).first().click();
await page.waitForTimeout(2000);
await shot(page, "g5-comms-notif-prefs");
// переключим один switch и сохраним
const sw = page.getByRole("switch").first();
const before = await sw.getAttribute("aria-checked");
await sw.click();
await page.getByRole("button", { name: "Сохранить" }).click();
await page.waitForTimeout(1800);
await shot(page, "g5-comms-notif-prefs-saved");
log("prefs-save", `switch was ${before}; body has 'Настройки сохранены': ${(await page.locator("body").innerText()).includes("Настройки сохранены")}`);
// вернём обратно
await page.getByRole("switch").first().click();
await page.getByRole("button", { name: "Сохранить" }).click();
await page.waitForTimeout(1200);

// Проверка: «несохранённые изменения» — переключить switch и уйти на «Лента» без сохранения
await page.getByRole("switch").nth(1).click();
await page.getByText("Лента", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByText("Настройки", { exact: true }).first().click();
await page.waitForTimeout(1500);
const sw2 = await page.getByRole("switch").nth(1).getAttribute("aria-checked");
log("prefs-lost-on-tab-switch", `switch#2 aria-checked=${sw2} (если вернулся к серверному значению — ввод потерян без предупреждения)`);

// ===== Звонок при provider=disabled =====
const roomsResp = await context.request.get(`${BASE_URL}/api/workspace/call-rooms?entityType=project&entityId=project-vektor-portal`);
const rooms = (await roomsResp.json()).callRooms ?? [];
const room = rooms[0];
log("call-room", room ? `${room.roomId} provider=${room.provider} status=${room.status}` : "нет комнат");
if (room) {
  await page.goto(`${BASE_URL}/calls/${room.roomId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await shot(page, "g5-comms-call-prejoin");
  // жмём «Присоединиться»
  const joinBtn = page.getByRole("button", { name: "Присоединиться" });
  if (await joinBtn.isVisible().catch(() => false)) {
    await joinBtn.click();
    await page.waitForTimeout(4000);
    await shot(page, "g5-comms-call-join-degraded");
    log("call-join-degraded", (await page.locator("body").innerText()).slice(0, 600));
  } else {
    log("call-join", "кнопка Присоединиться не найдена");
  }
}

// ===== 1280x800 вьюпорт: каналы и уведомления =====
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE_URL}/communications/channels`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await shot(page, "g5-comms-channels-1280");
await page.goto(`${BASE_URL}/communications/notifications`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await shot(page, "g5-comms-notifications-1280");

// ===== Чат: «Повторить» на ошибке — меняется ли что-то =====
await page.goto(`${BASE_URL}/communications/chat`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const retry = page.getByRole("button", { name: "Повторить" });
if (await retry.isVisible().catch(() => false)) {
  await retry.click();
  await page.waitForTimeout(2000);
  log("chat-retry", (await page.locator("body").innerText()).includes("Не удалось загрузить") ? "всё та же ошибка (тупик)" : "что-то изменилось");
  await shot(page, "g5-comms-chat-retry-1280");
}

writeFileSync(`${EVIDENCE_DIR}/g5-comms-notif-calls-report.json`, JSON.stringify(report, null, 2));
await browser.close();
