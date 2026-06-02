# KISS PM: матрица готовности экранов beta

Готовность экрана означает, что экран можно проверять как рабочую пользовательскую поверхность, а не как факт рендера.

## Гейт

Экран считается beta-ready только если:

1. У него есть понятная operational job и связанная user story.
2. Основные роли и permission/read-only поведение определены.
3. Экран использует runtime API/read-model данные без лишних каталогов и permission dependencies.
4. Все видимые enabled actions работают или явно отключены.
5. Есть loading, empty, error и forbidden/read-only состояния там, где они применимы.
6. Desktop и narrow layout не имеют горизонтального overflow, перекрытий текста и debug/admin dump композиции.
7. Есть свежий QA proof: тест, browser guard и screenshot evidence.

## Текущий автоматический baseline готовности

`pnpm qa:runtime` сейчас доказывает только foundation readiness:

| Screen | Route | Status in this gate | Automated proof | Artifacts |
| --- | --- | --- | --- | --- |
| Dashboard runtime root | `/` -> `/dashboard` | foundation smoke | `e2e/runtime/runtime-foundation.spec.ts` | `runtime-foundation-desktop.png`, `runtime-foundation-narrow.png` |
| Dashboard route | `/dashboard` | route smoke | `e2e/runtime/runtime-foundation.spec.ts` | `runtime-dashboard-desktop.png`, `runtime-dashboard-narrow.png` |
| My Work route | `/my-work` | route smoke | `e2e/runtime/runtime-foundation.spec.ts` | `runtime-my-work-desktop.png`, `runtime-my-work-narrow.png` |
| Agent cockpit route | `/agent` | route smoke + confirmation loop | `e2e/runtime/runtime-foundation.spec.ts`, `e2e/runtime/agent-confirmation.spec.ts` | `runtime-agent-desktop.png`, `runtime-agent-narrow.png`, `runtime-agent-confirmation-pending.png`, `runtime-agent-confirmation-applied.png` |
| Projects route | `/projects` | route smoke | `e2e/runtime/runtime-foundation.spec.ts` | `runtime-projects-desktop.png`, `runtime-projects-narrow.png` |
| Deals route | `/deals` | route smoke | `e2e/runtime/runtime-foundation.spec.ts` | `runtime-deals-desktop.png`, `runtime-deals-narrow.png` |
| Storybook tokens | `Foundations/Colors` | visual smoke only | `e2e/runtime/storybook-visual-smoke.spec.ts` | `tokens-desktop.png`, `tokens-narrow.png` |
| Storybook dashboard | `Screens/Дашборд` | visual smoke only | `e2e/runtime/storybook-visual-smoke.spec.ts` | `dashboard-desktop.png`, `dashboard-narrow.png` |
| Storybook agent cockpit | `Flows/Агент рабочей области` | visual smoke only | `e2e/runtime/storybook-visual-smoke.spec.ts` | `agent-cockpit-desktop.png`, `agent-cockpit-narrow.png` |
| Storybook deals | `Screens/Сделки` | visual smoke only | `e2e/runtime/storybook-visual-smoke.spec.ts` | `deals-desktop.png`, `deals-narrow.png` |
| Storybook settings | `Screens/Администрирование` / `Settings` | visual smoke only | `e2e/runtime/storybook-visual-smoke.spec.ts` | `settings-desktop.png`, `settings-narrow.png` |

## Известный разрыв

Этот gate не переводит перечисленные screens в полную beta-ready категорию. Он блокирует blank screen, browser runtime errors, unexpected failed runtime requests и отсутствие screenshot evidence. `/agent` дополнительно проверяет seeded confirmation loop: proposal не считается примененным до клика пользователя, а результат показывает audit marker и ссылку на созданную задачу.
