// G8: глубже — /resources,/kpi под ролями; CRM-подвкладки; вкладки коммуникаций; клик «Повторить»; источник 404 на дашборде.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const out = {};

async function withUser(userKey, fn) {
  const { browser, context } = await launch();
  await login(context, USERS[userKey]);
  const page = await context.newPage();
  const fails = [];
  page.on("response", (r) => { if (r.status() >= 400) fails.push({ url: r.url().replace(BASE_URL, ""), status: r.status() }); });
  const res = await fn(page, fails);
  await browser.close();
  return res;
}

const text = (page) => page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n").trim());

// 1) /resources и /kpi под planReader и resourceReader
for (const u of ["planReader", "resourceReader"]) {
  out[u + "-extra"] = await withUser(u, async (page, fails) => {
    const r = {};
    for (const [route, slug] of [["/resources", "resources"], ["/kpi", "kpi"]]) {
      fails.length = 0;
      await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, `g8-roles-${u}-${slug}`);
      r[route] = { finalUrl: page.url().replace(BASE_URL, ""), text: (await text(page)).slice(0, 900), fails: [...fails].slice(0, 10) };
    }
    return r;
  });
}

// 2) planReader: CRM подвкладки + вкладки коммуникаций + клик «Повторить» на /admin
out["planReader-tabs"] = await withUser("planReader", async (page, fails) => {
  const r = {};
  for (const [route, slug] of [
    ["/crm/clients", "crm-clients"], ["/crm/contacts", "crm-contacts"], ["/crm/products", "crm-products"],
    ["/communications/channels", "comm-channels"], ["/communications/calls", "comm-calls"],
    ["/communications/meetings", "comm-meetings"], ["/communications/notifications", "comm-notifications"]
  ]) {
    fails.length = 0;
    await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, `g8-roles-planReader-${slug}`);
    r[route] = { finalUrl: page.url().replace(BASE_URL, ""), text: (await text(page)).slice(0, 900), fails: [...fails].slice(0, 10) };
  }
  // «Повторить» на /admin — что происходит при клике
  fails.length = 0;
  await page.goto(BASE_URL + "/admin/users", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  const before = await text(page);
  const retry = page.getByRole("button", { name: "Повторить" }).first();
  if (await retry.count()) {
    await retry.click();
    await page.waitForTimeout(2000);
    r["admin-retry"] = { textAfter: (await text(page)).slice(0, 500), sameAsBefore: before === (await text(page)), failsAfterClick: [...fails].filter(f => f.url.includes("/api/")).slice(0, 8) };
    await shot(page, "g8-roles-planReader-admin-retry");
  } else r["admin-retry"] = { note: "кнопка Повторить не найдена" };
  return r;
});

// 3) Источник 404 на /dashboard (все не-2xx, не только /api)
out["dashboard-404"] = await withUser("engineer", async (page, fails) => {
  fails.length = 0;
  await page.goto(BASE_URL + "/dashboard", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2000);
  return [...fails];
});

// 4) beta: /admin (админ пустого тенанта) + попытка открыть форму создания сделки без воронки
out["beta-extra"] = await withUser("beta", async (page, fails) => {
  const r = {};
  fails.length = 0;
  await page.goto(BASE_URL + "/admin", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "g8-roles-beta-admin");
  r["/admin"] = { finalUrl: page.url().replace(BASE_URL, ""), text: (await text(page)).slice(0, 900), fails: [...fails].slice(0, 10) };
  // «Сделка» (создать) при пустой воронке
  fails.length = 0;
  await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  const createBtn = page.getByRole("button", { name: /Сделка/ }).first();
  if (await createBtn.count()) {
    await createBtn.click();
    await page.waitForTimeout(1200);
    await shot(page, "g8-roles-beta-deal-create-empty");
    r["deal-create"] = { text: (await text(page)).slice(0, 1200), fails: [...fails].slice(0, 8) };
    await page.keyboard.press("Escape");
  } else r["deal-create"] = { note: "кнопка Сделка не найдена" };
  // /resources под beta (пустой тенант)
  fails.length = 0;
  await page.goto(BASE_URL + "/resources", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "g8-roles-beta-resources");
  r["/resources"] = { finalUrl: page.url().replace(BASE_URL, ""), text: (await text(page)).slice(0, 700), fails: [...fails].slice(0, 8) };
  return r;
});

writeFileSync(`${EVIDENCE_DIR}/g8-roles-deep.json`, JSON.stringify(out, null, 2));
console.log("DONE");
