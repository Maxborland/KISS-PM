// E2E: provider-status сигналы — email (сброс пароля), LLM (агент), video (звонок).
import { launch, USERS } from "./browser.mjs";
const BASE = "http://127.0.0.1:3010";
const { browser, context } = await launch();
await context.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });
const out = [];
const check = (n, ok, note = "") => { out.push({ n, ok }); console.log(ok ? "PASS" : "FAIL", n, note); };

// 1) email: заявка на сброс → предупреждение «письмо не придёт» (delivery:none)
const page = await context.newPage();
await page.goto(`${BASE}/password-reset`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const emailPrefill = await page.locator("#reset-email").inputValue();
check("reset-email-not-prefilled", emailPrefill === "", emailPrefill);
await page.locator("#reset-email").fill("admin@kiss-pm.local");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);
const t1 = await page.textContent("body");
check("reset-honest-degradation", t1.includes("не настроена — письмо не придёт"), "");
check("reset-no-prototype-banner", !t1.includes("Contract-mock") && !t1.includes("Прототип"), "");
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p05-reset-delivery-none.png", fullPage: true });

// 2) LLM: /agent показывает баннер демо-режима
await page.goto(`${BASE}/agent`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const t2 = await page.textContent("body");
check("agent-demo-banner", t2.includes("Демо-режим") && t2.includes("LLM-ключ не настроен"), "");
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p05-agent-demo.png", fullPage: false });

console.log(JSON.stringify(out));
await browser.close();
if (out.some((x) => !x.ok)) process.exit(1);
