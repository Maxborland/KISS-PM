// G7 AI-агент: вложения (admin — успех, plan-reader — отказ) + чистый скрин ошибки сервера.
import { writeFileSync } from "node:fs";
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";

const report = { consoleErrors: [], checks: [] };
const check = (name, data) => { report.checks.push({ name, ...data }); console.log(name, JSON.stringify(data)); };
const filePayload = { name: "uiux-eval-notes.txt", mimeType: "text/plain", buffer: Buffer.from("uiux-eval: заметки для агента\nстрока 2\n", "utf8") };

// ---------- admin: успешная загрузка ----------
{
  const { browser, context } = await launch();
  await login(context, USERS.admin);
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push({ text: m.text(), url: m.location()?.url }); });
  await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });
  await page.locator(".lad-attach-anchor").selectOption({ index: 1 });
  const anchorLabel = await page.locator(".lad-attach-anchor option:checked").textContent();
  await page.locator('input[type="file"]').setInputFiles(filePayload);
  await page.waitForTimeout(1500);
  const chips = await page.locator(".lad-attach-chip").allTextContents();
  await shot(page, "g7-agent-attach-admin-uploaded");
  check("attach-admin", { anchorLabel, chips });
  // индикатор загрузки? (проверяем немедленное состояние сложно; фиксируем итог)
  // удалить чип
  await page.locator(".lad-attach-chip button").click();
  await page.waitForTimeout(300);
  check("attach-chip-remove", { chipsAfter: await page.locator(".lad-attach-chip").count() });
  await browser.close();
}

// ---------- plan-reader: отказ ----------
{
  const { browser, context } = await launch();
  await login(context, USERS.planReader);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });
  const options = await page.locator(".lad-attach-anchor option").allTextContents();
  if (options.length > 1) {
    await page.locator(".lad-attach-anchor").selectOption({ index: 1 });
    await page.locator('input[type="file"]').setInputFiles(filePayload);
    await page.waitForTimeout(1500);
    const lastMsg = await page.locator(".lad-message").last().locator("p").textContent().catch(() => null);
    const chips = await page.locator(".lad-attach-chip").count();
    await shot(page, "g7-agent-attach-plan-reader-denied");
    check("attach-plan-reader", { options, lastMsg, chips });
  } else {
    check("attach-plan-reader", { options, note: "нет доступных якорей" });
  }
  await browser.close();
}

// ---------- чистая ошибка сервера ----------
{
  const { browser, context } = await launch();
  await login(context, USERS.admin);
  const page = await context.newPage();
  await page.route("**/api/workspace/agent/propose/stream", (route) =>
    route.fulfill({ status: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "agent_llm_failed" }) })
  );
  await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });
  const input = page.locator(".lad-composer input");
  await input.fill("uiux-eval: запрос при недоступном LLM");
  const typedBefore = await input.inputValue();
  await page.locator(".lad-send-button").click();
  await page.waitForTimeout(1200);
  const errMsg = await page.locator(".lad-message").last().locator("p").textContent();
  const inputAfterError = await input.inputValue();
  await shot(page, "g7-agent-server-error-clean");
  check("server-error-clean", { typedBefore, errMsg, inputAfterError, inputLost: inputAfterError === "" });
  await browser.close();
}

writeFileSync(`${EVIDENCE_DIR}/g7-agent-attach.json`, JSON.stringify(report, null, 2));
console.log("DONE");
