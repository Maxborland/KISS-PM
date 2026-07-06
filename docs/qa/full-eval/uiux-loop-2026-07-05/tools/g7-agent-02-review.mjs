// G7 AI-агент: панель сверки (propose/confirm). Стенд работает на mock-llm и никогда не
// предлагает действий, поэтому propose/stream и execute перехватываются route-моками с
// контрактно-корректными payload — оцениваем ЧИСТО фронтовую отрисовку панели сверки.
// Реальные мутации API не выполняются.
import { writeFileSync } from "node:fs";
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";

const report = { consoleErrors: [], checks: [] };
const check = (name, data) => { report.checks.push({ name, ...data }); console.log(name, JSON.stringify(data)); };

const donePayload = {
  goal: "g7",
  model: "intercept",
  reasoning: "Предлагаю четыре действия: смена статуса, комментарий, новая задача и правка плана.",
  analyzeResults: [{ tool: "list_my_tasks", input: {}, result: {} }],
  proposedActions: [
    { tool: "change_task_status", title: "Перевести задачу «Аудит» в работу", input: { projectId: "p1", taskId: "t1", statusId: "task-status-inprogress" }, capability: { allowed: true, reason: "ok" } },
    { tool: "comment_task", title: "Комментарий к задаче «Аудит»", input: { projectId: "p1", taskId: "t1", body: "Черновик комментария от агента" }, capability: { allowed: true, reason: "ok" } },
    { tool: "create_task", title: "Создать задачу «Подготовить отчёт»", input: { projectId: "p1", title: "uiux-eval-подготовить отчёт" }, capability: { allowed: true, reason: "ok" } },
    { tool: "apply_plan_commands", title: "Сдвинуть план на 2 дня", input: { projectId: "p1", commands: [{}, {}] }, capability: { allowed: false, reason: "permission_missing" } }
  ],
  iterations: 2
};
const sse = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const streamBody =
  sse("analyze", { type: "analyze", tool: "list_my_tasks", title: "Мои задачи", ok: true }) +
  sse("proposal", { type: "proposal", tool: "change_task_status", title: "Перевести задачу «Аудит» в работу" }) +
  sse("reasoning", { type: "reasoning", text: donePayload.reasoning }) +
  sse("done", donePayload);

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
page.on("console", (msg) => { if (msg.type() === "error") report.consoleErrors.push({ text: msg.text(), url: msg.location()?.url }); });

await page.route("**/api/workspace/agent/propose/stream", async (route) => {
  await new Promise((r) => setTimeout(r, 1500)); // даём разглядеть фазу thinking
  await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: streamBody });
});
let executeBody = null;
await page.route("**/api/workspace/agent/execute", async (route) => {
  executeBody = route.request().postDataJSON();
  const results = (executeBody?.actions ?? []).map((a) => ({ tool: a.tool, ok: true, status: 200 }));
  await route.fulfill({ status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ results, applied: true }) });
});

await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });
await page.locator(".lad-composer input").fill("uiux-eval: наведи порядок в задачах");
await page.locator(".lad-send-button").click();
await page.waitForTimeout(700);
await shot(page, "g7-agent-review-thinking-steps");
const liveSteps = await page.locator(".lad-step").allTextContents().catch(() => []);
check("live-steps", { liveSteps });

await page.waitForSelector(".lad-review", { timeout: 15000 });
await page.waitForTimeout(500);
await shot(page, "g7-agent-review-open");

const headerCount = await page.locator(".lad-review__header strong").textContent();
const actualChanges = await page.locator(".lad-change").count();
const summary = await page.locator(".lad-review__summary").textContent();
const statuses = await page.locator(".lad-status").allTextContents();
check("review-header-vs-actual", { headerCount, actualChanges, summary, statuses });

// Кнопка «Выбрано ▾» в summary — живая?
await page.locator(".lad-review__summary button").click();
await page.waitForTimeout(400);
const afterSummaryClick = await page.locator(".lad-review__summary").textContent();
check("summary-dropdown-click", { afterSummaryClick, domChanged: afterSummaryClick !== summary });

// «Изменить» на нередактируемом действии (смена статуса) → сообщение в чат
await page.locator(".lad-change").nth(0).locator(".lad-change__actions button").first().click();
await page.waitForTimeout(400);
const editBlockMsg = await page.locator(".lad-message").last().locator("p").textContent();
await shot(page, "g7-agent-review-edit-blocked");
check("edit-blocked-status-action", { editBlockMsg });

// «Изменить» на комментарии → textarea, правим текст
await page.locator(".lad-change").nth(1).locator(".lad-change__actions button").first().click();
await page.waitForTimeout(300);
const textareaVisible = await page.locator(".lad-change__textarea").count();
await page.locator(".lad-change__textarea").fill("uiux-eval: правленый текст комментария");
await page.waitForTimeout(200);
const editedStatus = await page.locator(".lad-change").nth(1).locator(".lad-status").textContent();
await shot(page, "g7-agent-review-edit-comment");
check("edit-comment", { textareaVisible, editedStatus });

// «Отклонить» создание задачи
await page.locator(".lad-change").nth(2).locator(".lad-change__actions button").nth(1).click();
await page.waitForTimeout(300);
const rejectedStatus = await page.locator(".lad-change").nth(2).locator(".lad-status").textContent();
check("reject-change", { rejectedStatus });

// «Применить выбранное» (execute перехвачен)
await page.locator(".lad-review__actions button").first().click();
await page.waitForTimeout(700);
await shot(page, "g7-agent-review-applied");
const appliedBanner = await page.locator(".lad-apply-result").textContent().catch(() => null);
const applyChatMsg = await page.locator(".lad-message").last().locator("p").textContent();
check("apply-result", { appliedBanner, applyChatMsg, executeActions: executeBody?.actions?.map((a) => a.tool), editedBodySent: JSON.stringify(executeBody?.actions ?? []).includes("правленый текст") });

// Повторный клик «Применить» задизейблен?
const applyDisabled = await page.locator(".lad-review__actions button").first().isDisabled();
check("apply-disabled-after", { applyDisabled });

// «Сбросить» — деструктивно, есть ли подтверждение?
page.once("dialog", (d) => { report.checks.push({ name: "reset-native-dialog", message: d.message() }); void d.dismiss(); });
await page.locator(".lad-review__actions button").nth(1).click();
await page.waitForTimeout(500);
const msgsAfterReset = await page.locator(".lad-message").count();
const reviewGone = await page.locator(".lad-review").count();
await shot(page, "g7-agent-after-reset");
check("reset-no-confirm", { msgsAfterReset, reviewGone });

writeFileSync(`${EVIDENCE_DIR}/g7-agent-review.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log("DONE");
