# Блок 12 — Лейн 4: live-проверки провайдеров (Б7 LLM + Д16 reset-письмо)

- Прогон: 2026-07-19
- Ветка: `codex/block12-honesty-verification`
- Рабочая копия: `/mnt/e/KISS-PM-wt-agent-first`
- HEAD: `39b71eba3ef76b8fbc9b1adc83ce238b9dd359ad`
- Принцип: ЧЕСТНОСТЬ — каждое утверждение подтверждено по коду (file:line), реальный
  внешний readback (живой LLM-ключ / SMTP-ящик) недостижим в этом окружении и явно
  помечен как внешняя предпосылка (scope-out). Никакой доставки письма/живого ответа
  LLM НЕ утверждается.
- CodeGraph MCP (`codegraph_*`) не подключён к текущей Claude Code сессии, `codegraph`
  CLI недоступен → использован grep/read fallback (раскрыто согласно AGENTS.md §8).

---

## Б7 — LLM live: гейты фабрики провайдеров подтверждены по коду

Реальный OpenRouter/Anthropic readback НЕВОЗМОЖЕН без ключа → проверено всё, что не
требует сети: гейты выбора провайдера и честный 503-путь.

### (а) Фабрика `createAgentLlmProviderFromEnv` — приоритет и гейты

`apps/api/src/agent/llmProvider.ts:256-278`

Порядок разбора (подтверждено построчно):

1. `llmProvider.ts:257` — тест-инъекция `override` (для unit) имеет высший приоритет.
2. `llmProvider.ts:262` — `testHooks = process.env.KISS_PM_E2E_TEST_HOOKS === "1"`.
3. `llmProvider.ts:263` — scripted-провайдер только за ДВОЙНЫМ гейтом:
   `if (testHooks && process.env.KISS_PM_AGENT_SCRIPTED === "1") return createScriptedLlmProvider();`
   → одного `KISS_PM_AGENT_SCRIPTED=1` недостаточно, без `KISS_PM_E2E_TEST_HOOKS=1`
   ветка не срабатывает и падает вниз к mock.
4. `llmProvider.ts:270-272` — OpenRouter при `OPENROUTER_API_KEY` (непустой) и
   `explicit ∈ {"openrouter",""}`.
5. `llmProvider.ts:273-275` — Anthropic при `ANTHROPIC_API_KEY` и `explicit ∈ {"anthropic",""}`.
6. `llmProvider.ts:276` — demo только за гейтом: `if (testHooks && (explicit === "demo" || KISS_PM_AGENT_DEMO === "true"))`.
7. `llmProvider.ts:277` — **fallback без ключей и без test-hooks → `createMockLlmProvider()`**.

Вывод по контракту:
- Без ключей и без test-hooks → **mock** (`llmProvider.ts:277`). ✔
- `KISS_PM_AGENT_SCRIPTED=1` + `KISS_PM_E2E_TEST_HOOKS=1` → **scripted** (`llmProvider.ts:263`). ✔
- `KISS_PM_AGENT_SCRIPTED=1` БЕЗ test-hooks → остаётся **mock** (ветка 263 не проходит). ✔
- `KISS_PM_AGENT_DEMO=true` БЕЗ test-hooks → остаётся **mock** (ветка 276 не проходит). ✔

Комментарий-предупреждение в коде совпадает с рантаймом (`llmProvider.ts:259-262`):
без test-hooks demo/scripted на боевой инсталляции НЕ включают фейкового агента с
`configured=true` (обход честного 503 закрыт).

### (б) Без test-hooks demo/scripted недоступны → честный 503 `agent_provider_not_configured`

Гейт «configured» отделён от фабрики (фабрика всегда отдаёт какой-то провайдер, mock —
последний fallback). Признак «настроен» определяется по модели:

- `apps/api/src/agent/agentRoutes.ts:741-746` — `agentProviderStatus`:
  `live = model ∉ {mock-llm, demo-llm, scripted-llm}`; `configured = model !== "mock-llm"`.
  → mock-llm ⇒ `configured=false`; scripted-llm ⇒ `configured=true, live=false` (канал
  работает, но это не живой LLM — UI обязан показать деградацию).
- `agentRoutes.ts:752-755` — `createAgentProviderRuntime()` = фабрика + status.
- `agentRoutes.ts:1094-1098` — `POST /api/workspace/agent/propose`: при
  `!runtime.status.configured` → `context.json({ error: "agent_provider_not_configured", provider: runtime.status, ... }, 503)`.
- `agentRoutes.ts:1119-1123` — `POST /api/workspace/agent/propose/stream`: тот же 503 до старта стрима.

### Unit-подтверждение (тест УЖЕ существует — новый не потребовался)

Задача допускала добавление unit-теста «если его нет». Тест ЕСТЬ и покрывает контракт
полностью — `apps/api/src/agent/agentProviderDegraded.test.ts`:

- `agentProviderDegraded.test.ts:52-64` — `KISS_PM_AGENT_DEMO=true` без
  `KISS_PM_E2E_TEST_HOOKS` → `provider { model: "mock-llm", configured: false }`.
- `agentProviderDegraded.test.ts:66-83` — `KISS_PM_AGENT_SCRIPTED=1` без hooks → mock;
  с `KISS_PM_E2E_TEST_HOOKS=1` → `{ model: "scripted-llm", live: false, configured: true }`.
- `agentProviderDegraded.test.ts:86-105` — mock ⇒ `configured:false`; propose и
  propose/stream отдают 503 `agent_provider_not_configured` (тихого mock-успеха нет).

Прогон (дословно):
```
 ✓ apps/api/src/agent/agentProviderDegraded.test.ts (3 tests) 29ms
 Test Files  2 passed (2)
       Tests  21 passed (21)
```

### Scope-out (Б7): живой LLM-readback

- Реальный вызов OpenRouter (`apps/api/src/agent/openRouterProvider.ts`, модель по
  умолчанию `anthropic/claude-sonnet-4.6`, `llmProvider.ts:33`) и Anthropic
  (`createAnthropicLlmProvider`, `llmProvider.ts:36-62`, `claude-sonnet-4-6`) требует
  живого `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` и сети — в этом окружении ключа нет.
- Это ВНЕШНЯЯ ПРЕДПОСЫЛКА: сам код-путь боевого провайдера прочитан и подтверждён
  статически (лениво импортирует SDK, шлёт system+messages+tools, маппит ответ),
  но фактический ответ живой модели НЕ проверялся и здесь НЕ утверждается.

---

## Д16 — reset-письмо: код-путь delivery подтверждён по коду

Реальную доставку письма в ящик проверить нельзя без работающей SMTP-инсталляции →
подтверждён только код-путь выбора `delivery`.

### Код-путь `delivery`

`apps/api/src/authRegistrationRoutes.ts:290-362` — `POST /api/auth/password-reset/request`:

- `authRegistrationRoutes.ts:336-340` — при существующем credential вызывается
  `emailProvider.sendPasswordReset({ email, rawToken, resetUrl })`.
- `authRegistrationRoutes.ts:350-355` — вычисление `delivery` (свойство ИНСТАЛЛЯЦИИ, не
  аккаунта; ответ одинаков для любого email — anti-enumeration не нарушен):
  ```
  const delivery =
    "provider" in emailProvider && emailProvider.provider === "smtp" ? "email" : "none";
  return context.json({ status: "ok", delivery }, 202);
  ```
  → `delivery: "email"` ⇔ `emailProvider.provider === "smtp"`, иначе `"none"`.

Контракт провайдеров (`apps/api/src/emailProvider.ts`):
- `emailProvider.ts:24-26,110-114` — `SmtpEmailProvider` / `createSmtpEmailProvider` →
  `provider: "smtp"` ⇒ ветка `delivery:"email"`.
- `emailProvider.ts:18-22,46-55` — `InMemoryEmailProvider` → `provider: "memory"` ⇒
  ветка `delivery:"none"` (in-memory, письмо не уходит — UI честно предупреждает).
- `emailProvider.ts:57-63` — `createEmailProviderFromEnv`: `provider === "memory"` →
  in-memory, иначе → SMTP (реальная отправка `sendSmtpMessage`, `emailProvider.ts:115-130`).
- `apps/api/src/server.ts:40` — боевой runtime использует `createEmailProviderFromEnv()`.

### Unit-подтверждение (тест УЖЕ существует)

`apps/api/src/authRegistrationRoutes.test.ts`:
- `authRegistrationRoutes.test.ts:433-462` — smtp-like provider (`{ provider: "smtp" }`) для
  существующего email → `202 { status: "ok", delivery: "email" }`, `sendPasswordReset`
  вызван ровно 1 раз с resetUrl.
- `authRegistrationRoutes.test.ts:341-360,479-486` — in-memory/несуществующий email →
  `{ status: "ok", delivery: "none" }` (anti-enumeration + честный «none»).

Прогон (дословно):
```
 ✓ apps/api/src/authRegistrationRoutes.test.ts (18 tests) 552ms
 Test Files  2 passed (2)
       Tests  21 passed (21)
```

### Scope-out (Д16): живой readback письма в ящик

- Фактическая SMTP-доставка (`sendSmtpMessage` → TCP/TLS сокет, `emailProvider.ts:236+`,
  `openSmtpSocket` `emailProvider.ts:277+`) требует работающего SMTP-сервера и заданных
  `KISS_PM_SMTP_*` (`readEmailProviderRuntimeConfig`, `emailProvider.ts:65-108`).
- Это ВНЕШНЯЯ ПРЕДПОСЫЛКА: код-путь `delivery:"email"` при `provider==="smtp"` подтверждён
  (`authRegistrationRoutes.ts:353-354`), но получение письма в реальном ящике НЕ
  проверялось и здесь НЕ утверждается.

---

## Итог лейна

- Проверено по коду: гейты фабрики LLM (mock/scripted/demo/OpenRouter/Anthropic),
  честный 503-путь `agent_provider_not_configured`, код-путь `delivery` reset-письма.
- Код НЕ менялся: расхождений контракта между кодом/комментариями/тестами и рантаймом
  не найдено — честная дочинка не потребовалась.
- Существующие unit-тесты уже покрывают оба контракта; новые не добавлялись (не были нужны).
- Scope-out: живой LLM-ключ и живая SMTP-доставка — внешние предпосылки, недостижимы
  без ключей/инсталляции; доставка/живой ответ НЕ утверждаются.

### Change index (grep/read fallback — CodeGraph MCP не подключён)

- Файлы кода изменены: нет.
- Evidence добавлено: `.superloopy/evidence/block12-provider-readback/llm-provider-gates.md` (этот файл).
- CodeGraph nodes/edges before→after: н/д (индекс `codegraph_*` недоступен в сессии; статический
  read по `llmProvider.ts`, `agentRoutes.ts`, `authRegistrationRoutes.ts`, `emailProvider.ts`).
