# Design v3 — shadcn Variants Override

Спецификация переопределения CVA-variants shadcn-компонентов под BEM-визуал
KISS PM. Применяется в **Phase 2** сразу после `pnpm dlx shadcn@latest add <component>`.

## Контекст

- `components.json` содержит `"cssVariables": false` (Решение №3).
- shadcn использует Tailwind utility classes напрямую: `bg-primary`, `text-foreground`, `border`, etc.
- Tailwind v4 `@theme inline` в `app/globals.css` мапит наши BEM-токены → Tailwind theme keys.
- Для большинства компонентов этого достаточно: shadcn → Tailwind → наши токены.
- **Override нужен** только там, где у нас есть **специальная BEM-стилистика** в `bem.css` (interactive states, специфичные spacings, кастомные тени, indicator dots).

## Правило override

1. После `pnpm dlx shadcn@latest add button` копируем content в `apps/web/src/components/ui/button.tsx`.
2. Сравниваем default variants с разделом ниже.
3. Если variant в этом документе отмечен — переписываем CVA-config.
4. **Не меняем структуру** (Radix wrapping, asChild prop, ref forwarding).
5. **Не меняем API** (variant/size names стабильны для будущих экранов).

## Компоненты

### Button

**Default shadcn variants:** `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`.

**Override:** добавить `accent` variant (для primary CTA), переименовать `default` → `primary` (keep alias).

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-[var(--text-base)] font-medium transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-[var(--accent)]",
        accent: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-[var(--accent)]", // alias
        secondary: "bg-[var(--panel)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--panel-strong)]",
        ghost: "text-[var(--muted-strong)] hover:bg-[var(--panel-strong)] hover:text-[var(--text)]",
        outline: "border border-[var(--border-strong)] bg-transparent text-[var(--text)] hover:bg-[var(--panel-strong)]",
        destructive: "bg-[var(--danger)] text-white hover:bg-[var(--danger-text)] border border-[var(--danger)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline"
      },
      size: {
        sm: "h-[30px] px-[10px] text-[var(--text-xs)]",
        md: "h-[var(--row-h)] px-[14px]",
        lg: "h-[40px] px-[18px] text-[var(--text-sm)] rounded-[var(--radius-lg)]",
        icon: "h-[var(--row-h)] w-[var(--row-h)] p-0"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);
```

**Источник стилистики:** `_partials-core.css` `.btn`, `.btn--primary`, `.btn--accent`, `.btn--secondary`, `.btn--ghost`, `.btn--sm`, `.btn--lg`.

### Dialog

**Override:** контент-обёртка использует `var(--shadow-xl)` + `var(--radius-2xl)`, размеры через `--modal-sm/md/lg` токены.

```tsx
// DialogContent className override:
"fixed left-[50%] top-[50%] z-[var(--z-modal)] grid w-full max-w-[var(--modal-md)] translate-x-[-50%] translate-y-[-50%] gap-[var(--space-4)] border border-[var(--border)] bg-[var(--panel-elevated)] p-[var(--space-6)] shadow-[var(--shadow-xl)] rounded-[var(--radius-2xl)] data-[state=open]:animate-in data-[state=closed]:animate-out duration-[var(--duration-base)]"
```

Размер через prop `size?: "sm" | "md" | "lg"` → `max-w-[var(--modal-sm/md/lg)]`.

Overlay: `bg-[rgba(15,23,42,0.4)]` с blur backdrop.

### Sheet (drawer)

**Override:** правый sheet использует `--inspector-width: 380px`. Вертикальный sheet (top/bottom) использует `--canvas-pad`. z-index `var(--z-drawer)`.

```tsx
// side: "right" content className:
"fixed inset-y-0 right-0 h-full w-[var(--inspector-width)] z-[var(--z-drawer)] bg-[var(--panel-elevated)] border-l border-[var(--border)] shadow-[var(--shadow-xl)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-[var(--duration-base)]"
```

### Tabs

**Override:** горизонтальный tabbar с подчёркиванием снизу, `var(--tabs-height)` для контейнера в проекте.

```tsx
// TabsList:
"inline-flex h-[var(--tabs-height)] items-center justify-start border-b border-[var(--border)] bg-transparent p-0 gap-0"

// TabsTrigger:
"inline-flex items-center justify-center whitespace-nowrap px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-sm)] font-medium text-[var(--muted-strong)] border-b-2 border-transparent transition-colors duration-[var(--duration-fast)] hover:text-[var(--text)] data-[state=active]:text-[var(--accent)] data-[state=active]:border-[var(--accent)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
```

**Variant `vertical`** (для settings-tabs / inspector-tabs) — добавляется как новый sub-component:

```tsx
// TabsList variant=vertical:
"inline-flex flex-col h-auto items-stretch border-r border-[var(--border)] gap-[var(--space-1)] p-[var(--space-2)] w-[200px]"
```

### Popover

**Override:** content background + shadow + radius.

```tsx
// PopoverContent:
"z-[var(--z-dropdown)] w-72 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-elevated)] p-[var(--space-3)] shadow-[var(--shadow-md)] data-[state=open]:animate-in data-[state=closed]:animate-out duration-[var(--duration-fast)]"
```

### DropdownMenu

**Override:** items с hint (есть в design-v2 `_partials-core.css` для UserMenu).

```tsx
// DropdownMenuContent:
"z-[var(--z-dropdown)] min-w-[10rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-elevated)] p-[var(--space-1)] shadow-[var(--shadow-md)]"

// DropdownMenuItem:
"relative flex cursor-default select-none items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] text-[var(--text)] outline-none transition-colors data-[highlighted]:bg-[var(--panel-strong)] data-[highlighted]:text-[var(--text-strong)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
```

**Кастомное расширение:** `<DropdownMenuItem hint="⌘K">Открыть палитру</DropdownMenuItem>` — text справа в `.dm-hint` (BEM, см. `_partials-core.css`).

### ContextMenu (новый в v3 — был пропущен в v1)

Тот же дизайн что и DropdownMenu, переиспользуем те же CVA classes. Используется в `WbsContextMenu` (правый клик по строке WBS-grid).

### Tooltip

**Override:** мелкий dark-on-light, fast.

```tsx
// TooltipContent:
"z-[var(--z-dropdown)] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--text-strong)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--text-xs)] text-white shadow-[var(--shadow-sm)] animate-in fade-in-0 zoom-in-95 duration-[var(--duration-fast)]"
```

`delayDuration` = 300ms по умолчанию (set в `<TooltipProvider>` в `providers.tsx`).

### Toast (Sonner)

**Override:** через `<Toaster />` props, не через CVA. Стилизация через `toastOptions.classNames`:

```tsx
<Toaster
  position="bottom-right"
  toastOptions={{
    classNames: {
      toast: "!bg-[var(--panel-elevated)] !text-[var(--text)] !border-[var(--border)] !shadow-[var(--shadow-lg)] !rounded-[var(--radius-md)]",
      title: "!font-semibold !text-[var(--text)]",
      description: "!text-[var(--muted)] !text-[var(--text-sm)]",
      success: "!border-[var(--success)]",
      error: "!border-[var(--danger)]",
      warning: "!border-[var(--warning)]",
      info: "!border-[var(--info)]"
    }
  }}
/>
```

`!` важен — sonner ставит inline classes выше layer-порядка.

### Skeleton

**Override:** наши пульсации с `var(--panel-strong)` базой.

```tsx
// Skeleton:
"animate-pulse rounded-[var(--radius-sm)] bg-[var(--panel-strong)]"
```

Phase 2 добавляет утилитарные варианты: `<Skeleton variant="text" />`, `<Skeleton variant="avatar" />`, `<Skeleton variant="row" />`.

### Input / Textarea / Select trigger

**Override:** одинаковая базовая стилистика.

```tsx
// Input:
"flex h-[var(--row-h)] w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--panel)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-base)] text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:shadow-[var(--ring-focus)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-[var(--duration-fast)]"
```

Textarea: то же + `min-h-[80px] resize-vertical`.

Select trigger: то же + `gap-2 justify-between`.

### Card

**Override:** `var(--shadow-sm)` + `var(--radius-lg)` + `var(--panel)`. Никаких inset shadow.

```tsx
// Card:
"rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]"

// CardHeader: "flex flex-col space-y-[var(--space-2)] p-[var(--space-5)]"
// CardTitle: "text-[var(--text-lg)] font-semibold leading-none tracking-tight"
// CardDescription: "text-[var(--text-sm)] text-[var(--muted)]"
// CardContent: "p-[var(--space-5)] pt-0"
// CardFooter: "flex items-center p-[var(--space-5)] pt-0"
```

### Avatar

**Override:** круглый с `var(--radius-full)`, fallback с цветом из позиции в строке (через имя — hash).

```tsx
// Avatar:
"relative flex h-[32px] w-[32px] shrink-0 overflow-hidden rounded-[var(--radius-full)]"

// AvatarFallback:
"flex h-full w-full items-center justify-center rounded-[var(--radius-full)] bg-[var(--panel-strong)] text-[var(--text-sm)] font-medium text-[var(--muted-strong)]"
```

**Размеры:** prop `size?: "sm" | "md" | "lg"` → 24/32/40px (стандарт `_partials-core.css` `.avatar`).

### Badge

**Override:** наши priority/status chips с soft backgrounds.

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-full)] border px-[var(--space-2)] py-[2px] text-[var(--text-xs)] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-[var(--border-strong)] bg-[var(--panel-strong)] text-[var(--muted-strong)]",
        success: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success-text)]",
        warning: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)]",
        danger: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]",
        info: "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]",
        violet: "border-[var(--violet)] bg-[var(--violet-soft)] text-[var(--violet)]",
        accent: "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
      }
    },
    defaultVariants: { variant: "default" }
  }
);
```

### Separator

**Override:** `var(--border)`.

```tsx
"shrink-0 bg-[var(--border)] data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px"
```

### Scroll-area

**Override:** thin scrollbar в `--muted-soft`, без видимого track.

```tsx
// Scrollbar:
"flex touch-none select-none transition-colors data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-l-transparent data-[orientation=vertical]:p-[1px] data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:flex-col"

// Thumb:
"relative flex-1 rounded-[var(--radius-full)] bg-[var(--muted-soft)] hover:bg-[var(--muted)]"
```

### Alert

**Override:** наш `banner-inline` стиль (см. также custom `<BannerInline>`).

```tsx
const alertVariants = cva(
  "relative w-full rounded-[var(--radius-md)] border p-[var(--space-4)] [&>svg~*]:pl-[var(--space-7)] [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-[var(--space-4)] [&>svg]:top-[var(--space-4)]",
  {
    variants: {
      variant: {
        default: "bg-[var(--panel)] text-[var(--text)] border-[var(--border)]",
        info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]",
        warning: "bg-[var(--warning-soft)] text-[var(--warning-text)] border-[var(--warning)]",
        danger: "bg-[var(--danger-soft)] text-[var(--danger-text)] border-[var(--danger)]"
      }
    },
    defaultVariants: { variant: "default" }
  }
);
```

### Form (react-hook-form integration)

**Override:** label / message / description spacing.

```tsx
// FormItem: "space-y-[var(--space-2)]"
// FormLabel: "text-[var(--text-sm)] font-medium text-[var(--text)]"
// FormDescription: "text-[var(--text-xs)] text-[var(--muted)]"
// FormMessage: "text-[var(--text-xs)] font-medium text-[var(--danger)]"
```

### Pagination

**Override:** только цвета и размеры — структура из shadcn остаётся.

```tsx
// PaginationLink (active):
"data-[active=true]:bg-[var(--accent)] data-[active=true]:text-white data-[active=true]:border-[var(--accent)]"
```

### Breadcrumb

**Override:** разделитель через `crumb-sep` BEM-класс (chevron icon).

```tsx
// BreadcrumbList:
"flex flex-wrap items-center gap-[var(--space-2)] text-[var(--text-sm)] text-[var(--muted)]"

// BreadcrumbLink: "transition-colors hover:text-[var(--text)]"
// BreadcrumbPage: "font-medium text-[var(--text)]"
// BreadcrumbSeparator: "text-[var(--muted-soft)]"
```

### Command (cmdk)

**Override:** соответствует Combobox UX.

```tsx
// Command (root):
"flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-md)] bg-[var(--panel-elevated)] text-[var(--text)]"

// CommandInput wrapper:
"flex items-center border-b border-[var(--border)] px-[var(--space-3)]"

// CommandInput:
"flex h-[40px] w-full bg-transparent py-[var(--space-3)] text-[var(--text-base)] outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"

// CommandList:
"max-h-[300px] overflow-y-auto overflow-x-hidden"

// CommandItem:
"relative flex cursor-default select-none items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none data-[selected=true]:bg-[var(--panel-strong)] data-[selected=true]:text-[var(--text-strong)] data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"

// CommandEmpty:
"py-[var(--space-6)] text-center text-[var(--text-sm)] text-[var(--muted)]"
```

### Switch

**Override:** наш фирменный синий active.

```tsx
// Switch root:
"peer inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center rounded-[var(--radius-full)] border-2 border-transparent transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--accent)] data-[state=unchecked]:bg-[var(--border-strong)]"

// SwitchThumb:
"pointer-events-none block h-[16px] w-[16px] rounded-[var(--radius-full)] bg-white shadow-[var(--shadow-xs)] ring-0 transition-transform data-[state=checked]:translate-x-[16px] data-[state=unchecked]:translate-x-0"
```

### Checkbox / RadioGroup

**Override:** accent-color + border.

```tsx
// Checkbox:
"peer h-[16px] w-[16px] shrink-0 rounded-[var(--radius-xs)] border border-[var(--border-strong)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:text-white"
```

### Table (через @tanstack/react-table)

**Override:** наш zebra + hover + sticky-header.

```tsx
// Table: "w-full caption-bottom text-[var(--text-sm)]"
// TableHeader: "[&_tr]:border-b sticky top-0 bg-[var(--panel)] z-[var(--z-sticky)]"
// TableRow: "border-b border-[var(--border)] transition-colors hover:bg-[var(--panel-strong)] data-[state=selected]:bg-[var(--accent-soft)]"
// TableHead: "h-[var(--row-h)] px-[var(--space-3)] text-left align-middle font-medium text-[var(--muted-strong)] [&:has([role=checkbox])]:pr-0"
// TableCell: "px-[var(--space-3)] py-[var(--space-2)] align-middle [&:has([role=checkbox])]:pr-0"
```

### Label

**Override:** базовый, без сюрпризов.

```tsx
"text-[var(--text-sm)] font-medium leading-none text-[var(--text)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
```

### Slider / Progress / Toggle / ToggleGroup / RadioGroup / Accordion / Collapsible

Default shadcn-стилистика _почти подходит_. Override только `var(--accent)` для активного состояния, `var(--border)` для трэков, `var(--radius-md)`. Конкретные tweaks делаются по факту в Phase 2 при добавлении.

## Custom компоненты (написаны с нуля в Phase 2, не shadcn)

| Компонент | Зачем |
|---|---|
| `chip.tsx` | Color variants для priority/status, нет в shadcn |
| `combobox.tsx` | Popover + Command комбо для длинных списков (Решение №9) |
| `date-input.tsx` | react-day-picker + Popover, BEM-styled через `.date-input` |
| `icon-button.tsx` | BEM `.icon-btn` визуал (32px square, hover bg) |
| `kbd.tsx` | BEM `.kbd` (тонкий border + monospace) |
| `page-intro.tsx` | title + hint pattern (используется на каждом списке) |
| `search-pill.tsx` | Input с иконкой и kbd (⌘K) — BEM `.search-pill` |
| `segmented.tsx` | Radio-like tab control (List/Kanban switcher) |
| `empty-state.tsx` | BEM `.state-empty` |
| `illu-state.tsx` | BEM `.state-illu` с art/deco/icon |
| `error-state.tsx` | BEM `.state-error` |
| `forbidden-state.tsx` | BEM `.state-forbidden` |
| `loading-state.tsx` | BEM `.state-loading` |
| `command-dialog.tsx` | Dialog + cmdk wrapper (primitive, без routes) |
| `banner-inline.tsx` | BEM `.banner-inline` с info/warn/danger variants — для ui-only-preview флага |

## Чеклист для каждого shadcn компонента в Phase 2

- [ ] `pnpm dlx shadcn@latest add <component>` (с `cssVariables: false` уже в config)
- [ ] Открыть `apps/web/src/components/ui/<component>.tsx`
- [ ] Сравнить variants/sizes с этим документом
- [ ] Заменить любой `bg-primary` / `text-foreground` через CSS-переменные `var(--...)` где BEM-стилистика отличается от Tailwind theme
- [ ] Добавить `.stories.tsx` в той же папке (один story-файл на компонент, все variants/sizes)
- [ ] Запустить `pnpm storybook` и пройтись по a11y addon — zero violations
- [ ] Импортировать в одном dummy-screen-е (на этапе Phase 2 это `app/(dev)/playground/page.tsx`) для smoke

## Ссылки

- [`ARCHITECTURE-DECISIONS.md`](./ARCHITECTURE-DECISIONS.md) — Решения №3, №14
- [`TOKENS.md`](./TOKENS.md) — `@theme inline` маппинг
- `docs/design-v2/_partials-core.css` (только для извлечения BEM-стилистики; сам файл умрёт в Phase 1 как часть удаления `apps/web/src/design-v2/*`, но мы переносим его релевантные части в `apps/web/src/styles/bem.css`)
