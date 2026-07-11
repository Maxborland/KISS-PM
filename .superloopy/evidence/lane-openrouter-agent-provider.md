# Lane QA: OpenRouter и agent-provider variants

## Итог

- Время свежего прогона: `2026-07-09T18:31:57Z` - `2026-07-09T18:36:29Z` (`2026-07-10 01:31-01:36 +07:00`).
- Целевые сервисы: Web `http://127.0.0.1:3180`, API `http://127.0.0.1:4180`.
- Общий verdict: `PARTIAL / BLOCKED`.
- `PASS`: доступность сервисов, изолированная browser-аутентификация, no-provider API contract, no-provider browser UX.
- `BLOCKED`: свежий OpenRouter API/SSE/browser вариант и Anthropic provider вариант. Текущий API runtime сообщает `mock-llm`, хотя ignored `.env.local` содержит OpenRouter-конфигурацию.
- Значения API keys, пароль и session cookie не читались в evidence и не сохранялись.

## Existing evidence inspected

Существующие артефакты использовались только для определения оставшегося scope, не как свежий PASS:

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-agent-live-openrouter-api-sse-2026-07-07.json`: прежний OpenRouter API/SSE PASS на `:4108`.
- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-agent-live-browser-sse-apply-2026-07-07.json`: прежний OpenRouter browser/apply/readback PASS на Web `:3108`, API `:4108`.
- `docs/qa/full-eval/evidence/browser-agent-no-provider-degraded-2026-07-08/risk-agent-no-provider-degraded-browser-2026-07-08.json`: прежний degraded-provider browser PASS на Web `:3160`, API `:4170`.
- `docs/qa/full-eval/agent-reports/agent-llm-sse-2026-07-07.md`: указывает, что OpenRouter был проверен ранее, а более широкие provider/role варианты оставались открыты.

Эти порты и процессы не равны текущим `:3180/:4180`, поэтому старые PASS не перенесены на текущую lane.

## Configuration inspection

### Fresh readback

Выполнено `2026-07-09T18:34Z` - `2026-07-09T18:35Z`.

Санитизированная проверка `.env.local`:

```text
KISS_PM_AGENT_PROVIDER=openrouter
KISS_PM_AGENT_MODEL=anthropic/claude-sonnet-4.6
OPENROUTER_API_KEY=[REDACTED_PRESENT]
ANTHROPIC_API_KEY=[ABSENT]
```

Значение OpenRouter key не выводилось. Проверялись только presence/non-empty и несекретные provider/model.

Listener `:4180`:

```text
process=node.exe
pid=40032
started=2026-07-08T17:34:37.849996+07:00
```

Авторитетный runtime readback через `GET /api/workspace/agent/tools`:

```json
{"status":200,"provider":{"model":"mock-llm","live":false,"configured":false},"toolCount":52}
```

Вывод: файл конфигурации и уже работающий процесс расходятся. Наиболее вероятно, процесс не загрузил текущий `.env.local` либо был запущен с override, но причина не доказана и поэтому не объявляется как факт.

## Test data

- Создан один локальный QA-аккаунт через browser registration: `qa-openrouter-20260709183157@kiss-pm.local`.
- Display marker: `QA-OPENROUTER-20260709183157`.
- Пароль генерировался в памяти, в отчёт/команды/артефакты не записан.
- Cookie оставался в памяти тестового процесса и не выводился.
- Другие product records не создавались; agent prompts были явно `READ-ONLY`.
- Аккаунт не удалялся: удаление не требовалось для проверки и расширило бы mutation scope.

## Scenario 1: service reachability and isolated auth

**Timestamp:** регистрация `2026-07-09T18:31:57Z`; финальный health readback `2026-07-09T18:35:09.491Z`.

**Actions:**

1. `HEAD http://127.0.0.1:3180` -> `200 text/html`.
2. `HEAD http://127.0.0.1:4180` -> `404`, что подтверждает listener на API root.
3. Browser: `/register`; заполнены accessibility-locators по placeholders `Иван Иванов`, `you@example.com`, `Минимум 8 символов`; нажата единственная кнопка `Создать аккаунт`.
4. Fresh API login для созданного QA-аккаунта -> `200`; session cookie получен, но не выведен.
5. `GET http://127.0.0.1:4180/health` -> `200`.

**Verdict:** `PASS`.

## Scenario 2: current provider status

**Timestamp:** `2026-07-09T18:35:09.491Z` - `2026-07-09T18:35:09.579Z`.

**Sanitized command shape:**

```text
GET http://127.0.0.1:4180/api/workspace/agent/tools
Cookie: [REDACTED_IN_MEMORY]
```

**Fresh evidence:**

```json
{"status":200,"provider":{"model":"mock-llm","live":false,"configured":false},"toolCount":52}
```

**Verdict:** `PASS` только для обнаружения и честного представления текущего no-provider runtime. Это не OpenRouter PASS.

## Scenario 3: no-provider propose and SSE contracts

**Timestamp:** `2026-07-09T18:35:09.491Z` - `2026-07-09T18:35:09.579Z`.

**Requests:**

```text
POST /api/workspace/agent/propose
POST /api/workspace/agent/propose/stream
Goal marker: QA-OPENROUTER-20260709183157 ... READ-ONLY
Cookie: [REDACTED_IN_MEMORY]
```

**Fresh evidence:**

```json
{
  "propose":{"status":503,"error":"agent_provider_not_configured"},
  "stream":{"status":503,"contentType":"application/json","error":"agent_provider_not_configured","containsSseEvent":false}
}
```

**Expected:** не открывать фальшивый SSE и не выдавать mock-ответ за live provider.

**Verdict:** `PASS`.

## Scenario 4: browser degraded-provider UX

**Timestamp:** DOM readback `2026-07-09T18:35:09.491Z` - `2026-07-09T18:35:09.579Z`; screenshot `2026-07-09T18:35:30.8829676Z`.

**Browser actions:**

1. Открыт `http://127.0.0.1:3180/agent` в fresh Chrome tab с созданной QA-сессией.
2. В accessibility input `Сообщение Генри Гантту` отправлен prompt `QA-OPENROUTER-20260709183157 BROWSER READ-ONLY`.
3. Выполнен fresh visible-text readback после ответа.
4. Проверено отсутствие review drawer и `Применить выбранное`.

**Fresh visible evidence:**

```text
Демо-режим
LLM-ключ не настроен (провайдер mock-llm)
LLM-провайдер не настроен (провайдер mock-llm)
review=false
apply=false
```

**Screenshot:** `01-agent-degraded-provider.png`

- Bytes: `59288`
- SHA-256: `82d91b91841fd80006a0b64d55d226ac74313db5215b00efdeeb62a84476ff00`
- Visual readback: banner clearly says `Демо-режим`, `LLM-ключ не настроен`, provider `mock-llm`; no proposal/review controls are visible.

После отправки prompt второй screenshot capture дважды упёрся в Chrome CDP timeout. Это не использовано как PASS evidence; post-submit PASS основан на свежем DOM visible-text readback, а сохранённый screenshot доказывает исходный degraded-state.

**Verdict:** `PASS`.

## Scenario 5: live OpenRouter API/SSE/browser

**Attempted:** да, через текущие `:3180/:4180` provider status и propose endpoints.

**Actual blocker:** runtime сообщает `model=mock-llm`, `live=false`, `configured=false`; `/propose/stream` возвращает `503 application/json`, а не `200 text/event-stream`.

Ignored `.env.local` содержит OpenRouter provider/model и non-empty key, но наличие файла не доказывает, что работающий процесс загрузил его. Ключ не использовался для прямого внешнего запроса и процесс не перезапускался, чтобы не менять уже работающую среду вне lane scope.

**Verdict:** `BLOCKED`, не PASS.

## Scenario 6: Anthropic provider variant

**Fresh configuration evidence:** `ANTHROPIC_API_KEY=[ABSENT]`; текущий runtime `mock-llm`.

Live API/network/browser вызов Anthropic не выполнялся.

**Verdict:** `BLOCKED`, не PASS.

## Exact remaining work

1. В отдельном согласованном runtime либо после контролируемого restart `:4180` загрузить ignored `.env.local`, не выводя key. Web `:3180` должен быть направлен на этот API.
2. Fresh readback должен вернуть `provider.model=anthropic/claude-sonnet-4.6`, `live=true`, `configured=true`. Пока этого нет, OpenRouter тест не начинать и не считать пройденным.
3. Повторить с новым unique marker: authenticated `/propose/stream` -> `200 text/event-stream`; зафиксировать event sequence, `done.model`, отсутствие `error`, отсутствие secret-bearing headers/body в evidence.
4. В browser подтвердить отсутствие degraded banner, отправить read-only prompt, увидеть live response, сохранить screenshot и fresh DOM readback. Для mutation-варианта использовать отдельный unique marker и применять только явно выбранное безопасное действие с API/UI readback.
5. Для Anthropic либо предоставить key в изолированный runtime и повторить те же API/browser шаги, либо оставить variant официально provider-unavailable/`BLOCKED`.
6. После согласования cleanup удалить только синтетический аккаунт `qa-openrouter-20260709183157@kiss-pm.local`; текущая lane удаления не выполняла.

## Scope and change index

- Product code и shared QA matrix не изменялись.
- Созданы только разрешённые artifacts:
  - `.superloopy/evidence/lane-openrouter-agent-provider.md`
  - `.superloopy/evidence/openrouter-agent/01-agent-degraded-provider.png`
- CodeGraph before: `2168 files / 23922 nodes / 51772 edges`.
- `codegraph sync` не запускался: он записал бы `.codegraph/`, что противоречит explicit scope `may only write the report and screenshots`.
- Source symbols added/changed/removed: `0 / 0 / 0`; graph edges changed by this lane: `0` expected. Markdown/PNG не являются product source symbols.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/lane-openrouter-agent-provider.md
