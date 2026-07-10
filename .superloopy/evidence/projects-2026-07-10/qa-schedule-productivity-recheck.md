# Schedule Productivity Recheck

## Verdict

**APPROVE**

Повторный read-only gate подтверждает, что F-01 и F-02 закрыты в текущем E2E, а новый полный Playwright run выполняет усиленные assertions. Обязательные F1/F2/F3, PROJ-124 и PROJ-125 доказаны текущим кодом и свежими результатами.

## Scope

Повторно проверены только:

- `e2e/full-eval/projects-schedule-productivity.spec.ts`
- `.superloopy/evidence/projects-2026-07-10/schedule-productivity-playwright.json`
- связанные результаты первого gate для Schedule/API/domain/planning-client

Product code, tests, docs matrix и чужие evidence-файлы не редактировались. Обновлён только этот audit artifact. Commit не создавался.

## Resolved Findings

### F-01 / PROJ-125: RESOLVED

Сценарий создаёт ровно 10 задач keyboard-only через focus workspace, `Insert`, typing, `Enter` и keyboard confirmation (`projects-schedule-productivity.spec.ts:38-40,68-80`). До reload он сохраняет IDs в `keyboardTasks` (`:82-86`).

После `page.reload()` тест получает новый server read model и сравнивает IDs всех десяти задач, найденных по полному `keyboardTitles`, с исходными IDs (`:264-268`). Это доказывает сохранность всех 10 строк и идентичность каждой строки без повторного создания.

### F-02 / PROJ-046: RESOLVED

До конвертации тест создаёт живое назначение, делает reload и подтверждает assignment плюс contribution в `resourceLoad` (`:305-320`). После reviewed milestone batch первый server readback подтверждает `durationMinutes=0`, `workMinutes=0`, `kind=milestone`, отсутствие assignment и отсутствие его resource-load contribution (`:341-355`).

После следующего `page.reload()` тест повторно получает server read model и повторяет все пять assertions (`:356-371`), затем дополнительно проверяет UI `0 дн` (`:372-374`). Полный zero-load invariant доказан после reload.

## Final Gate Matrix

| Check | Verdict | Evidence |
|---|---|---|
| F1 / PROJ-123 deterministic IDs | PASS | Stable IDs из project/fingerprint/index; E2E подтверждает no-duplicate readback. |
| F1 server replay after reload | PASS | Исходный batch envelope после reload возвращает прежний version; итог ровно 10 задач (`:160-179`). |
| F1 stale preview | PASS | Preview `409`, apply requests `0`, race rows `0` (`:180-209`). |
| F2 mixed compensation all-or-nothing | PASS | Domain/planning-client batch helpers требуют inverse для каждой команды; mixed test прошёл. |
| F2 irreversible batch no undo | PASS | Undo disabled; shortcut создаёт `0` preview requests (`:140-153`). |
| F3 / PROJ-046 after reload | PASS | Duration/work/kind и absence assignment/load повторно проверены после reload (`:356-371`). |
| PROJ-124 real pointer drag | PASS | Реальный `mouse.down -> hover -> mouse.up`, preview/apply/readback (`:211-235`). |
| PROJ-125 keyboard-only 10 rows/reload | PASS | Exact equality всех 10 post-reload IDs (`:264-268`). |

## Fresh Playwright Evidence

`.superloopy/evidence/projects-2026-07-10/schedule-productivity-playwright.json` распарсен напрямую:

- spec mtime: `2026-07-10 04:00:13 UTC`;
- run start: `2026-07-10 04:09:47 UTC`;
- artifact mtime: `2026-07-10 04:10:17 UTC`;
- `expected=4`, `unexpected=0`, `flaky=0`, `skipped=0`;
- все четыре spec: `ok=true`, status `passed`;
- keyboard/TSV/drag/undo: `22007 ms`;
- assigned milestone: `3882 ms`;
- responsive: `2103 ms`;
- PLAN no-writes: `1293 ms`.

Run начался после изменения E2E spec, поэтому результат относится к усиленной версии assertions.

## Commands And Artifacts Trusted

1. `codegraph sync` и CodeGraph status/context.
2. Targeted `rg` и line-numbered read текущего E2E.
3. PowerShell `ConvertFrom-Json` по свежему Playwright JSON.
4. `Get-Item` по spec/JSON/audit для проверки последовательности времени.
5. Результаты первого gate: focused tests `31/31`, DB gate `1/1` с `23 skipped`, typecheck domain/planning-client/api/web - passed.

## Residual Risk

Нового дефекта или обязательного evidence gap в заданном scope не найдено. JSON не содержит cryptographic source hash, но время запуска, имена spec и текущие assertions согласованы; run постдатирует spec.

## Change Index

- Updated: `.superloopy/evidence/projects-2026-07-10/qa-schedule-productivity-recheck.md`.
- Product/test/docs files changed by this recheck: none.
- Source symbols added/changed/removed by this recheck: none.
- CodeGraph before artifact update: `24,673` nodes / `52,730` edges. Final sync recorded after write.

SUPERLOOPY_AUDIT: .superloopy/evidence/projects-2026-07-10/qa-schedule-productivity-recheck.md