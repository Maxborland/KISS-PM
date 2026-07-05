// G3 Projects: CRUD задачи (правка/удаление), Gantt, переключатель проекта, чистка праздника, 1280x800.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const net = [];
const con = [];
let phase = "init";
page.on("console", (m) => { if (["error"].includes(m.type())) con.push({ phase, text: m.text().slice(0, 300) }); });
page.on("pageerror", (e) => con.push({ phase, text: "pageerror " + String(e).slice(0, 300) }));
page.on("response", async (r) => {
  if (r.url().includes("/api/") && r.request().method() !== "GET") {
    let b = ""; try { b = (await r.text()).slice(0, 200); } catch {}
    net.push({ phase, m: r.request().method(), u: r.url().replace(BASE_URL, ""), s: r.status(), b });
  }
});
const out = [];
const note = (s) => { out.push(`[${phase}] ${s}`); console.log(`[${phase}] ${s}`); };

// ---------- 1. Чистка праздника 10.03.2026 (клик по × в исключениях) ----------
phase = "cleanup-holiday";
await page.goto(BASE_URL + "/projects/project-vektor-portal/calendars", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const exRow = page.locator("text=10.03.2026").first();
if (await exRow.count()) {
  const x = page.locator("button", { hasText: "×" }).first();
  const xNear = page.getByRole("button").filter({ has: page.locator("svg") });
  // проще: кликнуть по дню 10 ещё раз (toggle add/remove по описанию «добавить/снять праздник»)
  await page.locator("text=/^10$/").first().click();
  await page.waitForTimeout(1500);
  note("повторный клик по дню 10 — исключений осталось: " + (await page.locator("text=10.03.2026").count()));
  await shot(page, "g3-projects-calendars-holiday-toggle-off");
} else note("праздник 10.03 не найден");

// ---------- 2. График: правка задачи (2x клик по названию), затем удаление через ПКМ ----------
phase = "task-edit";
await page.goto(BASE_URL + "/projects/project-vektor-portal/schedule", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const cell = page.getByText("uiux-eval-задача-1").first();
if (await cell.count()) {
  await cell.dblclick();
  await page.waitForTimeout(800);
  await shot(page, "g3-projects-task-edit-dblclick");
  const inp = page.locator("input:focus");
  if (await inp.count()) {
    await inp.fill("uiux-eval-задача-1-ред");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    note("переименование: видно 'ред': " + (await page.getByText("uiux-eval-задача-1-ред").count()));
  } else note("dblclick не открыл инпут");
  await shot(page, "g3-projects-task-edited");
  // ПКМ меню
  phase = "task-context-menu";
  const t = page.getByText(/uiux-eval-задача-1/).first();
  await t.click({ button: "right" });
  await page.waitForTimeout(800);
  await shot(page, "g3-projects-task-context-menu");
  const del = page.getByText(/Удалить/).first();
  if (await del.count()) {
    await del.click();
    await page.waitForTimeout(800);
    await shot(page, "g3-projects-task-delete-confirm");
    // подтверждение?
    const confirm = page.getByRole("button", { name: /Удалить|Да|Подтвердить/ }).first();
    if (await confirm.count()) { await confirm.click().catch(() => {}); await page.waitForTimeout(1200); }
    note("после удаления задача видна: " + (await page.getByText(/uiux-eval-задача-1/).count()));
    await shot(page, "g3-projects-task-deleted");
  } else note("в ПКМ-меню нет пункта Удалить");
} else note("uiux-eval-задача-1 не найдена");

// ---------- 3. Gantt: вид Месяц, ширина таймлайна ----------
phase = "gantt";
await page.getByRole("button", { name: "Месяц" }).click().catch(() => note("кнопка Месяц не кликается"));
await page.waitForTimeout(1200);
await shot(page, "g3-projects-gantt-month");
// Открыт ли таймлайн на датах проекта? заголовки колонок таймлайна:
const heads = await page.locator("table thead th, [class*=timeline]").allTextContents().catch(() => []);
note("заголовки: " + JSON.stringify(heads.slice(0, 20)));

// ---------- 4. Карточка проекта: переключатель проекта, Демэнд ----------
phase = "project-card";
await page.goto(BASE_URL + "/projects/project-vektor-portal", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const sel = page.locator("select").first();
if (await sel.count()) {
  const opts = await sel.locator("option").allTextContents();
  note("опции переключателя: " + JSON.stringify(opts));
  await sel.selectOption({ index: 1 }).catch(() => note("не переключился"));
  await page.waitForTimeout(1500);
  note("после переключения url=" + page.url());
  await shot(page, "g3-projects-card-switch");
}
await page.goto(BASE_URL + "/projects/project-vektor-portal", { waitUntil: "networkidle" });
await page.getByText("Демэнд").first().click().catch(() => note("таб Демэнд не кликается"));
await page.waitForTimeout(800);
await shot(page, "g3-projects-card-demand");
// клик по задаче в списке карточки — есть ли детальный просмотр?
phase = "card-task-click";
await page.getByText("Сбор требований").first().click().catch(() => {});
await page.waitForTimeout(1000);
note("клик по задаче в карточке -> url=" + page.url());
await shot(page, "g3-projects-card-task-click");

// ---------- 5. Глобальный поиск ----------
phase = "global-search";
const gs = page.locator("input[placeholder*='Найти']");
note("глобальный поиск disabled=" + (await gs.isDisabled().catch(() => "?")) + " title=" + (await gs.getAttribute("title").catch(() => "?")));

// ---------- 6. Вьюпорт 1280x800: график и обзор ----------
phase = "viewport-1280";
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(BASE_URL + "/projects/project-vektor-portal/schedule", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot(page, "g3-projects-schedule-1280");
await page.goto(BASE_URL + "/projects/project-vektor-portal/resources", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot(page, "g3-projects-resources-1280");

writeFileSync(`${EVIDENCE_DIR}/g3-projects-deep.json`, JSON.stringify({ notes: out, network: net, console: con }, null, 2));
console.log("done. net:", net.length, "console:", con.length);
await browser.close();
