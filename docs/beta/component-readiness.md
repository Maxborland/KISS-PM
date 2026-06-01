# KISS PM: готовность компонентов beta

Storybook component считается пригодным для runtime только после проверки назначения, data shape, interaction contract и визуального evidence. Наличие story само по себе не означает approval.

## Гейт компонента

Компонент можно использовать как beta-approved, если:

- он решает конкретную operational job, а не декоративную demo задачу;
- props соответствуют runtime data contract;
- enabled controls имеют callback, mutation path или controlled state;
- empty/loading/error/forbidden состояния предусмотрены там, где нужны;
- desktop и narrow screenshots стабильны;
- компонент не показывает debug artifacts: UUID-first labels, API headings, internal status names, test/demo records.

## Текущее runtime QA evidence

`e2e/runtime/storybook-visual-smoke.spec.ts` проверяет только visual smoke для стабильных design-v3 stories:

| Component/surface family | Storybook target | Evidence artifacts | Status |
| --- | --- | --- | --- |
| Design tokens | `Foundations/Colors` / `Palette` | `tokens-desktop.png`, `tokens-narrow.png` | visual-smoke |
| Dashboard surface | `Screens/Дашборд` / `Dashboard` | `dashboard-desktop.png`, `dashboard-narrow.png` | visual-smoke |
| Deals surface | `Screens/Сделки` / `Deals` | `deals-desktop.png`, `deals-narrow.png` | visual-smoke |
| Settings surface | `Screens/Администрирование` / `Settings` | `settings-desktop.png`, `settings-narrow.png` | visual-smoke |

`visual-smoke` означает: story рендерится, содержит русский UI copy и даёт screenshot artifact. Это не заменяет runtime action tests и не является full beta approval.

## Правило scope

`pnpm qa:runtime` не запускает весь Storybook contract gate. Для полного component contract остается отдельная команда:

```bash
pnpm verify:storybook-contract
```
