// G6 Admin: не-админ UX, невалидный подроут, вьюпорт 1280x800, мусорный домен save/restore, реальность audit API.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const report = [];

// A. Не-админ (plan-reader) на /admin
{
  const { browser, context } = await launch();
  await login(context, USERS.planReader);
  const page = await context.newPage();
  for (const route of ["/admin/users", "/admin/security", "/admin/audit"]) {
    await page.goto(BASE_URL + route, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "g6-admin-planreader" + route.replace(/\//g, "-"));
    report.push({ kind: "planreader", route, finalUrl: page.url(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 1600) });
  }
  await browser.close();
}

// B. Невалидный подроут + вьюпорт 1280x800 + мусорный домен + API
{
  const { browser, context } = await launch({ viewport: { width: 1280, height: 800 } });
  await login(context, USERS.admin);
  const page = await context.newPage();

  // невалидный подроут
  const r1 = await page.goto(BASE_URL + "/admin/nonexistent-section", { waitUntil: "networkidle" }).catch(() => null);
  await page.waitForTimeout(800);
  await shot(page, "g6-admin-invalid-subroute");
  report.push({ kind: "invalid-subroute", status: r1?.status(), url: page.url(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 1200) });

  // вьюпорт 1280x800 на users
  await page.goto(BASE_URL + "/admin/users", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "g6-admin-users-1280");
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  report.push({ kind: "viewport-1280", horizontalScroll: hscroll });

  // мусорный домен: добавить чип "это не домен!!", сохранить, проверить, удалить, сохранить
  await page.goto(BASE_URL + "/admin/security", { waitUntil: "networkidle" });
  const domInput = page.locator("main input[placeholder='company.com']");
  await domInput.fill("это не домен!!");
  await page.getByRole("button", { name: /Добавить/ }).click();
  await page.waitForTimeout(400);
  const saveBtn = page.getByRole("button", { name: /Сохранить/ });
  const canSave = !(await saveBtn.isDisabled());
  report.push({ kind: "bad-domain-save", saveEnabled: canSave });
  if (canSave) {
    await saveBtn.click();
    await page.waitForTimeout(1200);
    await shot(page, "g6-admin-security-bad-domain-saved");
    report.push({ kind: "bad-domain-save-result", tail: (await page.evaluate(() => document.body.innerText)).slice(-500) });
    // удалить чип обратно
    const chipX = page.locator("main span, main div").filter({ hasText: /^это не домен!!/ }).locator("button").first();
    await page.locator("text=это не домен!!").locator("xpath=..").locator("button, [role=button]").first().click().catch(async () => {
      // fallback: клик по крестику рядом
      await page.getByText("это не домен!!", { exact: false }).click().catch(() => {});
    });
    await page.waitForTimeout(400);
    const stillChip = await page.locator("text=это не домен!!").count();
    report.push({ kind: "bad-domain-chip-removed", stillChip });
    if (!stillChip) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      report.push({ kind: "bad-domain-restored", tail: (await page.evaluate(() => document.body.innerText)).slice(-300) });
    }
  }

  // API-реальность аудита и security-policy
  const a = await context.request.get(BASE_URL + "/api/tenant/current/audit-events");
  const s = await context.request.get(BASE_URL + "/api/tenant/current/security-policy");
  report.push({ kind: "api", auditStatus: a.status(), auditBody: (await a.text()).slice(0, 400), policyStatus: s.status(), policyBody: (await s.text()).slice(0, 400) });

  await browser.close();
}

writeFileSync(`${EVIDENCE_DIR}/g6-admin-misc.json`, JSON.stringify(report, null, 2));
console.log("done");
