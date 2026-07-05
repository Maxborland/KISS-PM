// G5: интеракции на «Каналы» — отправка сообщения, создание канала uiux-eval-, правка, участники.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 400)); });
const report = { steps: [], consoleErrors };
const log = (step, detail) => { report.steps.push({ step, detail }); console.log(step, "|", detail); };

await page.goto(`${BASE_URL}/communications/channels`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// 1. Отправить сообщение в системный канал «Общий канал Альфа»
const composer = page.getByPlaceholder("Написать в канал…");
await composer.fill("uiux-eval-сообщение в общий канал");
await page.getByRole("button", { name: "Отправить" }).click();
await page.waitForTimeout(2000);
await shot(page, "g5-comms-channel-message-sent");
const feedText = await page.locator("section", { hasText: "Лента канала" }).first().innerText().catch(() => "");
log("send-message-general", feedText.slice(0, 400));

// 2. Открыть диалог «Канал», пустой сабмит
await page.getByRole("button", { name: "Канал", exact: true }).click();
await page.waitForTimeout(600);
await shot(page, "g5-comms-channel-create-dialog");
const createBtn = page.getByRole("button", { name: "Создать" });
log("create-empty-disabled", `disabled=${await createBtn.isDisabled()}`);

// 3. Создать team-канал с дефолтным placeholder scope (пользователь не знает org id)
await page.locator("select").first().selectOption("team");
await page.getByPlaceholder("Команда портала").fill("uiux-eval-канал-команда");
await page.waitForTimeout(300);
// поле «Подразделение (область)» пустое? посмотрим значение
const scopeVal = await page.getByPlaceholder("org-portal").inputValue().catch(() => "(нет поля)");
log("team-scope-default", JSON.stringify(scopeVal));
// заполняем фейковым org id как сделал бы пользователь по placeholder
await page.getByPlaceholder("org-portal").fill("org-portal");
await shot(page, "g5-comms-channel-create-team-filled");
await createBtn.click();
await page.waitForTimeout(2000);
await shot(page, "g5-comms-channel-create-team-result");
const bodyAfterTeam = await page.locator("body").innerText();
log("team-create-result", bodyAfterTeam.includes("Отклонено") ? bodyAfterTeam.split("\n").filter((l) => l.includes("Отклонено")).join(" ") : "нет 'Отклонено' в UI");

// диалог ещё открыт? проверим потерю ввода
const dialogVisible = await page.getByRole("dialog").isVisible().catch(() => false);
log("dialog-after-reject", `visible=${dialogVisible}`);
if (dialogVisible) {
  const titleVal = await page.getByPlaceholder("Команда портала").inputValue().catch(() => "");
  log("title-preserved", JSON.stringify(titleVal));
  // 4. переключаемся на «Произвольный» и создаём
  await page.locator("select").first().selectOption("custom");
  await page.getByPlaceholder("Команда портала").fill("uiux-eval-канал");
  await page.getByPlaceholder("Для чего этот канал…").first().fill("Канал для UI/UX-оценки");
  await createBtn.click();
  await page.waitForTimeout(2000);
}
await shot(page, "g5-comms-channel-created");
const bodyAfterCustom = await page.locator("body").innerText();
log("custom-create-result", bodyAfterCustom.includes("uiux-eval-канал") ? "канал в списке" : "канала НЕТ в списке");

// 5. Выбрать созданный канал, изменить название, добавить участника, удалить участника
const chBtn = page.getByRole("button", { name: /uiux-eval-канал/ }).first();
if (await chBtn.isVisible().catch(() => false)) {
  await chBtn.click();
  await page.waitForTimeout(1500);
  await shot(page, "g5-comms-channel-detail");
  // правка
  await page.getByRole("button", { name: "Изменить" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("dialog").locator("input").first().fill("uiux-eval-канал (ред.)");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.waitForTimeout(1500);
  await shot(page, "g5-comms-channel-edited");
  log("edit-channel", (await page.locator("body").innerText()).includes("uiux-eval-канал (ред.)") ? "название обновилось" : "НЕ обновилось");
  // добавить участника
  const userSel = page.locator("select").filter({ hasText: "Выберите…" }).first();
  if (await userSel.isVisible().catch(() => false)) {
    const opts = await userSel.locator("option").allTextContents();
    log("add-member-options", JSON.stringify(opts));
    await userSel.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Добавить" }).click();
    await page.waitForTimeout(1500);
    await shot(page, "g5-comms-channel-member-added");
    log("add-member", (await page.locator("section", { hasText: "Участники" }).last().innerText()).slice(0, 300));
    // удалить участника (есть ли подтверждение?)
    const rm = page.getByRole("button", { name: "Удалить участника" }).first();
    if (await rm.isVisible().catch(() => false)) {
      await rm.click();
      await page.waitForTimeout(1200);
      await shot(page, "g5-comms-channel-member-removed");
      log("remove-member-no-confirm", "клик по иконке удалил без подтверждения? см. скриншот");
    }
  }
  // удаление канала — есть ли вообще?
  const bodyDetail = await page.locator("body").innerText();
  log("channel-delete-exists", bodyDetail.includes("Удалить канал") ? "есть" : "кнопки удаления канала НЕТ");
} else {
  log("channel-select", "созданный канал не найден в списке");
}

writeFileSync(`${EVIDENCE_DIR}/g5-comms-channels-report.json`, JSON.stringify(report, null, 2));
await browser.close();
