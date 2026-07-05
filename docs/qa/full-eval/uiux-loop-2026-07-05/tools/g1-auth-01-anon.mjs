// G1 Auth — шаг 1: анонимные поверхности. Скриншоты + консольные ошибки + редиректы.
import { launch, shot, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const out = { consoleErrors: {}, results: {} };

function watchConsole(page, key) {
  out.consoleErrors[key] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      out.consoleErrors[key].push({ type: msg.type(), text: msg.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (err) => out.consoleErrors[key].push({ type: "pageerror", text: String(err).slice(0, 500) }));
}

const { browser, context } = await launch();

async function visit(path, key, { viewport } = {}) {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  watchConsole(page, key);
  const resp = await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => ({ error: String(e) }));
  await page.waitForTimeout(1200);
  const finalUrl = page.url();
  const title = await page.title().catch(() => null);
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) ?? "").catch(() => "");
  await shot(page, `g1-auth-${key}`);
  out.results[key] = {
    path,
    finalUrl,
    status: resp && typeof resp.status === "function" ? resp.status() : (resp?.error ?? null),
    title,
    bodyTextHead: bodyText
  };
  await page.close();
}

await visit("/", "anon-root");
await visit("/login", "anon-login");
await visit("/login", "anon-login-1280", { viewport: { width: 1280, height: 800 } });
await visit("/register", "anon-register");
await visit("/password-reset", "anon-reset-request");
await visit("/password-reset/confirm", "anon-reset-confirm");
await visit("/password-reset/confirm?token=abc", "anon-reset-confirm-badtoken");
await visit("/definitely-not-a-page-xyz", "anon-404");
await visit("/dashboard", "anon-dashboard-gate");

await browser.close();
writeFileSync(`${EVIDENCE_DIR}/g1-auth-anon.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
