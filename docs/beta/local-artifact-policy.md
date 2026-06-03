# KISS PM: локальные артефакты и GitHub CI blocker

## Текущий blocker GitHub CI

На PR #73, #74 и #75 GitHub jobs не стартуют из-за billing/account state:

```txt
The job was not started because recent account payments have failed or your spending limit needs to be increased.
```

Это не означает runtime/test failure. До исправления billing красный GitHub CI не блокирует beta slices, если локальный эквивалент соответствующего gate зеленый и reviewer threads закрыты.

## Что считается доказательством для PR

В каждом PR нужно указывать:

- branch и head SHA;
- точные команды;
- pass/fail summary;
- что именно покрывает локальный gate;
- пути к Playwright artifacts, если запускался browser smoke;
- известные skipped checks и причину;
- reviewer decision по открытым code-review threads.

## Fast PR gate

Команда для малого beta PR:

```bash
pnpm qa:fast
```

Ограниченный маршрутный запуск:

```bash
pnpm qa:fast -- --routes=/dashboard,/my-work
```

Fast gate выполняет:

- проверку локального Postgres для runtime QA;
- миграции;
- beta seed;
- seed check;
- `pnpm typecheck`;
- `pnpm --filter @kiss-pm/api test`;
- `pnpm --filter @kiss-pm/web test`;
- Playwright smoke `e2e/runtime/runtime-foundation.spec.ts` только по beta runtime routes.

Fast gate не запускает Storybook/VRT/a11y. Эти проверки остаются для nightly/pre-beta gate и крупных UI slices.

## Full gate

Перед beta release или крупным UI/UX slice запускать отдельно:

```bash
pnpm qa:runtime
pnpm verify:storybook-contract
```

Если GitHub CI продолжает не стартовать из-за billing, решение о merge принимает владелец после локального green evidence и review acceptance.
