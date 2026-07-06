// G6 Admin: /admin/roles — создание роли, редактирование прав, удаление (пустой и назначенной).
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const ts = Date.now();
const roleName = `uiux-eval-g6-role-${ts}`;
const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = [];
page.on("console", (m) => { if (m.type() === "error" && !m.location()?.url?.includes("favicon")) report.push({ kind: "console", text: m.text().slice(0, 300) }); });
page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) report.push({ kind: "http", status: r.status(), url: r.url(), method: r.request().method() }); });
page.on("dialog", async (d) => { report.push({ kind: "native-dialog", type: d.type(), message: d.message() }); await d.accept(); });
const bodyText = () => page.evaluate(() => document.body.innerText);

await page.goto(BASE_URL + "/admin/roles", { waitUntil: "networkidle" });

// 1. Создать роль
await page.getByRole("button", { name: /Создать роль/ }).click();
await page.waitForTimeout(700);
await shot(page, "g6-admin-roles-create-modal");
report.push({ kind: "step", step: "create-modal", text: (await bodyText()).slice(1000, 5000) });

// поля модалки
const dlg = page.locator("[role=dialog], .modal").last();
const scope = (await dlg.count()) ? dlg : page;
const inputs = await scope.locator("input").all();
report.push({ kind: "info", inputCount: inputs.length, checkboxCount: await scope.locator("input[type=checkbox]").count() });
await scope.locator("input[type=text], input:not([type])").first().fill(roleName);
// отметим первые 2 чекбокса прав, если есть
const cbs = scope.locator("input[type=checkbox]");
const cbCount = await cbs.count();
for (let i = 0; i < Math.min(2, cbCount); i++) await cbs.nth(i).check().catch(() => {});
await shot(page, "g6-admin-roles-create-filled");
await scope.getByRole("button", { name: /Создать|Сохранить/ }).last().click();
await page.waitForTimeout(1200);
await shot(page, "g6-admin-roles-created");
report.push({ kind: "step", step: "created", tail: (await bodyText()).slice(-1200) });

// 2. Редактировать роль
const row = page.locator("tr", { hasText: roleName }).first();
report.push({ kind: "info", roleRowFound: await row.count() });
if (await row.count()) {
  await row.locator("button[title='Изменить']").click().catch(async () => row.locator("button").first().click());
  await page.waitForTimeout(700);
  await shot(page, "g6-admin-roles-edit-modal");
  report.push({ kind: "step", step: "edit-modal", text: (await bodyText()).slice(1000, 4500) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // 3. Назначить роль своему uiux-eval пользователю, потом попробовать удалить роль
  await page.goto(BASE_URL + "/admin/users", { waitUntil: "networkidle" });
  const urow = page.locator("tr", { hasText: "uiux-eval-g6-17" }).first();
  if (await urow.count()) {
    await urow.locator("button[title='Изменить']").click();
    await page.waitForTimeout(600);
    const uscope = page.locator("[role=dialog], .modal").last();
    await uscope.locator("select").first().selectOption({ label: roleName }).catch((e) => report.push({ kind: "err", step: "assign-role", e: String(e).slice(0, 200) }));
    await uscope.getByRole("button", { name: /Сохранить/ }).click();
    await page.waitForTimeout(1000);
    await shot(page, "g6-admin-users-role-assigned");
    report.push({ kind: "step", step: "role-assigned", tail: (await bodyText()).slice(-1000) });
  }

  // 4. Удалить назначенную роль
  await page.goto(BASE_URL + "/admin/roles", { waitUntil: "networkidle" });
  const rrow = page.locator("tr", { hasText: roleName }).first();
  await rrow.locator("button[title='Удалить']").click().catch(async () => rrow.locator("button").last().click());
  await page.waitForTimeout(1200);
  await shot(page, "g6-admin-roles-delete-assigned");
  report.push({ kind: "step", step: "delete-assigned-role", tail: (await bodyText()).slice(-1500) });

  // вернуть пользователю роль Наблюдатель ресурсов? Нет — вернём "Наблюдатель плана без ресурсов"? Он был Администратор по умолчанию. Вернём Администратор? Оставим — это наш uiux-eval юзер.
}
writeFileSync(`${EVIDENCE_DIR}/g6-admin-roles.json`, JSON.stringify(report, null, 2));
console.log("done");
await browser.close();
