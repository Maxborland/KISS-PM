# KISS PM: гейт качества beta

Beta QA gate проверяет не только компиляцию, а минимальную пригодность runtime как продукта: приложение должно стартовать, открывать рабочий экран, не падать в браузере и оставлять артефакты, по которым можно увидеть реальный результат.

## Foundation runtime QA

Команда:

```bash
pnpm qa:runtime
```

Точный scope команды:

- выполняет `pnpm db:migrate`;
- выполняет `pnpm db:seed:dev`;
- запускает `scripts/run-runtime-qa.mjs`;
- внутри runner запускает только `pnpm exec playwright test --config playwright.config.ts e2e/runtime`;
- включает `KISS_PM_STORYBOOK_QA=1` только для этого runtime QA запуска.

## GitHub no-start / local SSSOT

Пока GitHub Runtime QA jobs падают без запуска runner-а (`steps: []`, billing/spending-limit), remote red считается infra-red, а не test failure. Для small beta PR source of truth — локальный релевантный gate:

- `pnpm qa:fast` для обычного PR-sized slice;
- targeted unit/API/web/e2e команда для узкого backend/frontend slice;
- `pnpm qa:runtime` или screenshot harness только когда slice меняет runtime route/screenshot acceptance.

PR body должен фиксировать branch/SHA, точные команды, pass/fail summary, skipped checks и Playwright artifact paths, если они создавались. Code-review blockers остаются blockers независимо от локального green.

## Fast PR gate

Команда:

```bash
pnpm qa:fast
```

Ограниченный route set для маленького PR:

```bash
pnpm qa:fast -- --routes=/dashboard,/my-work
```

Fast gate нужен для PR-sized beta slices, когда полный Storybook/VRT gate слишком тяжелый. Он выполняет локальный CI-эквивалент без Storybook:

- `node scripts/check-runtime-qa-db.mjs`;
- `pnpm db:migrate`;
- `pnpm db:seed:dev`;
- `pnpm db:seed:check`;
- `pnpm typecheck`;
- `pnpm --filter @kiss-pm/api test`;
- `pnpm --filter @kiss-pm/web test`;
- `pnpm exec playwright test --config playwright.config.ts e2e/runtime/runtime-foundation.spec.ts --grep @fast-pr-gate`.

Route selection передается через `KISS_PM_FAST_ROUTES`; по умолчанию smoke открывает `/dashboard`, `/my-work`, `/agent`, `/projects`, `/projects/project-beta-school-renovation`, `/deals`.

`e2e/runtime/**` сейчас покрывает foundation, а не весь beta regression:

- `e2e/runtime/runtimeQaFixtures.ts` включает guard на неожиданные `pageerror`, `console.error`, failed `document/script/fetch/xhr` requests и 4xx/5xx responses;
- `e2e/runtime/runtime-foundation.spec.ts` логинится seeded admin пользователем, открывает runtime root, проверяет redirect на `/dashboard`, делает desktop и narrow screenshots;
- `e2e/runtime/runtime-foundation.spec.ts` также открывает `/dashboard`, `/my-work`, `/agent`, `/projects`, `/projects/project-beta-school-renovation`, `/deals` и проверяет, что route не blank, не forbidden/error и не даёт горизонтальный overflow на desktop/narrow;
- `e2e/runtime/project-detail-task-actions.spec.ts` проверяет project detail task status action: статус seeded задачи меняется через UI и сохраняется после reload;
- `e2e/runtime/agent-confirmation.spec.ts` проверяет безопасный цикл агента: сообщение пользователя, proposal без silent mutation, явное `Применить`, result summary, audit marker и переход к созданной задаче в `/my-work`;
- `e2e/runtime/storybook-visual-smoke.spec.ts` запускается только при `KISS_PM_STORYBOOK_QA=1`, открывает стабильные Storybook stories через `iframe.html?id=...` и снимает desktop/narrow screenshots approved design-v3 stories.

## Runtime-артефакты

Локально и в CI Playwright пишет evidence в:

- `test-results/`;
- `playwright-report/`.

Команда `pnpm qa:screenshots -- --routes beta` запускает screenshot smoke по полному beta route set и пишет manifest:

- `test-results/beta-runtime-screenshots-manifest.json`.

Manifest содержит route, viewport, marker, screenshot path, file size и `allPass`. Он не коммитится, а служит локальным/CI evidence artifact.

Ожидаемые screenshot artifacts внутри Playwright output:

- `runtime-foundation-desktop.png`;
- `runtime-foundation-narrow.png`;
- `runtime-dashboard-desktop.png`;
- `runtime-dashboard-narrow.png`;
- `runtime-my-work-desktop.png`;
- `runtime-my-work-narrow.png`;
- `runtime-agent-desktop.png`;
- `runtime-agent-narrow.png`;
- `runtime-agent-confirmation-pending.png`;
- `runtime-agent-confirmation-applied.png`;
- `runtime-projects-desktop.png`;
- `runtime-projects-narrow.png`;
- `runtime-projects-project-beta-school-renovation-desktop.png`;
- `runtime-projects-project-beta-school-renovation-narrow.png`;
- `runtime-project-detail-task-status-changed.png`;
- `runtime-deals-desktop.png`;
- `runtime-deals-narrow.png`;
- `tokens-desktop.png`;
- `tokens-narrow.png`;
- `agent-cockpit-desktop.png`;
- `agent-cockpit-narrow.png`;
- `deals-desktop.png`;
- `deals-narrow.png`;
- `settings-desktop.png`;
- `settings-narrow.png`.

CI workflow `.github/workflows/runtime-qa.yml` загружает `playwright-report/` и `test-results/` как artifact `runtime-qa-playwright-artifacts`.

## Не входит в этот slice

- `e2e/a11y/**` не входит в `pnpm qa:runtime`.
- RBAC mutation journeys и расширенные бизнес-flow acceptance не считаются покрытыми этим foundation.
- Runtime UI code, backend code, lockfile, marketing и storage не меняются этим gate.
- Agent confirmation loop покрыт на уровне seeded admin runtime flow: apply требует явного клика, а результат показывает audit marker и ссылку на созданную задачу.

## Ожидание перед PR

Перед PR для этого slice нужны свежие команды:

```bash
pnpm exec playwright test --list --config playwright.config.ts e2e/runtime
pnpm exec playwright test --config playwright.config.ts e2e/runtime/runtime-foundation.spec.ts
pnpm qa:runtime
pnpm typecheck
git diff --check
```
