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

`e2e/runtime/**` сейчас покрывает foundation, а не весь beta regression:

- `e2e/runtime/runtimeQaFixtures.ts` включает guard на неожиданные `pageerror`, `console.error`, failed `document/script/fetch/xhr` requests и 4xx/5xx responses;
- `e2e/runtime/runtime-foundation.spec.ts` логинится seeded admin пользователем, открывает runtime root, проверяет redirect на `/dashboard`, делает desktop и narrow screenshots;
- `e2e/runtime/runtime-foundation.spec.ts` также открывает `/dashboard`, `/my-work`, `/agent`, `/projects`, `/deals` и проверяет, что route не blank, не forbidden/error и не даёт горизонтальный overflow на desktop/narrow;
- `e2e/runtime/storybook-visual-smoke.spec.ts` запускается только при `KISS_PM_STORYBOOK_QA=1`, открывает стабильные Storybook stories через `iframe.html?id=...` и снимает desktop/narrow screenshots approved design-v3 stories.

## Runtime-артефакты

Локально и в CI Playwright пишет evidence в:

- `test-results/`;
- `playwright-report/`.

Ожидаемые screenshot artifacts внутри Playwright output:

- `runtime-foundation-desktop.png`;
- `runtime-foundation-narrow.png`;
- `runtime-dashboard-desktop.png`;
- `runtime-dashboard-narrow.png`;
- `runtime-my-work-desktop.png`;
- `runtime-my-work-narrow.png`;
- `runtime-agent-desktop.png`;
- `runtime-agent-narrow.png`;
- `runtime-projects-desktop.png`;
- `runtime-projects-narrow.png`;
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
- Бизнес-flow acceptance, RBAC mutation journeys и agent confirmation loop не считаются покрытыми этим foundation.
- Runtime UI code, backend code, lockfile, marketing и storage не меняются этим gate.
- Agent confirmation loop acceptance, RBAC mutation journeys и audit assertions остаются отдельным beta gate поверх foundation smoke.

## Ожидание перед PR

Перед PR для этого slice нужны свежие команды:

```bash
pnpm exec playwright test --list --config playwright.config.ts e2e/runtime
pnpm exec playwright test --config playwright.config.ts e2e/runtime/runtime-foundation.spec.ts
pnpm qa:runtime
pnpm typecheck
git diff --check
```
