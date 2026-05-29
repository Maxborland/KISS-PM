# Dev-стенд design-v3 (LAN HMR)

Короткая шпаргалка для визуального review на ПК Max, пока агент правит UI в worktree.

Worktree: `E:\KISS-PM\.worktrees\design-v3-vh-split-pane`

## Storybook HMR (предпочтительно для design-v3)

Из корня репозитория / worktree:

```bash
pnpm dev:storybook:lan
```

Эквивалент из `apps/web`:

```bash
pnpm --filter @kiss-pm/web storybook:lan
```

### URL для Max-PC

| Режим | URL |
|-------|-----|
| Локально на машине разработки | http://localhost:6006 |
| По LAN (Max-PC) | http://10.1.1.50:6006 |

Для Ганта: **Views → Screens → «12 Гант проекта»**.

## Next app HMR (полный shell)

```bash
pnpm dev:web:lan
```

Эквивалент:

```bash
pnpm --filter @kiss-pm/web dev:lan
```

### URL для Max-PC

| Режим | URL |
|-------|-----|
| Локально | http://localhost:3000 |
| По LAN | http://10.1.1.50:3000 |

## Заметки

- **Storybook** — основной способ визуального review design-v3 (изолированные сторис, быстрый HMR).
- **Терминал** с dev-процессом должен оставаться открытым: при остановке процесса HMR прекращается.
- Если **Windows Firewall** спросит доступ — разрешите для **частной (private) сети**, иначе Max не откроет LAN-URL.
- IP `10.1.1.50` — хост разработчика в LAN; при смене адреса обновите URL в браузере Max.

## Проверка перед PR (не заменяет dev-стенд)

```bash
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web test
```
