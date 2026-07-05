# Баги: Аутентификация (Фаза 3 Full Product Evaluation Loop)

Стенд, заход 1: web `http://127.0.0.1:3000` (Next dev) → API rewrite на `http://127.0.0.1:4010` — оказался ЧУЖИМ worktree-стендом (v3-backend-unblock, trusted origin :3001).
Стенд, заход 2 (перепрогон): web `http://127.0.0.1:3000` → API `http://127.0.0.1:4020` (текущий чекаут, дефолтные trusted origins), реальный Postgres seed :55433.
Дата прогона: 2026-07-04. Учётки: admin@kiss-pm.local/admin12345 (tenant-alpha), beta@kiss-pm.local/beta12345 (tenant-beta), plan-reader-no-resources/reader12345, resource-reader/resource12345.
Доказательства (скриншоты) — в `.playwright-mcp/` (bug-auth-*.png).

**Статусы после перепрогона:** реальные баги продукта — BUG-AUTH-02…09, 11, 13; ⚪ артефакты окружения (чужой стенд, на чистом не воспроизводятся) — BUG-AUTH-01, 10, 12.

---

## BUG-AUTH-01 — ⚪ АРТЕФАКТ ОКРУЖЕНИЯ (чужой worktree-стенд) — браузерные auth-мутации падали 403 same_origin_action_required

- Статус: **⚪ не баг продукта — мисконфиг чужого стенда, на чистом стенде не воспроизводится**
- Перепрогон 2026-07-04 на чистом стенде (web :3000 → API :4020, текущий чекаут, дефолтные trusted origins `http://127.0.0.1:3000`/`http://localhost:3000`): logout из /login и /profile → **200**, register из UI → **201**, password-reset request → **202**, confirm → **200**. Клиент шлёт требуемый `x-kiss-pm-action: same-origin` корректно.
- Серьёзность (исходная запись): ~~critical~~
- Позиции: AUTH-009, AUTH-013, AUTH-017, AUTH-019, AUTH-022 (UI), AUTH-024, AUTH-034, AUTH-040
- Шаги:
  1. Залогиниться admin@kiss-pm.local/admin12345 через /login (успех).
  2. На карточке «Вы вошли» нажать «Выйти».
- Ожидание: POST /api/auth/logout → 200, возврат к форме входа, сессия убита.
- Факт: POST /api/auth/logout → **403** `{"error":"same_origin_action_required"}`. То же для POST /register, /password-reset/request, /password-reset/confirm из браузера. Единственная работающая мутация — POST /login (она освобождена от проверки: `app.ts:316 requiresSameOriginActionHeader` возвращает false для `/api/auth/login`).
- Корень: у запущенного API выставлен `KISS_PM_TRUSTED_MUTATION_ORIGINS=http://127.0.0.1:3001` (apps/api/.env воркто­ри v3-backend-unblock, PID 32940), тогда как web отдаётся на origin `http://127.0.0.1:3000`. Браузер шлёт Origin `:3000`; в `requestSecurity.ts:isTrustedBrowserMutationRequest` он не совпадает ни с origin самого запроса (:4010), ни со списком доверенных (:3001) → отказ. Серверная логика корректна — при запросе без Origin (curl) те же мутации проходят 200/201.
- Доказательства:
  - network: `[POST] /api/auth/logout => 403`, `[POST] /api/auth/register => 403`, `[POST] /api/auth/password-reset/request => 403`, `[POST] /api/auth/password-reset/confirm => 403` (все из браузера).
  - консоль: `Failed to load resource: 403 (Forbidden) @ /api/auth/logout`.
  - curl-репро: `curl -X POST :3000/api/auth/logout -H "x-kiss-pm-action: same-origin" -H "Origin: http://127.0.0.1:3000"` → 403; тот же запрос **без** Origin → 200 `{"status":"ok"}`.
  - скриншоты: bug-auth-01-login-no-redirect.png, bug-auth-logout-silent-fail.png, bug-auth-register-403-raw-error.png.
- Влияние (на момент первого прогона): пользователь того стенда не мог выйти/зарегистрироваться/сбросить пароль через UI. После пересборки стенда все затронутые позиции (AUTH-009, 013, 017, 019, 022, 024, 034, 040) перепрогнаны и прошли.
- Урок для эксплуатации: при `NODE_ENV=production` дефолт trusted origins ПУСТОЙ (`requestSecurity.ts:46`) — без явного `KISS_PM_TRUSTED_MUTATION_ORIGINS=<origin фронта>` прод получит ровно эту поломку. Стоит проверить прод-конфиг деплоя.

---

## BUG-AUTH-02 — Полное отсутствие защиты роутов: защищённые страницы монтируются анонимно, редиректа на /login нет

- Серьёзность: **critical**
- Позиции: AUTH-042
- Шаги: в инкогнито (без cookie kiss_pm_session) открыть `/dashboard`, `/admin/users`, `/projects/project-alpha/schedule`.
- Ожидание: неавторизованного редиректит на /login.
- Факт: страница рендерится полностью (сайдбар, шапка, заголовок раздела), данные падают 401, показывается инлайновый «Не удалось загрузить / session_required» с кнопкой «Повторить». Редиректа нет. В `apps/web/src` нет middleware.ts / layout-guard / единого redirect.
  - `/dashboard` → GET /api/workspace/my-work 401, /projects 401.
  - `/admin/users` → GET /api/workspace/users 401, /access-roles 401, /positions 401, /permission-catalog 401 (вся админка отрисована анониму).
  - `/projects/{id}/schedule` → session_required.
  - `/profile` — единственный честный экран «Требуется вход в систему» (но тоже без редиректа).
- Доказательства: network 401 на всех перечисленных ручках; bug-auth-unprotected-dashboard.png (админ-раздел и дашборд отрисованы без сессии).
- Перепрогон (чистый стенд): подтверждено — /dashboard анонимно монтируется, редиректа нет. **Реальный баг.**

---

## BUG-AUTH-03 — Нет редиректа после успешного входа: пользователь застревает на /login

- Серьёзность: **high**
- Позиции: AUTH-008, AUTH-043 (для /login)
- Шаги: /login → ввести admin@kiss-pm.local/admin12345 → «Войти».
- Ожидание: переход в рабочую область (/dashboard или /my-work).
- Факт: остаётся на /login, показывается карточка «Вы вошли в KISS PM» с текстом «В приложении здесь — переход в рабочую область» (заглушка `login-surface.tsx`). Реальной навигации нет ни на прод-роуте.
- Перепрогон (чистый стенд): подтверждено — после логина URL остаётся /login, карточка-заглушка. **Реальный баг.**
- Доказательства: URL остаётся `http://127.0.0.1:3000/login`; network POST /login 200 + GET /me 200; bug-auth-01-login-no-redirect.png.

---

## BUG-AUTH-04 — /register при живой чужой сессии лживо показывает «Аккаунт создан, вы вошли как {name}»

- Серьёзность: **high**
- Позиции: AUTH-043, AUTH-019
- Шаги: залогиниться админом, затем открыть `/register` (регистрацию НЕ выполнять).
- Ожидание: форма регистрации либо редирект.
- Факт: сразу показан зелёный экран «Аккаунт создан, вы вошли как Анна Администратор» + «Сессия активна — рабочее пространство доступно». Пользователь никакого аккаунта не создавал (`register-surface.tsx: registered = state==="authenticated"`). Ложное утверждение.
- Доказательства: GET /api/auth/me 200 (admin, tenant-alpha), никакого POST /register; bug-auth-register-false-created.png.

---

## BUG-AUTH-05 — /login: «Создать аккаунт» и «Забыли пароль?» — мёртвые span, не ссылки

- Серьёзность: **medium**
- Позиции: AUTH-010
- Факт: оба элемента — инертный текст (`<span title="Демо-прототип: навигация подключится…">`), клик ничего не делает, хотя /register и /password-reset существуют. В a11y-дереве это `generic`, а не `link`.
- Ожидание: рабочие `<a href="/register">` / `<a href="/password-reset">`.
- Доказательства: snapshot — `generic "Демо-прототип: навигация подключится в рабочем приложении": Нет аккаунта? Создать аккаунт`; bug-auth-login-badge-creds-deadlinks.png.

---

## BUG-AUTH-06 — /register: ссылка «Уже есть аккаунт? Войти» → href="#login" (мёртвый якорь)

- Серьёзность: **medium**
- Позиции: AUTH-020
- Факт: `<a href="#login">` — при клике страница не уходит на /login, только добавляет `#login` в URL.
- Ожидание: `href="/login"`.
- Доказательства: snapshot `link "Войти" /url: "#login"`.

---

## BUG-AUTH-07 — /password-reset и /password-reset/confirm: навигационные ссылки ведут на Storybook-URL (?path=/story/...)

- Серьёзность: **medium**
- Позиции: AUTH-028, AUTH-036, AUTH-037
- Факт: на прод-роутах ссылки имеют Storybook-адреса:
  - /password-reset «Уже есть токен? Перейти к подтверждению» → `?path=/story/auth-password-reset--confirm` (остаётся на /password-reset).
  - /password-reset/confirm «Нет токена? Запросить сброс заново» → `?path=/story/auth-password-reset--request`.
  - экран успеха confirm «Перейти ко входу» → `?path=/story/auth-login--login`.
- Перепрогон (чистый стенд): подтверждено кликом — после успешного сброса «Перейти ко входу» оставляет на `/password-reset/confirm?path=/story/auth-login--login`. **Реальный баг** (сквозной флоу сброса кликами не проходится).
- Ожидание: `/password-reset/confirm`, `/password-reset`, `/login` соответственно.
- Доказательства: клик по «Перейти к подтверждению» → URL стал `http://127.0.0.1:3000/password-reset?path=/story/auth-password-reset--confirm` (та же страница, не confirm).

---

## BUG-AUTH-08 — Плашки «Прототип» с ложной копией «Contract-mock / данные in-memory» на боевых роутах; на /login вдобавок утечка нерабочих демо-кред

- Серьёзность: **medium** (для /login — high по части утечки кред)
- Позиции: AUTH-011, AUTH-021, AUTH-029, AUTH-038 (плюс dashboard/admin/profile)
- Факт: все четыре auth-поверхности (и /dashboard, /admin/users, /profile) рендерят плашку «Прототип» с текстом вида «Contract-mock боевого POST … данные in-memory», хотя транспорт реально боевой (live fetch на Postgres). Копия вводит в заблуждение.
  - На /login плашка публикует пару `admin@kiss-pm.local / kiss-pm-admin` как «Демо-вход». Пароль `kiss-pm-admin` на live не подходит (боевой — admin12345), т.е. это одновременно и утечка «креда», и ложная инструкция.
- Ожидание: на прод-роутах плашек «прототип/in-memory» и демо-кред быть не должно.
- Доказательства: snapshot /login содержит `code: admin@kiss-pm.local / code: kiss-pm-admin`; bug-auth-login-badge-creds-deadlinks.png, bug-auth-register-false-created.png.

---

## BUG-AUTH-09 — /password-reset: поле Email предзаполнено admin@kiss-pm.local на боевом роуте

- Серьёзность: **medium**
- Позиции: AUTH-023
- Факт: при заходе на /password-reset поле «Email» уже содержит `admin@kiss-pm.local` (`reset-request-surface.tsx: useState("admin@kiss-pm.local")`). Прод-страница сброса раскрывает админский адрес и провоцирует отправку сброса на него.
- Ожидание: пустое поле.
- Доказательства: snapshot — `textbox "Email *": text: admin@kiss-pm.local`; bug-auth-reset-prefilled-admin.png.

---

## BUG-AUTH-10 — ⚪ АРТЕФАКТ ОКРУЖЕНИЯ — /profile «Выйти» показывал «Вы вышли», хотя сессия не была убита

- Статус: **⚪ не воспроизводится на чистом стенде** (следствие BUG-AUTH-01)
- Серьёзность (исходная запись): ~~high~~
- Позиции: AUTH-040
- Шаги: залогиниться админом, открыть /profile, нажать «Выйти» в шапке ЛК.
- Ожидание: сессия инвалидирована, me() → 401.
- Факт (заход 1, чужой стенд): UI показывал «Вы вышли из системы», но POST /logout вернул **403** (BUG-01), а me() — **200** (сессия жива).
- Перепрогон (чистый стенд): POST /logout → **200**, me() → **401**, экран «Вы вышли» честный. Не воспроизводится.
- Статус: **⚪ артефакт окружения** (следствие BUG-AUTH-01). Латентный дефект остаётся на заметку: UI переходит в состояние «Вы вышли» не сверяясь с исходом POST /logout — при любой будущей ошибке logout снова покажет ложное «Вы вышли». Рекомендация: показывать состояние выхода только после успешного ответа.
- Доказательства (заход 1): network `[POST] /api/auth/logout => 403`, затем `fetch('/api/auth/me')` → 200; bug-auth-profile-fake-logout.png. (заход 2): `[POST] /api/auth/logout => 200`, me → 401.

---

## BUG-AUTH-11 — /profile: «Войти снова» после logout делает reload, а не переход на /login (мёртвая петля)

- Серьёзность: **medium**
- Позиции: AUTH-041
- Факт: кнопка «Войти снова» на forbidden-экране вызывает `window.location.reload()` (`profile-surface.tsx`). На /login не ведёт никогда.
- Перепрогон (чистый стенд, сессия реально убита logout'ом): клик → reload → снова /profile с «Требуется вход в систему». **Подтверждено — реальный баг** (мёртвая петля: со страницы выхода нельзя добраться до входа кликами).
- Ожидание: переход на /login.
- Доказательства: после клика URL остаётся `http://127.0.0.1:3000/profile`, экран «Требуется вход в систему».

---

## BUG-AUTH-12 — ⚪ АРТЕФАКТ ОКРУЖЕНИЯ (в наблюдавшемся виде) — FormError показывал сырой код «same_origin_action_required»

- Статус: **⚪ наблюдавшийся кейс не воспроизводится на чистом стенде** (код возникал только из-за BUG-AUTH-01)
- Серьёзность (исходная запись): ~~low~~; остаётся **латентная слабость low**
- Позиции: AUTH-018, AUTH-025, AUTH-035
- Перепрогон (чистый стенд): все штатные коды ошибок маппятся в RU-тексты — email_taken → «Этот email уже зарегистрирован», weak_password → «Пароль слишком простой — минимум 8 символов», invalid_email → «Некорректный email», invalid_reset_token → «Ссылка для сброса недействительна». Претензий нет.
- Латентно: `use-auth.ts` маппит `message: e.code` — любой код вне RU-словаря (как это было с `same_origin_action_required`) утечёт в UI как есть. Рекомендация: fallback «Ошибка» для неизвестных кодов.
- Доказательства (заход 1): bug-auth-register-403-raw-error.png.

---

## BUG-AUTH-13 — Повторное использование токена сброса возвращает invalid_reset_token вместо reset_token_used

- Серьёзность: **low** (безопасность не страдает — токен всё равно отвергается)
- Позиции: AUTH-035, AUTH-039
- Факт: при успешном confirm все токены пользователя удаляются (`deletePasswordResetTokensByUserId`), поэтому повторный confirm тем же токеном не находит строку и отдаёт `invalid_reset_token` (400), а не документированный `reset_token_used`. Ветка `reset_token_used` достижима только в гонке двух параллельных confirm. Расхождение с критерием приёмки AUTH-035.
- Ожидание (по инвентарю): reset_token_used при повторе применённого токена.
- Перепрогон (чистый стенд, API :4020, через UI): **подтверждено** — первый confirm → 200 и экран «Пароль изменён»; повтор того же токена через форму → «Ссылка для сброса недействительна» (invalid_reset_token), а не «уже была использована».
- Доказательства: curl — первый confirm валидным токеном → 200 `{"status":"ok"}`; повтор тем же → 400 `{"error":"invalid_reset_token"}`; UI-alert «Ссылка для сброса недействительна» на повторе.
