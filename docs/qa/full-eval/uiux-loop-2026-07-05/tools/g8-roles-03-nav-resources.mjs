// G8: href пунктов сайдбара (Ресурсы/KPI), вкладка ресурсов проекта под resource-reader, стадии в модалке сделки Beta.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const out = {};

// 1) planReader: все кликабельные элементы сайдбара с href/onclick
{
  const { browser, context } = await launch();
  await login(context, USERS.planReader);
  const page = await context.newPage();
  await page.goto(BASE_URL + "/dashboard", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  out.sidebar = await page.evaluate(() => {
    const items = [...document.querySelectorAll("a, button")].map(el => ({
      tag: el.tagName, text: el.innerText.trim().replace(/\n/g, " ").slice(0, 40),
      href: el.getAttribute("href"), disabled: el.disabled ?? null,
      cls: (el.className || "").toString().slice(0, 60)
    }));
    return items.filter(i => ["Ресурсы", "KPI", "Сделки", "Дашборд", "Мои задачи", "Проекты", "Коммуникации"].includes(i.text));
  });
  // клик по «Ресурсы» и «KPI» в сайдбаре — куда ведут
  for (const label of ["Ресурсы", "KPI"]) {
    await page.goto(BASE_URL + "/dashboard", { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(800);
    const el = page.locator("nav, aside").locator(`text="${label}"`).first();
    if (await el.count()) {
      await el.click().catch(() => {});
      await page.waitForTimeout(1500);
      out[`click-${label}`] = { url: page.url().replace(BASE_URL, ""), text: (await page.evaluate(() => document.body.innerText.trim())).slice(0, 300) };
      await shot(page, `g8-roles-planReader-sidebar-${label === "KPI" ? "kpi" : "resources"}`);
    } else out[`click-${label}`] = { note: "элемент не найден" };
  }
  await browser.close();
}

// 2) resourceReader: вкладка ресурсов проекта (его «родная» поверхность)
{
  const { browser, context } = await launch();
  await login(context, USERS.resourceReader);
  const page = await context.newPage();
  const fails = [];
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) fails.push({ url: r.url().replace(BASE_URL, ""), status: r.status() }); });
  for (const [route, slug] of [
    ["/projects/project-vektor-portal/resources", "project-resources"],
    ["/projects/project-vektor-portal/assignments", "project-assignments"],
    ["/projects/project-vektor-portal/overview", "project-overview"]
  ]) {
    fails.length = 0;
    await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1800);
    await shot(page, `g8-roles-resourceReader-${slug}`);
    out[`rr-${slug}`] = { text: (await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n").trim())).slice(0, 900), fails: [...fails].slice(0, 8) };
  }
  await browser.close();
}

// 3) beta: опции «Стадия» и «Клиент» в модалке новой сделки + пустой сабмит
{
  const { browser, context } = await launch();
  await login(context, USERS.beta);
  const page = await context.newPage();
  await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Сделка/ }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  out.betaDealSelects = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"], .modal, [class*="modal"]') || document.body;
    return [...dlg.querySelectorAll("select")].map(s => ({
      label: s.closest("label")?.innerText?.split("\n")[0] || s.name || s.id,
      options: [...s.options].map(o => o.text).slice(0, 10)
    }));
  });
  // пустой сабмит
  await page.getByRole("button", { name: "Создать" }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  out.betaDealEmptySubmit = (await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n").trim())).slice(0, 1200);
  await shot(page, "g8-roles-beta-deal-empty-submit");
  await browser.close();
}

writeFileSync(`${EVIDENCE_DIR}/g8-roles-nav-resources.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.sidebar, null, 1));
console.log("DONE");
