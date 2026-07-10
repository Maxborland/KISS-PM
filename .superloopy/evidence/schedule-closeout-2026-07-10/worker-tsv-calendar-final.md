# Franky executor: calendar-aware TSV Schedule import

Дата: 2026-07-10
Статус: BLOCKED

Причина статуса: targeted regression tests проходят, но обязательный web typecheck завершился с ошибками в чужих dirty-файлах вне разрешённого scope. PASS не заявляется.

## Выполнено

- parseTaskTsv принимает ScheduleCalendarSource и выбирает effective project calendar через resolveScheduleWorkingTime(source, null).
- Длительность TSV теперь хранится в durationMinutes и вычисляется из рабочего дня выбранного календаря.
- Finish для заданной длительности вычисляется через scheduleFinishDateForDuration, поэтому пропускает выходные и project-level calendar exceptions.
- Явный finish нормализуется через scheduleWorkingDateOnOrAfter, а диапазон дат считается через scheduleWorkingMinutesThroughDate.
- Default work теперь равен durationMinutes / 60.
- buildPasteCommands передаёт row.durationMinutes без фиксированного множителя 480.
- schedule-working-time.ts не менялся.

## Точные regression cases

Файл: apps/web/src/delivery/schedule/schedule-productivity.test.ts

1. Шестичасовой effective project calendar: 2 дня дают durationMinutes=720 и default workMinutes=720.
2. Выходные: 2 рабочих дня с пятницы 2026-07-10 завершаются в понедельник 2026-07-13.
3. Исключение: при holiday на 2026-07-13 тот же импорт завершается 2026-07-14.
4. Базовый пятидневный импорт с 2026-07-01 теперь завершается 2026-07-07, а не календарным прибавлением до 2026-07-06.

## Fresh verification

Команда:

    pnpm vitest run apps/web/src/delivery/schedule/schedule-productivity.test.ts apps/web/src/delivery/schedule/schedule-calendar-semantics.test.ts

Результат: exit 0; 2 test files passed; 15 tests passed.

Команда:

    git diff --check -- apps/web/src/delivery/schedule/schedule-productivity.ts apps/web/src/delivery/schedule/schedule-productivity.test.ts

Результат: exit 0.

Инвариантная проверка schedule-productivity.ts на MINUTES_PER_DAY, literal 480, durationDays * 8, addIsoDays(startIso) и daysBetween:

Результат: NO_MATCH.

Обязательная команда:

    pnpm --filter @kiss-pm/web typecheck

Результат финального rerun: exit 1. Ошибок в schedule-productivity.ts и schedule-productivity.test.ts нет. Typecheck остановлен тремя существующими ошибками вне scope:

- commits-permission.test.tsx:134,185,202 — latestRevert null несовместим с inferred mock type.

Эти файлы не изменялись: расширять scope ради зелёного статуса было запрещено.

## Surface integration recommendation

schedule-surface.tsx намеренно не редактировался. Для передачи реального effective project calendar нужны ровно две замены:

    const parsedPaste = useMemo(
      () => parseTaskTsv(pasteDraft, readModel ?? {}),
      [pasteDraft, readModel]
    );

и в updatePasteDraft:

    const parsed = parseTaskTsv(value, readModel ?? {});

Без этого узкого surface patch сохранён backward-compatible fallback календаря 5x8; core TSV API и команды уже calendar-aware.

## Apply patch discipline

Первичный functions.apply_patch дважды отказал до чтения файла из-за Windows sandbox wrapper: "cannot enforce split writable root sets". Ручные изменения всё равно выполнены apply_patch engine через codex.exe --codex-run-as-apply-patch; прямой записи файлов PowerShell не было.

## CodeGraph change index

Перед изменениями после codegraph sync:

- files 2237
- nodes 25069
- edges 53359

После изменений и обязательного codegraph sync:

- files 2237
- nodes 25069
- edges 53313
- sync report: 1 changed source file, 11 nodes reparsed

Изменённые символы:

- TaskTsvRow: добавлен durationMinutes.
- parseTaskTsv: добавлен calendarSource; календарные вычисления переведены на schedule-working-time.
- buildPasteCommands: durationMinutes берётся из parsed row.
- daysBetween: удалён как мёртвый calendar-day helper.

Глобальная дельта типов узлов: constants 4674->4673, functions 6780->6779, imports 8199->8200, type_aliases 2856->2857. Изменение edges 53359->53313 включает повторное разрешение ссылок CodeGraph.

## Scope and dirty-worktree note

Изменены только разрешённые product/test файлы и этот evidence:

- apps/web/src/delivery/schedule/schedule-productivity.ts
- apps/web/src/delivery/schedule/schedule-productivity.test.ts
- .superloopy/evidence/schedule-closeout-2026-07-10/worker-tsv-calendar-final.md

В schedule-productivity.ts и тесте до начала уже были чужие календарные изменения для finish-fill. Они сохранены. schedule-working-time.ts был untracked до начала и не редактировался. Остальной dirty worktree не трогался.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-tsv-calendar-final.md
