// Общий helper для evidence-скриптов UI/UX-loop. Запуск: node <script>.mjs из worktree.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BASE_URL = process.env.EVAL_BASE_URL ?? "http://127.0.0.1:3000";
export const EVIDENCE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../evidence");

export const USERS = {
  admin: { email: "admin@kiss-pm.local", password: "admin12345" },
  beta: { email: "beta@kiss-pm.local", password: "beta12345" },
  engineer: { email: "engineer@kiss-pm.local", password: "engineer12345" },
  planReader: { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" },
  resourceReader: { email: "resource-reader@kiss-pm.local", password: "resource12345" }
};

export async function launch({ viewport = { width: 1440, height: 900 } } = {}) {
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  const context = await browser.newContext({ viewport, baseURL: BASE_URL, locale: "ru-RU" });
  return { browser, context };
}

// Логин через UI недетерминирован для скриптов — сессию берём через API, cookie кладём в контекст.
export async function login(context, user) {
  const resp = await context.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: user.email, password: user.password }
  });
  if (!resp.ok()) throw new Error(`login failed for ${user.email}: ${resp.status()}`);
  return resp;
}

export async function shot(page, name) {
  mkdirSync(`${EVIDENCE_DIR}/screenshots`, { recursive: true });
  const path = `${EVIDENCE_DIR}/screenshots/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}
