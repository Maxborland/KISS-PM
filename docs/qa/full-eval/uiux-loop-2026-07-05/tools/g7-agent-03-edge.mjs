// G7 AI-агент: edge-cases — 1280x800, длинный запрос, двойной сабмит во время thinking,
// отрисовка кода ошибки, plan-reader без проектов.
import { writeFileSync } from "node:fs";
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";

const report = { consoleErrors: [], checks: [] };
const check = (name, data) => { report.checks.push({ name, ...data }); console.log(name, JSON.stringify(data)); };

// ---------- часть 1: admin, 1280x800 ----------
{
  const { browser, context } = await launch({ viewport: { width: 1280, height: 800 } });
  await login(context, USERS.admin);
  const page = await context.newPage();
  page.on("console", (msg) => { if (msg.type() === "error") report.consoleErrors.push({ text: msg.text(), url: msg.location()?.url }); });

  // медленный stream, чтобы поймать двойной сабмит
  let streamCalls = 0;
  await page.route("**/api/workspace/agent/propose/stream", async (route) => {
    streamCalls += 1;
    await new Promise((r) => setTimeout(r, 2500));
    const done = { goal: "g", model: "intercept", reasoning: `Ответ на запрос #${streamCalls}.`, analyzeResults: [], proposedActions: [
      { tool: "comment_task", title: `Комментарий #${streamCalls}`, input: { projectId: "p1", taskId: "t1", body: "x" }, capability: { allowed: true, reason: "ok" } }
    ], iterations: 1 };
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: `event: done\ndata: ${JSON.stringify(done)}\n\n` });
  });

  await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });
  const input = page.locator(".lad-composer input");

  // двойной сабмит: второй запрос во время thinking первого
  await input.fill("uiux-eval: первый запрос");
  await page.locator(".lad-send-button").click();
  await page.waitForTimeout(400);
  const inputEnabledDuringThinking = await input.isEnabled();
  await input.fill("uiux-eval: второй запрос во время обработки первого");
  const sendEnabledDuringThinking = await page.locator(".lad-send-button").isEnabled();
  await input.press("Enter");
  await page.waitForTimeout(600);
  await shot(page, "g7-agent-double-submit-thinking");
  await page.waitForTimeout(6000);
  const msgs = await page.locator(".lad-message p").allTextContents();
  const reviewTitles = await page.locator(".lad-change strong").allTextContents().catch(() => []);
  await shot(page, "g7-agent-double-submit-result");
  check("double-submit", { inputEnabledDuringThinking, sendEnabledDuringThinking, streamCalls, msgs, reviewTitles });

  // сверка открыта на 1280x800 — layout
  await shot(page, "g7-agent-1280x800-review-open");
  const bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check("viewport-1280-overflow", { horizontalOverflow: bodyOverflow });
  await browser.close();
}

// ---------- часть 2: admin, длинный запрос + ошибка сервера ----------
{
  const { browser, context } = await launch();
  await login(context, USERS.admin);
  const page = await context.newPage();
  page.on("console", (msg) => { if (msg.type() === "error") report.consoleErrors.push({ text: msg.text(), url: msg.location()?.url }); });

  await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });
  const input = page.locator(".lad-composer input");

  // длинный запрос (1200 символов) — реальный stream стенда (mock-llm, мутаций не будет)
  const long = ("Проанализируй план проекта, перегрузки ресурсов, статусы всех задач и предложи оптимизацию. ").repeat(13);
  await input.fill(long);
  await page.locator(".lad-send-button").click();
  await page.waitForFunction(() => document.querySelectorAll(".lad-message").length >= 2, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "g7-agent-long-message");
  const userBubbleBox = await page.locator(".lad-message--user").first().boundingBox();
  check("long-message", { lengthSent: long.length, bubbleWidth: userBubbleBox?.width, bubbleHeight: userBubbleBox?.height });

  // ошибка сервера: stream отвечает 500 с кодом — что видит пользователь?
  await page.route("**/api/workspace/agent/propose/stream", (route) =>
    route.fulfill({ status: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "agent_llm_failed" }) })
  );
  await input.fill("uiux-eval: запрос при недоступном LLM");
  await page.locator(".lad-send-button").click();
  await page.waitForTimeout(1500);
  const errMsg = await page.locator(".lad-message").last().locator("p").textContent();
  await shot(page, "g7-agent-server-error");
  check("server-error-render", { errMsg });
  await browser.close();
}

// ---------- часть 3: plan-reader ----------
{
  const { browser, context } = await launch();
  await login(context, USERS.planReader);
  const page = await context.newPage();
  page.on("console", (msg) => { if (msg.type() === "error") report.consoleErrors.push({ text: msg.text(), url: msg.location()?.url }); });
  await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "g7-agent-plan-reader");
  const attachBar = await page.locator(".lad-attach-bar").count();
  await page.locator(".lad-attach-button").click();
  await page.waitForTimeout(500);
  const attachMsg = await page.locator(".lad-message").last().locator("p").textContent().catch(() => null);
  await shot(page, "g7-agent-plan-reader-attach");
  // отправка запроса
  await page.locator(".lad-composer input").fill("uiux-eval: что мне доступно?");
  await page.locator(".lad-send-button").click();
  await page.waitForFunction(() => document.querySelectorAll(".lad-message").length >= 3, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(400);
  const readerMsgs = await page.locator(".lad-message p").allTextContents();
  await shot(page, "g7-agent-plan-reader-response");
  check("plan-reader", { attachBar, attachMsg, readerMsgs });
  await browser.close();
}

writeFileSync(`${EVIDENCE_DIR}/g7-agent-edge.json`, JSON.stringify(report, null, 2));
console.log("DONE");
