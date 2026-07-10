# PROJ-011: переход из списка проектов в detail

## Вердикт

PASS. Каждая доступная строка проекта содержит нативную ссылку в названии с точным маршрутом `/projects/:id`. Искусственные `role="link"`, `tabIndex`, `onKeyDown` и `router.push` на `<tr>` удалены.

## Изменения

- `apps/web/src/workspace/projects/projects-list-surface.tsx`
  - название проекта рендерится через `next/link`;
  - href изменен с программного `/projects/:id/overview` на требуемый `/projects/:id`;
  - строка таблицы больше не имитирует ссылку через ARIA и keyboard handlers;
  - loading/error/forbidden/empty вычисление и `SurfaceState` не менялись.
- `apps/web/src/workspace/projects/projects-list-navigation.test.tsx`
  - две ready-строки проверены на отдельные `HTMLAnchorElement`, точные href и focus;
  - подтверждено отсутствие `role`/`tabindex`-хаков на строках;
  - loading, error и empty проверены на честный текст состояния и отсутствие project detail links.

## Проверки

### Focused tests

Команда:

```text
pnpm vitest run src/workspace/projects/projects-list-navigation.test.tsx src/workspace/projects/projects-list-surface.test.ts
```

Результат: PASS, 2 test files, 6 tests.

### Web typecheck

Команда:

```text
pnpm typecheck
```

Результат: PASS. `next typegen` завершен, `tsc -p tsconfig.json --pretty false` без ошибок.

## Acceptance evidence

- Real href: `/projects/project-alpha`, `/projects/project-beta`.
- Native link affordances: project title является `<a href>`; open-in-new-tab, контекстное меню и Enter activation предоставляет браузер.
- Keyboard: обе ссылки принимают focus; отрицательный `tabindex` отсутствует.
- Honest states: loading показывает «Загрузка проектов», error показывает «Не удалось загрузить проекты», empty показывает «Нет проектов»; project detail links в этих состояниях отсутствуют.
- Визуальные токены, layout и data-state логика не менялись. Real-browser/E2E не запускались по scope lane; focused DOM test покрывает требуемую навигационную семантику.

## CodeGraph change index

До изменения, по первому `codegraph_files` для `apps/web/src/workspace/projects`:

- files: 3;
- local symbol nodes: 36;
- `projects-list-surface.tsx`: 25 symbols.

После изменения и обязательного `codegraph sync`:

- files: 4;
- local symbol nodes: 46;
- `projects-list-surface.tsx`: 24 symbols;
- `projects-list-navigation.test.tsx`: 11 symbols;
- net local nodes: `36 -> 46` (+10), включая новый test file и удаленный `useRouter` import node.

Именованные новые nodes подтверждены CodeGraph: `harness`, `nonReadyStates`, `renderSurface`; новый import edge test -> `ProjectsListSurface` также найден поиском.

CodeGraph watcher успел проиндексировать изменения до ручного sync. Поэтому явный checkpoint показывает global nodes `24728 -> 24728` и edges `52882 -> 52882`; `codegraph sync` вернул `Already up to date`. Это sync-checkpoint, а не baseline до начала задачи. Семантически удалены программные navigation edges к `useRouter/router.push`; навигация теперь выражена native href в JSX.

## Scope

Изменены только три разрешенных файла. Docs/matrix/E2E не тронуты. Commit не создавался.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-project-list.md
