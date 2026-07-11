# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-eval\auth-public.spec.ts >> Lane 1 AUTH PUBLIC >> AUTH-RESET: created user request, invalid token and live delivery
- Location: e2e\full-eval\auth-public.spec.ts:178:3

# Error details

```
Error: AUTH-RESET blocker for auth-public-mrdyakox-29908@example.test. Expected: delivery=email with a retrievable SMTP message so the created user's raw token can drive confirm, new-password login, reload, logout and token reuse checks. Actual: delivery=none; the running API exposes no auth reset-token test hook, and only a token hash is persisted.

expect(received).toBe(expected) // Object.is equality

Expected: "email"
Received: "none"
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: К
        - generic [ref=e8]:
          - generic [ref=e9]: KISS PM
          - generic [ref=e10]: Рабочее пространство
      - heading "Новый пароль" [level=1] [ref=e11]
      - paragraph [ref=e12]: Вставьте токен сброса и задайте новый пароль рабочего пространства.
      - generic [ref=e13]:
        - generic [ref=e14]:
          - generic [ref=e15]: Токен сброса *
          - textbox "Токен сброса *" [ref=e17]:
            - /placeholder: 64-символьный токен из письма
            - text: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
        - generic [ref=e18]:
          - generic [ref=e19]: Новый пароль *
          - generic [ref=e21]:
            - textbox "Новый пароль *" [active] [ref=e22]:
              - /placeholder: Минимум 8 символов
              - text: Auth-public-reset-67890
            - button "Скрыть пароль" [pressed] [ref=e23] [cursor=pointer]:
              - img
        - alert [ref=e24]: Ссылка для сброса недействительна
        - button "Изменить пароль" [ref=e25] [cursor=pointer]:
          - img
          - text: Изменить пароль
      - link "Нет токена? Запросить сброс заново" [ref=e27] [cursor=pointer]:
        - /url: /password-reset
  - region "Notifications alt+T"
  - alert [ref=e28]
```

# Test source

```ts
  144 |         user: { name: registeredUser.name },
  145 |         workspace: { id: registerBody.workspace.id }
  146 |       }
  147 |     });
  148 |     await page.reload();
  149 |     await expect(page).toHaveURL(/\/dashboard$/);
  150 |     await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  151 |     expect(await browserReadback(page, "/api/auth/me")).toEqual(meAfterRegister);
  152 |     await screenshot(page, "auth-register-success-after-reload.png");
  153 |
  154 |     const logoutResponsePromise = waitForAuthResponse(page, "/api/auth/logout");
  155 |     await logoutThroughUserMenu(page);
  156 |     expect((await logoutResponsePromise).status()).toBe(200);
  157 |     await expect(page).toHaveURL(/\/login$/);
  158 |
  159 |     await page.goto("/register");
  160 |     await page.getByLabel("Имя").fill(`${registeredUser.name} Duplicate`);
  161 |     await page.getByLabel("Email").fill(registeredUser.email);
  162 |     await page.locator('input[autocomplete="new-password"]').fill(registeredUser.password);
  163 |     const duplicateResponsePromise = waitForAuthResponse(page, "/api/auth/register");
  164 |     await page.locator('input[autocomplete="new-password"]').press("Enter");
  165 |     const duplicateResponse = await duplicateResponsePromise;
  166 |     expect(duplicateResponse.status()).toBe(409);
  167 |     await expect(duplicateResponse.json()).resolves.toEqual({ error: "email_taken" });
  168 |     await expect(page.getByRole("alert").filter({ hasText: "Этот email уже зарегистрирован" })).toHaveText(
  169 |       "Этот email уже зарегистрирован"
  170 |     );
  171 |     expect(await browserReadback(page, "/api/auth/me")).toEqual({
  172 |       status: 401,
  173 |       body: { error: "session_required" }
  174 |     });
  175 |     await screenshot(page, "auth-register-duplicate.png");
  176 |   });
  177 |
  178 |   test("AUTH-RESET: created user request, invalid token and live delivery", async ({ page }) => {
  179 |     await page.goto("/password-reset");
  180 |     await expect(page.getByRole("heading", { name: "Сброс пароля" })).toBeVisible();
  181 |
  182 |     const email = page.getByLabel("Email");
  183 |     await email.fill("not-an-email");
  184 |     const invalidEmailResponsePromise = waitForAuthResponse(
  185 |       page,
  186 |       "/api/auth/password-reset/request"
  187 |     );
  188 |     await email.press("Enter");
  189 |     const invalidEmailResponse = await invalidEmailResponsePromise;
  190 |     expect(invalidEmailResponse.status()).toBe(400);
  191 |     await expect(invalidEmailResponse.json()).resolves.toEqual({ error: "invalid_email" });
  192 |     await expect(page.getByRole("alert").filter({ hasText: "Некорректный email" })).toHaveText(
  193 |       "Некорректный email"
  194 |     );
  195 |     await screenshot(page, "auth-reset-invalid-email.png");
  196 |
  197 |     await email.fill(registeredUser.email);
  198 |     const resetRequestResponsePromise = waitForAuthResponse(
  199 |       page,
  200 |       "/api/auth/password-reset/request"
  201 |     );
  202 |     await email.press("Enter");
  203 |     const resetRequestResponse = await resetRequestResponsePromise;
  204 |     expect(resetRequestResponse.status()).toBe(202);
  205 |     const resetRequestBody = (await resetRequestResponse.json()) as {
  206 |       status: string;
  207 |       delivery?: "email" | "none";
  208 |     };
  209 |     expect(resetRequestBody.status).toBe("ok");
  210 |     await expect(page.getByRole("status")).toContainText(
  211 |       resetRequestBody.delivery === "email"
  212 |         ? "Если адрес зарегистрирован"
  213 |         : "отправка почты в этой инсталляции не настроена"
  214 |     );
  215 |     await screenshot(page, `auth-reset-request-delivery-${resetRequestBody.delivery ?? "missing"}.png`);
  216 |
  217 |     await page.goto(`/password-reset/confirm?token=${"a".repeat(64)}`);
  218 |     await expect(page.getByRole("heading", { name: "Новый пароль" })).toBeVisible();
  219 |     await expect(page.getByLabel("Токен сброса")).toHaveValue("a".repeat(64));
  220 |     const newPassword = page.getByLabel("Новый пароль");
  221 |     await newPassword.fill(registeredUser.resetPassword);
  222 |     await page.getByRole("button", { name: "Показать пароль" }).click();
  223 |     await expect(newPassword).toHaveAttribute("type", "text");
  224 |     const invalidTokenResponsePromise = waitForAuthResponse(
  225 |       page,
  226 |       "/api/auth/password-reset/confirm"
  227 |     );
  228 |     await newPassword.press("Enter");
  229 |     const invalidTokenResponse = await invalidTokenResponsePromise;
  230 |     expect(invalidTokenResponse.status()).toBe(400);
  231 |     await expect(invalidTokenResponse.json()).resolves.toEqual({ error: "invalid_reset_token" });
  232 |     await expect(
  233 |       page.getByRole("alert").filter({ hasText: "Ссылка для сброса недействительна" })
  234 |     ).toHaveText("Ссылка для сброса недействительна");
  235 |     await screenshot(page, "auth-reset-invalid-token.png");
  236 |
  237 |     expect(
  238 |       resetRequestBody.delivery,
  239 |       [
  240 |         `AUTH-RESET blocker for ${registeredUser.email}.`,
  241 |         "Expected: delivery=email with a retrievable SMTP message so the created user's raw token can drive confirm, new-password login, reload, logout and token reuse checks.",
  242 |         `Actual: delivery=${resetRequestBody.delivery ?? "missing"}; the running API exposes no auth reset-token test hook, and only a token hash is persisted.`
  243 |       ].join(" ")
> 244 |     ).toBe("email");
      |       ^ Error: AUTH-RESET blocker for auth-public-mrdyakox-29908@example.test. Expected: delivery=email with a retrievable SMTP message so the created user's raw token can drive confirm, new-password login, reload, logout and token reuse checks. Actual: delivery=none; the running API exposes no auth reset-token test hook, and only a token hash is persisted.
  245 |   });
  246 | });
  247 |
  248 | async function waitForAuthResponse(page: Page, pathname: string): Promise<Response> {
  249 |   return page.waitForResponse((response) => {
  250 |     const url = new URL(response.url());
  251 |     return url.pathname === pathname && response.request().method() === "POST";
  252 |   });
  253 | }
  254 |
  255 | async function browserReadback(page: Page, pathname: string) {
  256 |   return page.evaluate(async (path) => {
  257 |     const response = await fetch(path, { credentials: "same-origin" });
  258 |     return { status: response.status, body: await response.json() };
  259 |   }, pathname);
  260 | }
  261 |
  262 | async function logoutThroughUserMenu(page: Page) {
  263 |   const explicitMenuButton = page.getByRole("button", { name: "Открыть меню пользователя" });
  264 |   if (await explicitMenuButton.count()) {
  265 |     await explicitMenuButton.click();
  266 |   } else {
  267 |     await page.getByRole("banner").getByRole("button").last().click();
  268 |   }
  269 |
  270 |   const menuItem = page.getByRole("menuitem", { name: "Выйти" });
  271 |   if (await menuItem.count()) {
  272 |     await menuItem.click();
  273 |   } else {
  274 |     await page.getByRole("button", { name: "Выйти из рабочего пространства" }).click();
  275 |   }
  276 | }
  277 |
  278 | async function screenshot(page: Page, name: string) {
  279 |   await page.screenshot({ path: join(evidenceRoot, name), fullPage: true });
  280 | }
  281 |
```
