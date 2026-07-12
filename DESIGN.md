# DESIGN.md — дизайн-авторитет KISS PM

Единственный нормативный вход в визуальную систему. Значения токенов физически живут в
[`apps/web/src/styles/tokens.css`](apps/web/src/styles/tokens.css) (+
[`tokens.planning.css`](apps/web/src/styles/tokens.planning.css) — геометрия планирования);
этот документ фиксирует контракт, роли файлов и правила, а не дублирует все значения.
Конфликт между документами решается так: **код токенов → DESIGN.md → остальные доки**.
Историческая сверка: `docs/design-v3/TOKENS.md`; enforceable-детали копирайтинга и
компонентов: `docs/design-v3/DESIGN_CONTRACT.md`.

## 1. Атмосфера / подпись

**KISS Operational**: тихий плотный операционный интерфейс. Иерархия — типографикой,
выравниванием и границами, не тенями и не цветом. Цвет сообщает действие, предложение
и реальный семантический статус. Фирменная грамматика продукта — **KISS Delta**:
`текущее → предложение → последствия → риск/согласование → применение/аудит`.
Последовательность и есть бренд; интерфейс никогда не изображает данные, которых нет
(никакой fake-геометрии предложений, никаких выдуманных счётчиков).

Циферблаты направления: `DESIGN_VARIANCE 4/10 · MOTION_INTENSITY 5/10 · VISUAL_DENSITY 9/10`.

## 2. Владение и каскад (роли файлов)

```txt
DESIGN.md (контракт)
└─ apps/web/src/styles/tokens.css          ← ЕДИНСТВЕННЫЙ владелец :root-переменных
   apps/web/src/styles/tokens.planning.css ← геометрия Gantt/WBS/Inspector (тот же слой, позже)
   apps/web/src/app/globals.css            ← слои, @theme-мост, base, motion-примитивы,
                                              минимальная dark-карта [data-theme="dark"] (unlayered)
   apps/web/src/styles/kiss-v4.css         ← только утилиты (v4-mono/num/row, msgrid, gantt-bar, v4-split)
   apps/web/src/styles/{bem,bem-supplement}.css ← ЗАМОРОЖЕНЫ (ratchet: новые классы запрещены)
   apps/web/src/styles/widgets/*.css       ← существующие острова; новые не создаются
   apps/web/src/components/{ui,domain}     ← единственный форвард-путь для новых компонентов
```

Правила каскада, которые нельзя нарушать:

- `@layer reset, tokens, base, components, utilities;` — первая строка globals.css, не переставлять.
- `@plugin "tailwindcss-animate"` — строго ПОСЛЕ всех `@import` (иначе поздние импорты молча выпадают).
- Новые `:root`-блоки вне `styles/tokens*.css` запрещены (гейт).
- Tailwind `@theme` эмитит собственные `--text-*/--radius-*/--shadow-*` ПОСЛЕ utilities —
  известная мина: не полагаться на одноимённые токены в Tailwind-утилитах, размер задавать
  `text-[length:var(--text-*)]`.

## 3. Цвет

Полный набор — в tokens.css. Ключевая семантика (hex приведены как справка, источник — файл):

| Роль | Токен | Значение |
|---|---|---|
| Фон приложения | `--canvas` | `#f7f8fa` |
| Панель/карточка | `--panel` | `#ffffff` |
| Границы | `--border` | `#ececf1` |
| Текст | `--text` / `--text-strong` | `#1c2024` / `#0c0d10` |
| Вторичный текст | `--muted` | `#6a7280` |
| Акцент (индиго, точечно) | `--accent` | `#5b5bd6` |
| Успех / риск / опасность | `--success` / `--warning` / `--danger` | `#30a46c` / `#e08c2c` / `#e5484d` |

Do / Don't:

- **Don't**: raw hex/rgba в TSX и новых CSS (гейты); «AI-purple» градиенты; декоративные
  градиенты вообще (`--grad-warm/cool = var(--panel)` — выключены сознательно).
- **Do**: новый цвет = сначала токен в tokens.css (с ролью), потом использование.
- Акцент — для ссылок/активного/фокуса; primary-кнопки — тёмный neutral.
- Цвет никогда не единственный носитель статуса (плюс текст/иконка).

Dark: минимальная карта поверхностей/текста в globals.css (`[data-theme="dark"]`, unlayered —
намеренно бьёт слои). Полная семантическая dark-карта — отдельная работа (PR11);
до неё новые поверхности обязаны выглядеть корректно в обеих темах на существующих 14 токенах.
Механизм темы: `data-theme` от ProfileThemeSync; next-themes оставлен ТОЛЬКО ради
`components/ui/sonner.tsx` — консолидация в PR11, новые консьюмеры next-themes запрещены.

## 4. Типографика

Стек: `--font-ui` (Inter via next/font) · `--font-display` (Plus Jakarta Sans, только h1–h3) ·
`--font-mono` (JetBrains Mono — коды/числа/даты). Шкала: `--text-2xs 10 · xs 11 · sm 12 ·
base/md 14 · h3 18 · h2 24 · h1 32` (+ display-точные 15/19/22/28).

- Размер в TSX: только `text-[length:var(--text-*)]` (raw `text-[Npx]` — гейт).
- 10–12px допустимы только для технических осей/метаданных (оси Gantt, `.msgrid td`,
  th-подписи) — задокументированные исключения в ratchet-гейте; пользовательские решения
  и последствия — не мельче 14px.
- Числа в данных: `tabular-nums` (`.v4-num`/`.v4-mono`), выравнивание вправо.

## 5. Spacing, плотность, компоненты

- База 4px: `--space-1..12`; margin/padding/gap — только шкалой.
- Плотность высокая: `--row-h: 36px` (грид и матрица — одинаковая), разделители-линии
  вместо «карточки на каждый модуль»; bento-число ячеек = числу элементов.
- Новые компоненты: `components/ui` (примитивы shadcn) → `components/domain` (композиты).
  Каждый компонент: hover/active/focus/disabled + empty/loading/error состояния явно.
- Радиусы: шкала `--radius-*`; карточки — `--radius-card: 14px`. Один corner-scale на всё.

## 6. Motion

- Длительности/изинги: `--duration-fast 120 · base 200 · slow 320` + `--ease-*`. Новых не вводить.
- Только transform/opacity/filter; layout-свойства не анимируются.
- Motion объясняет причину/следствие (применение предложения, смена состояния), не украшает
  hover. Один лифт — `.hover-lift` (тень `--shadow-lift`); `v4-lift`/`v4-pop` удалены.
- reduced-motion: обязательный гард для ЛЮБОЙ новой анимации (паттерн — globals.css;
  Storybook-витрина форсит motion через `data-force-motion`). Известный долг: анимации
  tailwindcss-animate (Radix-оверлеи) и widget-CSS без гарда — закрывается в PR11.

## 7. Глубина

Стратегия: границы + тональные сдвиги; тени только у оверлеев, плавающих инспекторов
и активного drag. Лестница: `--shadow-card` (карточка) → `--shadow-raise` (hover-подъём) →
`--shadow-pop` (поповер/меню) → `--shadow-panel/xl` (модальные). Не смешивать с рамками
двойного веса; не изобретать новые тени вне шкалы.

## QA-гейты (когда работа считается сделанной)

1. `apps/web/src/__health__/design-v3-enforcement.health.test.ts` — зелёный
   (raw px/hex в TSX; :root-владение; hex/10-12px/BEM ratchet по CSS). В CI дважды.
2. `pnpm verify:storybook-contract` — русские тайтлы stories (copy-scan идёт по nav-дереву).
3. Для видимых изменений UI — real-browser визуальная QA: скриншоты 390/768/1280,
   normal + reduced-motion, light + dark; артефакт в `.superloopy/evidence/frontend/`.
4. Изменение значений токенов = отдельный PR с parity-отчётом (какая переменная,
   до/после, скриншоты затронутых поверхностей).
