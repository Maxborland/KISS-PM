# Маркетинговые документы

## Назначение

Эта папка — canonical source для маркетинга KISS PM. Root README и продуктовые docs не являются источником лендингового copy.

Для центрального демо при конфликте с `03` действует `08`: пустой фон, большое окно, без соседних CTA/copy.

Главный direction:

> пользователь формулирует цель, Генри Гантт готовит Сверку изменений, человек ревьюит и применяет выбранное, система сохраняет запись в журнале.

## Главная ставка

KISS PM не позиционируется как "дашборд + AI-чат". Главная ценность — контролируемое изменение проекта через агента, Сверку, ревью человеком и журнал.

Главный продуктовый цикл:

```txt
Цель -> запуск агента -> proposed project diff -> ревью -> применение -> аудит
```

## Документы

1. [`01_POSITIONING_AND_MARKET.md`](01_POSITIONING_AND_MARKET.md) - рыночная карта, competitive gap и итоговая позиция.
2. [`02_MESSAGING_AND_TONE_OF_VOICE.md`](02_MESSAGING_AND_TONE_OF_VOICE.md) - message house, язык, запреты и библиотека сообщений.
3. [`03_LANDING_PAGE_STRUCTURE.md`](03_LANDING_PAGE_STRUCTURE.md) - рекомендуемая структура лендинга закрытой альфы.
4. [`04_CRO_AND_ALPHA_FORM.md`](04_CRO_AND_ALPHA_FORM.md) - конверсия, призывы к действию, форма, тесты и вопросы доверия.
5. [`05_CONTENT_SEO_AND_AI_DISCOVERY.md`](05_CONTENT_SEO_AND_AI_DISCOVERY.md) - контент-стратегия, SEO-кластеры и AI discovery.
6. [`06_GO_TO_MARKET_IDEAS.md`](06_GO_TO_MARKET_IDEAS.md) - первые GTM-эксперименты и outreach.
7. [`07_PRICING_AND_PACKAGING_HYPOTHESES.md`](07_PRICING_AND_PACKAGING_HYPOTHESES.md) - исследование цены и будущая упаковка.
8. [`08_INTERACTIVE_LANDING_DEMO_SPEC.md`](08_INTERACTIVE_LANDING_DEMO_SPEC.md) - отдельная спецификация минималистичного интерактивного демо с Генри Ганттом, Сверкой и Storybook-состояниями.

## Как пользоваться

- Для лендинга начинать с `03_LANDING_PAGE_STRUCTURE.md`, затем сверять тексты с `02_MESSAGING_AND_TONE_OF_VOICE.md` и `04_CRO_AND_ALPHA_FORM.md`.
- Для любых новых маркетинговых материалов начинать с `.agents/product-marketing.md`.
- Для контента и SEO использовать `05_CONTENT_SEO_AND_AI_DISCOVERY.md`.
- Для альфы, outreach и первых экспериментов использовать `06_GO_TO_MARKET_IDEAS.md`.

## Правила

1. Главный интерфейс KISS PM в маркетинге - проектный агент и review/apply workflow.
2. Proposed project diff является ключевым trust-механизмом, а не декоративной метафорой.
3. Портфель, ресурсы, KPI, Gantt и задачи описывать как контекстные поверхности вокруг агентного цикла.
4. Все публичные claims держать на уровне закрытой альфы: без ROI, production SLA, логотипов и "автономного PM", пока нет доказательств.
5. Тексты пишутся по-русски. Английские термины допустимы для стратегии и устойчивых рыночных понятий: `project diff`, `hunk`, `audit trail`, `self-hosted`, `Gantt`. В UI писать `Сверка`, не `diff`.
6. Главный призыв лендинга закрытой альфы: `Запросить доступ`.
