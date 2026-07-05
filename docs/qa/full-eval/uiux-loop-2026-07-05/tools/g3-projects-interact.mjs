// G3 Projects: интерактивные сценарии на /projects/project-vektor-portal/*. Запуск из корня worktree.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const net = [];
const con = [];
let phase = "init";
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) con.push({ phase, type: m.type(), text: m.text().slice(0, 400) }); });
page.on("pageerror", (e) => con.push({ phase, type: "pageerror", text: String(e).slice(0, 400) }));
page.on("response", async (r) => {
  const u = r.url();
  if (u.includes("/api/") && r.request().method() !== "GET") {
    let body = "";
    try { body = (await r.text()).slice(0, 300); } catch {}
    net.push({ phase, method: r.request().method(), url: u.replace(BASE_URL, ""), status: r.status(), body });
  }
});
const out = [];
const note = (s) => { out.push(`[${phase}] ${s}`); console.log(`[${phase}] ${s}`); };

// ---------- 1. Список проектов: фильтр «Все», клик по строке ----------
phase = "list";
await page.goto(BASE_URL + "/projects", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Все" }).first().click().catch(() => note("кнопка Все не нажалась"));
await page.waitForTimeout(1200);
await shot(page, "g3-projects-list-filter-all");
note("после клика Все: строк в таблице = " + (await page.locator("table tbody tr").count()));
// клик по строке проекта — ведёт ли на карточку?
await page.locator("table tbody tr").first().click();
await page.waitForTimeout(1500);
note("клик по строке проекта -> url: " + page.url());
await shot(page, "g3-projects-list-row-click");

// ---------- 2. График: создание задачи ----------
phase = "task-create";
await page.goto(BASE_URL + "/projects/project-vektor-portal/schedule", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const addBtn = page.getByRole("button", { name: /Задача/ }).first();
await addBtn.click();
await page.waitForTimeout(1500);
await shot(page, "g3-projects-task-create-clicked");
note("после клика +Задача url=" + page.url());
// если появился инпут — вводим имя
const editInput = page.locator("input:focus, [contenteditable='true']:focus");
if (await editInput.count()) {
  await page.keyboard.type("uiux-eval-задача-1");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  note("ввели имя задачи uiux-eval-задача-1 + Enter");
} else {
  // попробуем нижнюю строку "Новая задача — Enter"
  const newRow = page.getByText("Новая задача", { exact: false }).first();
  if (await newRow.count()) { await newRow.click(); await page.keyboard.type("uiux-eval-задача-1"); await page.keyboard.press("Enter"); await page.waitForTimeout(2000); note("создали через нижнюю строку"); }
}
await shot(page, "g3-projects-task-created");
note("есть ли задача в таблице: " + (await page.getByText("uiux-eval-задача-1").count()));

// ---------- 3. Перезагрузка: сохранилась ли задача ----------
phase = "task-persist";
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
note("после reload задача uiux-eval-задача-1 видна: " + (await page.getByText("uiux-eval-задача-1").count()));
await shot(page, "g3-projects-task-after-reload");

// ---------- 4. Коммиты: появился ли коммит после правки ----------
phase = "commits";
await page.goto(BASE_URL + "/projects/project-vektor-portal/commits", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot(page, "g3-projects-commits-after-edit");
note("лента: " + (await page.getByText(/ЛЕНТА/i).first().textContent().catch(() => "?")));
// кнопка «Откатить последний» на пустой/непустой истории
await page.getByRole("button", { name: /Откатить последний/ }).click().catch(() => note("кнопка отката не кликается"));
await page.waitForTimeout(1500);
await shot(page, "g3-projects-commits-revert-click");

// ---------- 5. Baseline: зафиксировать ----------
phase = "baseline";
await page.goto(BASE_URL + "/projects/project-vektor-portal/baseline", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Зафиксировать/ }).click().catch(() => note("кнопка фиксации не кликается"));
await page.waitForTimeout(2000);
await shot(page, "g3-projects-baseline-captured");
note("история снимков: " + (await page.getByText(/ИСТОРИЯ/).first().textContent().catch(() => "?")));

// ---------- 6. Календари: добавить праздник кликом по дню ----------
phase = "calendars";
await page.goto(BASE_URL + "/projects/project-vektor-portal/calendars", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
note("месяц по умолчанию: " + (await page.getByText(/2026/).first().textContent().catch(() => "?")));
const day10 = page.locator("text=/^10$/").first();
await day10.click().catch(() => note("клик по дню не сработал"));
await page.waitForTimeout(1500);
await shot(page, "g3-projects-calendars-day-click");

// ---------- 7. Сценарии: пустой сабмит причины ----------
phase = "scenarios";
await page.goto(BASE_URL + "/projects/project-vektor-portal/scenarios", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const apply = page.getByRole("button", { name: /Применить/ }).first();
await apply.click().catch(() => note("Применить не кликается"));
await page.waitForTimeout(1500);
await shot(page, "g3-projects-scenarios-apply-noreason");
const compare = page.getByRole("button", { name: /Сравнить/ }).first();
await compare.click().catch(() => note("Сравнить не кликается"));
await page.waitForTimeout(1500);
await shot(page, "g3-projects-scenarios-compare");

// ---------- 8. Настройки: перенос дедлайна + мёртвые кнопки интеграций ----------
phase = "settings";
await page.goto(BASE_URL + "/projects/project-vektor-portal/settings", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Изменить/ }).first().click().catch(() => note("Изменить не кликается"));
await page.waitForTimeout(1200);
await shot(page, "g3-projects-settings-deadline-edit");
// пустой сабмит, если появилась форма
const applyBtn = page.getByRole("button", { name: /Применить|Сохранить|Preview|Предпросмотр/ }).first();
if (await applyBtn.count()) { await applyBtn.click().catch(() => {}); await page.waitForTimeout(1200); await shot(page, "g3-projects-settings-deadline-submit"); }
await page.keyboard.press("Escape").catch(() => {});
await page.getByRole("button", { name: /Подключить/ }).click().catch(() => note("Подключить не кликается"));
await page.waitForTimeout(800);
await shot(page, "g3-projects-settings-bitrix-click");
await page.getByRole("button", { name: /Импорт MSPDI/ }).click().catch(() => note("Импорт MSPDI не кликается"));
await page.waitForTimeout(800);
await shot(page, "g3-projects-settings-mspdi-click");

writeFileSync(`${EVIDENCE_DIR}/g3-projects-interact.json`, JSON.stringify({ notes: out, network: net, console: con }, null, 2));
console.log("network mutations:", net.length, "console:", con.length);
await browser.close();
