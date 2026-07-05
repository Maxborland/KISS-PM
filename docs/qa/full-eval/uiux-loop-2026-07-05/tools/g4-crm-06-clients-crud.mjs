// G4 CRM: CRUD клиентов/контактов/продуктов — создание, попытка редактирования, архив (подтверждение?), клик по строке.
import { launch, login, shot, USERS, BASE_URL } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const consoleLog = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleLog.push({ url: page.url(), type: m.type(), text: m.text().slice(0, 300) }); });
page.on("dialog", (dg) => { console.log("NATIVE DIALOG:", dg.type(), "|", dg.message()); dg.accept(); });
const log = (...a) => console.log(...a);

// ===== КЛИЕНТЫ =====
await page.goto(BASE_URL + "/crm/clients", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Клиент/ }).first().click();
await page.waitForTimeout(700);
await shot(page, "g4-crm-client-create-modal");
const dlg = page.getByRole("dialog");
const dlgText = await dlg.innerText().catch(() => "no dialog");
writeFileSync(new URL("../evidence/g4-crm-client-modal-text.txt", import.meta.url), dlgText);
const inputs = dlg.locator("input, textarea");
log("клиент-модалка полей:", await inputs.count());
await inputs.nth(0).fill("uiux-eval-клиент-01");
for (let i = 1; i < (await inputs.count()); i++) {
  const ph = await inputs.nth(i).getAttribute("placeholder");
  log("поле", i, "placeholder:", ph);
}
await dlg.getByRole("button", { name: /Создать|Сохранить|Добавить/ }).last().click();
await page.waitForTimeout(1800);
await shot(page, "g4-crm-client-created");
const visible = await page.getByText("uiux-eval-клиент-01").count();
log("клиент появился без refresh:", visible > 0);

// Клик по строке/названию клиента — открывается ли редактирование?
await page.getByText("uiux-eval-клиент-01").first().click();
await page.waitForTimeout(1200);
log("url после клика по клиенту:", page.url());
await shot(page, "g4-crm-client-row-click");

// Архив своего клиента — есть ли подтверждение?
const row = page.locator("tr, [class*=row]", { hasText: "uiux-eval-клиент-01" }).last();
const archBtn = row.locator("button").last();
await archBtn.click().catch((e) => log("archive click failed:", e.message));
await page.waitForTimeout(1500);
await shot(page, "g4-crm-client-archived");
const stillVisible = await page.getByText("uiux-eval-клиент-01").count();
log("клиент виден после архивации:", stillVisible);

// ===== КОНТАКТЫ =====
await page.goto(BASE_URL + "/crm/contacts", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Контакт/ }).first().click();
await page.waitForTimeout(700);
await shot(page, "g4-crm-contact-create-modal");
const cdlg = page.getByRole("dialog");
writeFileSync(new URL("../evidence/g4-crm-contact-modal-text.txt", import.meta.url), await cdlg.innerText().catch(() => "no dialog"));
const cin = cdlg.locator("input, textarea");
await cin.nth(0).fill("uiux-eval-контакт-01");
const csel = cdlg.locator("select");
if (await csel.count()) await csel.nth(0).selectOption({ index: 1 });
// пустой email/телефон — создаём с минимумом
await cdlg.getByRole("button", { name: /Создать|Сохранить|Добавить/ }).last().click();
await page.waitForTimeout(1800);
await shot(page, "g4-crm-contact-created");
log("контакт появился:", (await page.getByText("uiux-eval-контакт-01").count()) > 0);

// Невалидный email в форме контакта
await page.getByRole("button", { name: /Контакт/ }).first().click();
await page.waitForTimeout(700);
const cdlg2 = page.getByRole("dialog");
const cin2 = cdlg2.locator("input, textarea");
await cin2.nth(0).fill("uiux-eval-контакт-bademail");
const cnt2 = await cin2.count();
for (let i = 1; i < cnt2; i++) {
  const ph = (await cin2.nth(i).getAttribute("placeholder")) || "";
  if (/mail|@/i.test(ph)) { await cin2.nth(i).fill("не-емейл"); log("filled bad email into field", i, ph); }
}
const csel2 = cdlg2.locator("select");
if (await csel2.count()) await csel2.nth(0).selectOption({ index: 1 });
await cdlg2.getByRole("button", { name: /Создать|Сохранить|Добавить/ }).last().click();
await page.waitForTimeout(1500);
await shot(page, "g4-crm-contact-bad-email");
log("модалка ещё открыта (валидация)?", await cdlg2.isVisible().catch(() => false));
await page.keyboard.press("Escape");

// ===== ПРОДУКТЫ =====
await page.goto(BASE_URL + "/crm/products", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Продукт/ }).first().click();
await page.waitForTimeout(700);
await shot(page, "g4-crm-product-create-modal");
const pdlg = page.getByRole("dialog");
writeFileSync(new URL("../evidence/g4-crm-product-modal-text.txt", import.meta.url), await pdlg.innerText().catch(() => "no dialog"));
const pin = pdlg.locator("input, textarea");
await pin.nth(0).fill("uiux-eval-продукт-01");
// цена: отрицательное значение
const pcnt = await pin.count();
for (let i = 1; i < pcnt; i++) {
  const ph = (await pin.nth(i).getAttribute("placeholder")) || "";
  const type = (await pin.nth(i).getAttribute("type")) || "";
  log("продукт поле", i, "type:", type, "placeholder:", ph);
  if (type === "number" || /цена/i.test(ph)) { await pin.nth(i).fill("-500"); log("filled -500 в поле", i); break; }
}
await pdlg.getByRole("button", { name: /Создать|Сохранить|Добавить/ }).last().click();
await page.waitForTimeout(1500);
await shot(page, "g4-crm-product-negative-price");
log("продукт-модалка открыта после -500?", await pdlg.isVisible().catch(() => false));
const body = await page.locator("body").innerText();
log("низ страницы:", body.split("\n").filter(Boolean).slice(-2).join(" | "));

writeFileSync(new URL("../evidence/g4-crm-console-clients-crud.json", import.meta.url), JSON.stringify(consoleLog, null, 2));
log("console entries:", consoleLog.length);
await browser.close();
