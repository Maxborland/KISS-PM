// G2: вернуть сид-задачу «Подготовить ресурсную оценку» в «В работе» через допустимые переходы.
import { launch, login, USERS } from "./browser.mjs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
await page.goto("/my-work", { waitUntil: "networkidle" });
await page.locator("text=Список").first().click();
await page.waitForTimeout(1000);
const row = page.locator("main tr", { hasText: "Подготовить ресурсную оценку" }).first();
const sel = row.locator("select");
console.log("start:", await sel.inputValue());
for (const label of ["На контроле", "В работе"]) {
  await sel.selectOption({ label }).catch(() => {});
  await page.waitForTimeout(1800);
  const v = await sel.inputValue();
  const msg = (await page.locator("main").innerText()).split("\n").filter(Boolean).slice(-1);
  console.log(`after "${label}":`, v, msg);
}
await browser.close();
