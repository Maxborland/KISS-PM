// G6 Admin: удаление назначенной роли (ошибка?), переназначение и чистое удаление; аудит — фильтры/пагинация.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = [];
page.on("console", (m) => { if (m.type() === "error" && !m.location()?.url?.includes("favicon")) report.push({ kind: "console", text: m.text().slice(0, 300) }); });
page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) report.push({ kind: "http", status: r.status(), url: r.url(), method: r.request().method() }); });
const bodyText = () => page.evaluate(() => document.body.innerText);

await page.goto(BASE_URL + "/admin/roles", { waitUntil: "networkidle" });
const rrow = page.locator("tr", { hasText: "uiux-eval-g6-role-" }).first();

// 1. Удаление назначенной роли: подтвердить и посмотреть ошибку
if (await rrow.count()) {
  await rrow.locator("button[title='Удалить']").click().catch(async () => rrow.locator("button").last().click());
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Удалить роль" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "g6-admin-roles-delete-assigned-error");
  report.push({ kind: "step", step: "delete-assigned-confirmed", tail: (await bodyText()).slice(-1200) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // 2. Переназначить пользователя обратно на Администратор, затем удалить роль начисто
  await page.goto(BASE_URL + "/admin/users", { waitUntil: "networkidle" });
  const urow = page.locator("tr", { hasText: "uiux-eval-g6-17" }).first();
  await urow.locator("button[title='Изменить']").click();
  await page.waitForTimeout(600);
  const uscope = page.locator("[role=dialog], .modal").last();
  await uscope.locator("select").first().selectOption({ label: "Администратор" });
  await uscope.getByRole("button", { name: /Сохранить/ }).click();
  await page.waitForTimeout(1000);

  await page.goto(BASE_URL + "/admin/roles", { waitUntil: "networkidle" });
  const rrow2 = page.locator("tr", { hasText: "uiux-eval-g6-role-" }).first();
  await rrow2.locator("button[title='Удалить']").click().catch(async () => rrow2.locator("button").last().click());
  await page.waitForTimeout(700);
  await shot(page, "g6-admin-roles-delete-clean-confirm");
  report.push({ kind: "step", step: "delete-clean-confirm", tail: (await bodyText()).slice(-900) });
  await page.getByRole("button", { name: "Удалить роль" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "g6-admin-roles-delete-clean-done");
  report.push({ kind: "step", step: "delete-clean-done", stillThere: (await bodyText()).includes("uiux-eval-g6-role-"), tail: (await bodyText()).slice(-600) });
}

// 3. Аудит: фильтры/поиск/пагинация
await page.goto(BASE_URL + "/admin/audit", { waitUntil: "networkidle" });
const controls = {
  inputs: await page.locator("main input, [class*=admin] input").count(),
  selects: await page.locator("main select").count(),
  buttons: await page.locator("main button").allInnerTexts(),
  rows: await page.locator("main tr").count()
};
report.push({ kind: "audit-controls", controls });
// клик по строке события — есть ли детальный просмотр?
const firstRow = page.locator("main tbody tr").first();
if (await firstRow.count()) {
  await firstRow.click();
  await page.waitForTimeout(800);
  const hasModal = await page.locator("[role=dialog], .modal").count();
  await shot(page, "g6-admin-audit-row-click");
  report.push({ kind: "audit-row-click", modalOpened: hasModal, urlAfter: page.url() });
}
// прокрутка вниз: есть ли пагинация/кнопка ещё
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(600);
const tailText = (await bodyText()).slice(-700);
report.push({ kind: "audit-tail", tailText });

writeFileSync(`${EVIDENCE_DIR}/g6-admin-roles-del-audit.json`, JSON.stringify(report, null, 2));
console.log("done");
await browser.close();
