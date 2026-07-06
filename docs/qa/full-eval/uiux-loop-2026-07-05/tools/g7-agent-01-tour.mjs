// G7 AI-агент: базовый тур по /agent (admin) — пустое состояние, меню агента,
// мёртвые кнопки, отправка запроса, деградация mock-llm, персистентность.
import { writeFileSync } from "node:fs";
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";

const report = { consoleErrors: [], pageErrors: [], checks: [] };
const check = (name, data) => { report.checks.push({ name, ...data }); console.log(name, JSON.stringify(data)); };

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
page.on("console", (msg) => { if (msg.type() === "error") report.consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => report.pageErrors.push(String(err)));

await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await shot(page, "g7-agent-empty-state");

// 1. Пустое состояние: текст
const emptyText = await page.locator(".lad-chat__empty").textContent().catch(() => null);
check("empty-state-text", { emptyText });

// 2. Заголовок вкладки / документа
check("doc-title", { title: await page.title() });

// 3. Меню агента (слайдеры)
await page.locator(".lad-chat__header-actions .lad-icon-button").last().click();
await page.waitForTimeout(300);
await shot(page, "g7-agent-status-menu");
const menuText = await page.locator(".lad-agent-menu").textContent().catch(() => null);
check("agent-menu-text", { menuText });
// кнопка «Настроить в аккаунте →» — куда ведёт?
const urlBefore = page.url();
await page.locator(".lad-agent-menu button").click().catch(() => {});
await page.waitForTimeout(500);
check("agent-menu-configure-btn", { urlBefore, urlAfter: page.url(), changed: page.url() !== urlBefore });
await page.locator(".lad-chat__header-actions .lad-icon-button").last().click(); // закрыть меню

// 4. Фейковая навигация слева: клик по «Проекты» (FolderKanban) — меняется ли URL?
const navItems = await page.locator(".lad-app-nav__item").allTextContents();
check("nav-items", { navItems });
await page.locator(".lad-app-nav__item").nth(1).click();
await page.waitForTimeout(600);
check("nav-projects-click", { urlAfter: page.url(), navigated: page.url() !== `${BASE_URL}/agent` });

// 5. История слева: элементы и клик
const historyItems = await page.locator(".lad-history__item").allTextContents();
check("history-items", { historyItems });
await page.locator(".lad-history__item").first().click();
await page.waitForTimeout(400);
const activeAfterClick = await page.locator(".lad-history__item.is-active").allTextContents();
check("history-click-effect", { clicked: historyItems[0], activeAfterClick });

// 6. Отправка запроса → mock-llm деградация
const proposeResponses = [];
page.on("response", (resp) => {
  if (resp.url().includes("/agent/propose")) proposeResponses.push({ url: resp.url(), status: resp.status() });
});
const input = page.locator(".lad-composer input");
await input.fill("uiux-eval: покажи мои задачи и предложи, что делать дальше");
await shot(page, "g7-agent-typed");
// кнопка отправки активна?
const sendDisabledFilled = await page.locator(".lad-send-button").isDisabled();
await page.locator(".lad-send-button").click();
await page.waitForTimeout(700);
await shot(page, "g7-agent-thinking");
const thinkingSteps = await page.locator(".lad-step").allTextContents().catch(() => []);
check("thinking-steps-shown", { sendDisabledFilled, thinkingSteps });
// ждём ответа
await page.waitForFunction(() => document.querySelectorAll(".lad-message").length >= 2, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(800);
await shot(page, "g7-agent-mock-response");
const messages = await page.locator(".lad-message").evaluateAll((nodes) =>
  nodes.map((n) => ({
    author: n.querySelector(".lad-message__meta span")?.textContent,
    time: n.querySelector("time")?.textContent,
    text: n.querySelector("p")?.textContent
  }))
);
check("first-exchange", { messages, proposeResponses, realTimeNow: new Date().toLocaleTimeString("ru-RU") });

// 7. Второй запрос — проверка времени сообщений (растёт по минуте?)
await input.fill("uiux-eval: а какие перегрузки ресурсов есть?");
await page.locator(".lad-send-button").click();
await page.waitForFunction(() => document.querySelectorAll(".lad-message").length >= 4, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(500);
const messages2 = await page.locator(".lad-message").evaluateAll((nodes) =>
  nodes.map((n) => ({ time: n.querySelector("time")?.textContent, text: n.querySelector("p")?.textContent?.slice(0, 60) }))
);
await shot(page, "g7-agent-second-exchange");
check("second-exchange-times", { messages2 });

// 8. Персистентность: reload → история диалога сохранилась?
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const msgsAfterReload = await page.locator(".lad-message").count();
await shot(page, "g7-agent-after-reload");
check("persistence-after-reload", { messagesBefore: messages2.length, messagesAfterReload: msgsAfterReload });

// 9. Панель вложений: селект якоря, аттач без якоря
const attachBar = await page.locator(".lad-attach-bar").count();
const anchorOptions = await page.locator(".lad-attach-anchor option").allTextContents().catch(() => []);
check("attach-bar", { attachBar, anchorOptions });
await page.locator(".lad-attach-button").click();
await page.waitForTimeout(500);
const lastMsg = await page.locator(".lad-message").last().locator("p").textContent().catch(() => null);
await shot(page, "g7-agent-attach-no-anchor");
check("attach-without-anchor", { lastMsg });

report.finalUrl = page.url();
writeFileSync(`${EVIDENCE_DIR}/g7-agent-tour.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log("DONE");
