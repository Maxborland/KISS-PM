# TaskModal editor-side Low 6

Статус: **PASS**

Дата проверки: 2026-07-10 (Asia/Novosibirsk)

## Scope

Изменены только разрешённые файлы:

- `apps/web/src/delivery/schedule/schedule-editors.tsx`
- `apps/web/src/delivery/schedule/schedule-editors.test.tsx`

`schedule-surface.tsx`, schedule-productivity, commits, API docs и матрица не изменялись.
В `schedule-editors.tsx` до начала работы уже были чужие изменения resource override /
`canAssign`; они сохранены и не откатывались.

## Реализация

- `TaskModal` принимает optional `workingMinutesPerDay`; units считаются как
  `workH * 60 / (durDays * workingMinutesPerDay) * 100`.
- Подпись треугольника показывает фактические часы рабочего дня. Legacy fallback
  `8 * 60` оставлен только для type-compatible перехода текущего caller.
- Добавлен точный submit-контракт:
  `TaskModalSubmitResult = { accepted: boolean }`.
- `onSubmit` допускает sync/async result и legacy `void`, поэтому текущий caller
  продолжает typecheck.
- Editor вызывает `onOpenChange(false)` только для явного `{ accepted: true }`.
  `{ accepted: false }`, legacy `void` и rejected Promise сохраняют открытую
  модалку и локальный draft.
- Пока submit ожидается, кнопка disabled; повторная отправка не запускается.
- Ошибку submit показывает parent; editor не закрывает и не сбрасывает draft.

## Parent integration requirement

В отдельном изменении `schedule-surface.tsx` parent обязан:

1. Передать календарь:
   `workingMinutesPerDay={projectWorkingTime.workingMinutesPerDay}`.
2. Сделать `submitTaskModal` async и вернуть
   `Promise<TaskModalSubmitResult>`.
3. Для отсутствующей modal и локального permission deny вернуть
   `{ accepted: false }`.
4. Удалить ранний `setTaskModal(null)`: закрытие после явного acceptance теперь
   принадлежит `TaskModal` через существующий `onOpenChange`.
5. Дождаться `runBatch(commands)` и вернуть:
   `{ accepted: batchMode || result?.ok === true }`.
   `batchMode` считается accepted после локального staging; server reject,
   conflict, operation-in-flight и иной `null` вне batch дают false.

Целевой parent shape:

```tsx
async function submitTaskModal(values: TaskModalValues): Promise<TaskModalSubmitResult> {
  const modal = taskModal;
  if (!modal) return { accepted: false };
  if (changesAssignedWork) {
    toast.error("...");
    return { accepted: false };
  }

  // build commands; do not call setTaskModal(null) here
  const result = await runBatch(commands);
  return { accepted: batchMode || result?.ok === true };
}

<TaskModal
  workingMinutesPerDay={projectWorkingTime.workingMinutesPerDay}
  onSubmit={submitTaskModal}
  // existing props unchanged
/>
```

До этой parent-интеграции текущий caller всё ещё typecheck-compatible. Его локальный
permission `return;` уже не воспринимается editor как acceptance, поэтому draft
остаётся. Для сохранения modal при server reject parent должен выполнить пункты 2-5.

## Fresh verification

- PASS: `pnpm --filter @kiss-pm/web test -- src/delivery/schedule/schedule-editors.test.tsx`
  - 1 test file passed
  - 5 tests passed
  - покрыты 360 мин/день, explicit accept, local reject, rejected Promise,
    legacy void compatibility
- PASS: `pnpm --filter @kiss-pm/web typecheck`
  - `next typegen` completed
  - `tsc -p tsconfig.json --pretty false` completed
- PASS: post-edit `codegraph sync` completed; watcher сообщил `Already up to date`.

Неблокирующее наблюдение: targeted test печатает существующий Radix warning об
отсутствующем Dialog.Description. Это не связано с Low 6 и не менялось в этом slice.

## CodeGraph change index

- До: `TaskModal` был одним function node с inline props; submit был sync и всегда
  вызывал close. Отдельных submit/props type nodes не было.
- После: `TaskModal` function node изменён (line 244); добавлены type_alias nodes
  `TaskModalSubmitResult` и `TaskModalProps`.
- Edges: добавлена reference `TaskModalProps → TaskModalValues`; существующие calls
  `TaskModal → submit` и `TaskModal → useResourceDirectory` сохранены.
- Impact radius: 4 aggregate symbols до → 4 после; новых внешних callers не появилось.
- Post-sync index: 2238 files, 25083 nodes, 53324 edges.
- Новый test file индексирован; он напрямую использует `TaskModal`,
  `TaskModalProps` и `TaskModalValues`.

## Editing fallback

Штатный tool `apply_patch` был вызван первым, но Windows sandbox дважды отказал
до чтения файла (`cannot enforce split writable root sets`). Первый `git apply`
fallback был отклонён как malformed и ничего не изменил. Рабочие hunks затем
применены тем же Codex apply-patch executable напрямую с UTF-8 аргументом.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-task-modal-final.md
