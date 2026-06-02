"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { PriorityFlag } from "@/components/domain/priority-flag";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import type { ScheduledTask, Task, TaskStatus } from "@/lib/api-types";
import { formatDateRange } from "@/lib/mock-data/format";
import { buildTaskKanbanCards } from "@/lib/mock-data/scenario-presenters";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import type { ScenarioFetchPhase, ScenarioName } from "@/lib/mock-data/scenarios";
import { getRuntimeTodayIsoDate, getScheduledTaskDailyWorkMinutes } from "@/lib/scheduled-tasks";
import { TaskDetailDrawer } from "@/views/blocks/task-detail-drawer";
import { MyWorkFetchIssue, MyWorkListSkeleton } from "@/views/blocks/my-work-fetch-issue";
import { MyWorkKanbanSkeleton } from "@/views/blocks/my-work-kanban-skeleton";
import { RoutePageIntro } from "@/views/layout/route-page-intro";
import {
  Kanban,
  KanbanCardViewMenu,
  TASK_KANBAN_SORT_OPTIONS,
  TASK_KANBAN_VIEW_PROFILE,
  TaskKanbanCard,
  buildTaskKanbanComparators,
  defaultTaskKanbanViewState,
  kanbanInsertIndexById,
  reorderKanbanColumnByIds,
  resolveVisibleFields,
  useKanbanOrderedItems,
  type KanbanColumnAction,
  type KanbanColumnDef,
  type KanbanColumnSortKey,
  type KanbanColumnSortState,
  type TaskKanbanItem
} from "@/widgets/kanban";

type ColumnId = "new" | "in_progress" | "review" | "done";

type CardModel = TaskKanbanItem<ColumnId>;

const KANBAN_COLUMNS: KanbanColumnDef<ColumnId>[] = [
  { id: "new", title: "Бэклог", emptyLabel: "Нет задач", tone: "violet" },
  { id: "in_progress", title: "В работе", emptyLabel: "Нет задач", tone: "info" },
  { id: "review", title: "Приемка", emptyLabel: "Нет задач на приемке", tone: "warning" },
  { id: "done", title: "Готово", emptyLabel: "Нет задач за сегодня", tone: "success" }
];

const COLUMN_LABEL: Record<ColumnId, string> = {
  new: "Бэклог",
  in_progress: "В работе",
  review: "Приемка",
  done: "Готово"
};

const COLUMN_TONE: Record<ColumnId, "info" | "violet" | "success" | "warning"> = {
  new: "violet",
  in_progress: "info",
  review: "warning",
  done: "success"
};

const COLUMN_DRAWER_TONE: Record<ColumnId, "info" | "violet" | "success" | "warning"> = {
  new: "violet",
  in_progress: "info",
  review: "warning",
  done: "success"
};

function flattenByColumns(items: CardModel[]): CardModel[] {
  return KANBAN_COLUMNS.flatMap((col) => items.filter((c) => c.columnId === col.id));
}

function handleItemMove(
  items: CardModel[],
  id: string,
  toColumnId: ColumnId,
  toIndex: number,
  overId?: string
): CardModel[] {
  const item = items.find((c) => c.id === id);
  if (!item) return items;
  const without = items.filter((c) => c.id !== id);
  const byCol: Record<ColumnId, CardModel[]> = {
    new: [],
    in_progress: [],
    review: [],
    done: []
  };
  for (const c of without) byCol[c.columnId].push(c);
  const moved = { ...item, columnId: toColumnId };
  byCol[toColumnId].splice(kanbanInsertIndexById(byCol[toColumnId], toIndex, overId), 0, moved);
  return KANBAN_COLUMNS.flatMap((col) => byCol[col.id]);
}

function handleItemReorder(
  items: CardModel[],
  columnId: ColumnId,
  fromIndex: number,
  toIndex: number,
  movingId?: string,
  overId?: string
): CardModel[] {
  const byCol: Record<ColumnId, CardModel[]> = {
    new: [],
    in_progress: [],
    review: [],
    done: []
  };
  for (const c of items) byCol[c.columnId].push(c);
  byCol[columnId] = reorderKanbanColumnByIds(byCol[columnId], fromIndex, toIndex, movingId, overId);
  return KANBAN_COLUMNS.flatMap((col) => byCol[col.id]);
}

export type MyWorkBlockProps = {
  initialMode?: "kanban" | "list";
};

export type RuntimeMyWorkBlockProps = MyWorkBlockProps & {
  tasks?: Task[];
  scheduledTasks?: ScheduledTask[];
  taskStatuses?: TaskStatus[];
  initialOpenTaskId?: string | undefined;
  readOnly?: boolean;
  isMovingTaskStatus?: boolean;
  onMoveTaskStatus?: (input: { projectId: string; taskId: string; statusId: string }) => Promise<unknown>;
};

export function resolveTaskStatusIdForColumn(
  taskStatuses: readonly TaskStatus[],
  columnId: ColumnId,
  currentCategory: Task["statusCategory"]
): string | null {
  const targetCategories = resolveAllowedTargetCategories(columnId, currentCategory);
  const status = taskStatuses
    .filter((candidate) => candidate.status === "active" && targetCategories.includes(candidate.category))
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return status?.id ?? null;
}

function resolveAllowedTargetCategories(
  columnId: ColumnId,
  currentCategory: Task["statusCategory"]
): Task["statusCategory"][] {
  if (columnId === "new") {
    if (currentCategory === "in_progress") return ["waiting"];
    if (currentCategory === "new" || currentCategory === "waiting") return [currentCategory];
    return [];
  }

  const allowedTransitions: Record<Task["statusCategory"], Task["statusCategory"][]> = {
    new: ["waiting", "in_progress"],
    waiting: ["in_progress"],
    in_progress: ["waiting", "review", "done"],
    review: ["in_progress", "done"],
    done: []
  };
  return allowedTransitions[currentCategory].includes(columnId) ? [columnId] : [];
}

export function MyWorkBlock({ initialMode = "kanban" }: MyWorkBlockProps = {}) {
  return <FixtureMyWorkBlock initialMode={initialMode} />;
}

function FixtureMyWorkBlock({ initialMode = "kanban" }: MyWorkBlockProps = {}) {
  const { fixtures, state, scenario } = useScenarioFixtures();
  return (
    <MyWorkBlockInner
      key={scenario}
      initialMode={initialMode}
      tasks={fixtures.tasks}
      scheduledTasks={fixtures.scheduledTasks}
      fetchPhase={state.fetchPhase}
      errorMessage={state.errorMessage}
      scenario={scenario}
    />
  );
}

export function RuntimeMyWorkBlock({
  initialMode = "kanban",
  initialOpenTaskId,
  tasks = [],
  scheduledTasks = [],
  taskStatuses = [],
  readOnly = true,
  isMovingTaskStatus = false,
  onMoveTaskStatus
}: RuntimeMyWorkBlockProps = {}) {
  return (
    <MyWorkBlockInner
      key="runtime"
      initialMode={initialMode}
      tasks={tasks}
      scheduledTasks={scheduledTasks}
      taskStatuses={taskStatuses}
      initialOpenTaskId={initialOpenTaskId}
      readOnly={readOnly}
      isMovingTaskStatus={isMovingTaskStatus}
      {...(onMoveTaskStatus ? { onMoveTaskStatus } : {})}
      fetchPhase="success"
      scenario="default"
      runtime
    />
  );
}

function MyWorkBlockInner({
  initialMode = "kanban",
  tasks,
  scheduledTasks,
  taskStatuses,
  initialOpenTaskId,
  readOnly = false,
  isMovingTaskStatus = false,
  onMoveTaskStatus,
  fetchPhase,
  errorMessage,
  scenario,
  runtime = false
}: RuntimeMyWorkBlockProps & {
  fetchPhase: ScenarioFetchPhase;
  errorMessage?: string | undefined;
  scenario: ScenarioName;
  runtime?: boolean;
}) {
  const sourceTasks = tasks ?? [];
  const sourceScheduledTasks = scheduledTasks ?? [];
  const sourceTaskStatuses = taskStatuses ?? [];
  const initialCards = useMemo(
    () => buildTaskKanbanCards(sourceTasks),
    [sourceTasks]
  );
  const [mode, setMode] = useState<"kanban" | "list">(initialMode);
  const [cards, setCards] = useState<CardModel[]>(initialCards);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const consumedInitialOpenTaskIdRef = useRef<string | null>(null);
  const [columnSort, setColumnSort] = useState<KanbanColumnSortState<ColumnId>>({});
  const [cardView, setCardView] = useState(() => defaultTaskKanbanViewState());
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!runtime) return;

    setCards(initialCards);
    setOpenCardId((current) => {
      if (
        initialOpenTaskId &&
        consumedInitialOpenTaskIdRef.current !== initialOpenTaskId &&
        initialCards.some((card) => card.id === initialOpenTaskId)
      ) {
        consumedInitialOpenTaskIdRef.current = initialOpenTaskId;
        return initialOpenTaskId;
      }
      return current && initialCards.some((card) => card.id === current) ? current : null;
    });
  }, [initialCards, initialOpenTaskId, runtime]);

  const cardsOrdered = useMemo(() => flattenByColumns(cards), [cards]);
  const isEmpty = (!runtime && scenario === "empty") || cardsOrdered.length === 0;

  const comparators = useMemo(() => buildTaskKanbanComparators<CardModel, ColumnId>(), []);
  const sortedCards = useKanbanOrderedItems(KANBAN_COLUMNS, cardsOrdered, columnSort, comparators);
  const visibleFields = useMemo(
    () => resolveVisibleFields(TASK_KANBAN_VIEW_PROFILE, cardView),
    [cardView]
  );

  const openCard = useMemo(
    () => cards.find((c) => c.id === openCardId) ?? null,
    [cards, openCardId]
  );

  const handleColumnAction = (columnId: ColumnId, action: KanbanColumnAction) => {
    const labels: Record<KanbanColumnAction, string> = {
      rename: "Переименование колонки",
      wip: "Лимит WIP",
      add: "Добавление карточки"
    };
    toast.info(`${labels[action]} — ${COLUMN_LABEL[columnId]}`, {
      description: runtime ? "Runtime read-only: изменение будет подключено отдельным срезом." : "Демо Storybook: действие зафиксировано локально."
    });
  };

  const handleColumnSortChange = (columnId: ColumnId, key: KanbanColumnSortKey) => {
    setColumnSort((prev) => ({ ...prev, [columnId]: key }));
  };

  const handleReorder = (
    columnId: ColumnId,
    fromIndex: number,
    toIndex: number,
    movingId?: string,
    overId?: string
  ) => {
    if ((columnSort[columnId] ?? "manual") !== "manual") {
      setColumnSort((prev) => ({ ...prev, [columnId]: "manual" }));
      toast.info("Ручной порядок", {
        description: `Колонка «${COLUMN_LABEL[columnId]}» переключена на ручную сортировку.`
      });
    }
    setCards((prev) => handleItemReorder(prev, columnId, fromIndex, toIndex, movingId, overId));
  };

  const handleRuntimeStatusMove = async (
    id: string,
    toColumnId: ColumnId,
    toIndex: number,
    overId?: string
  ) => {
    const currentCard = cards.find((card) => card.id === id);
    const currentTask = sourceTasks.find((task) => task.id === id);
    if (!currentCard || !currentTask || currentCard.columnId === toColumnId) return;

    const statusId = resolveTaskStatusIdForColumn(
      sourceTaskStatuses,
      toColumnId,
      currentTask.statusCategory
    );
    if (!statusId) {
      toast.error("Статус недоступен", {
        description: `Для колонки «${COLUMN_LABEL[toColumnId]}» нет активного статуса в рабочей области.`
      });
      return;
    }

    const previousCards = cards;
    setCards((prev) => handleItemMove(prev, id, toColumnId, toIndex, overId));

    try {
      await onMoveTaskStatus?.({
        projectId: currentTask.projectId,
        taskId: currentTask.id,
        statusId
      });
      toast.success("Статус задачи обновлён", {
        description: `${currentTask.title} → ${COLUMN_LABEL[toColumnId]}`
      });
    } catch {
      setCards(previousCards);
      toast.error("Не удалось изменить статус", {
        description: "Проверьте права, допустимость перехода или доступность API."
      });
    }
  };

  const toolbar = (
    <div className="view-toolbar my-work__toolbar">
      <Segmented
        name="my-work-mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "kanban", label: "Канбан" },
          { value: "list", label: "Список" }
        ]}
      />
      <div className="view-toolbar__filters">
        {mode === "kanban" ? (
          <KanbanCardViewMenu
            profile={TASK_KANBAN_VIEW_PROFILE}
            value={cardView}
            onChange={setCardView}
          />
        ) : null}
      </div>
    </div>
  );

  if (fetchPhase === "loading") {
    return (
      <div className="my-work">
        <RoutePageIntro />
        {toolbar}
        {mode === "kanban" ? <MyWorkKanbanSkeleton /> : <MyWorkListSkeleton />}
      </div>
    );
  }

  if (fetchPhase === "error") {
    return (
      <div className="my-work">
        <RoutePageIntro />
        {toolbar}
        <MyWorkFetchIssue
          kind="error"
          {...(!runtime && errorMessage ? { message: errorMessage } : {})}
          onRetry={() => setRetryCount((n) => n + 1)}
        />
        {retryCount > 0 ? (
          <p className="my-work__retry-hint mono">Повтор {retryCount}</p>
        ) : null}
      </div>
    );
  }

  if (fetchPhase === "forbidden") {
    return (
      <div className="my-work">
        <RoutePageIntro />
        {toolbar}
        <MyWorkFetchIssue kind="forbidden" />
      </div>
    );
  }

  return (
    <div className="my-work">
      <RoutePageIntro />
      {toolbar}

      {mode === "kanban" && sourceScheduledTasks.length > 0 ? (
        <MyWorkTodayPlan tasks={sourceScheduledTasks} />
      ) : null}

      {mode === "list" ? (
        <MyWorkList cards={cardsOrdered} onOpen={setOpenCardId} empty={isEmpty} />
      ) : (
        <div className="my-work__board">
          <Kanban<CardModel, ColumnId>
            columns={KANBAN_COLUMNS}
            items={sortedCards}
            visibleFields={visibleFields}
            sortOptions={TASK_KANBAN_SORT_OPTIONS}
            columnSort={columnSort}
            onColumnSortChange={handleColumnSortChange}
            renderCard={(item, ctx) => (
              <TaskKanbanCard
                item={item}
                draggable={ctx.draggable}
                isDragging={ctx.isDragging}
                visibleFields={ctx.visibleFields}
                onOpen={setOpenCardId}
              />
            )}
            disableDnd={isMovingTaskStatus || (readOnly && !onMoveTaskStatus)}
            {...(onMoveTaskStatus
              ? {
                  onItemMove: (id, toColumnId, toIndex, overId) => {
                    void handleRuntimeStatusMove(id, toColumnId, toIndex, overId);
                  }
                }
              : !readOnly
              ? {
                  onItemMove: (id, toColumnId, toIndex, overId) =>
                    setCards((prev) => handleItemMove(prev, id, toColumnId, toIndex, overId)),
                  onItemReorder: handleReorder,
                  onColumnAction: handleColumnAction
                }
              : {})}
          />
        </div>
      )}

      <TaskDetailDrawer
        open={openCard != null}
        onOpenChange={(o) => !o && setOpenCardId(null)}
        {...(runtime ? { taskHref: null } : {})}
        task={
          openCard
            ? {
                id: openCard.id,
                title: openCard.title,
                ...(openCard.meta?.find((meta) => meta.label.startsWith("Проект:"))?.label.replace("Проект: ", "")
                  ? {
                      project: openCard.meta
                        ?.find((meta) => meta.label.startsWith("Проект:"))
                        ?.label.replace("Проект: ", "")
                    }
                  : {}),
                stage: {
                  label: COLUMN_LABEL[openCard.columnId],
                  tone: COLUMN_DRAWER_TONE[openCard.columnId]
                }
              }
            : null
        }
      />
    </div>
  );
}

function MyWorkTodayPlan({ tasks }: { tasks: ScheduledTask[] }) {
  const today = getRuntimeTodayIsoDate();

  return (
    <CardPanel
      title="План на сегодня"
      subtitle={`${tasks.length} слотов`}
      flush
      className="my-work__plan"
    >
      <DataTable>
        <thead>
          <tr>
            <th>Задача</th>
            <th>Проект</th>
            <th>Период</th>
            <th>Работа</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <CellStack title={task.title} subtitle={task.id} />
              </td>
              <td>{task.projectTitle}</td>
              <td className="mono">{formatDateRange(task.plannedStart, task.plannedFinish)}</td>
              <td className="mono">{Math.round(getScheduledTaskDailyWorkMinutes(task, today) / 60)} ч</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </CardPanel>
  );
}

function MyWorkList({
  cards,
  onOpen,
  empty
}: {
  cards: CardModel[];
  onOpen: (id: string) => void;
  empty: boolean;
}) {
  if (empty) {
    return (
      <CardPanel title="Задачи" subtitle="Список пуст">
        <p className="u-text-body u-text-muted">Нет задач в выбранном срезе. Создайте задачу или смените фильтр.</p>
      </CardPanel>
    );
  }

  return (
    <DataTable>
      <thead>
        <tr>
          <th>Задача</th>
          <th>Колонка</th>
          <th>Приоритет</th>
          <th>Срок</th>
          <th>Прогресс</th>
          <th>План/факт</th>
          <th>Приемка</th>
          <th>Исполнители</th>
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => (
          <tr
            key={card.id}
            tabIndex={0}
            aria-label={`Открыть карточку ${card.id}`}
            onClick={() => onOpen(card.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(card.id);
              }
            }}
            className="row-clickable"
          >
            <td>
              <CellStack title={card.title} subtitle={card.id} />
            </td>
            <td>
              <Chip variant={COLUMN_TONE[card.columnId]}>{COLUMN_LABEL[card.columnId]}</Chip>
            </td>
            <td>
              <PriorityFlag level={card.priority} label={card.priorityLabel} />
            </td>
            <td className="mono cell-muted">{card.date}</td>
            <td>{card.progress ?? 0}%</td>
            <td className="mono">
              {Math.round(card.actualWork ?? 0)}/{Math.round(card.plannedWork ?? 0)} мин
            </td>
            <td>{card.requiresAcceptance ? <Chip variant="warning">Требуется</Chip> : <Chip>Нет</Chip>}</td>
            <td>
              <BemAvatarStack>
                {card.assignees.map((a) => (
                  <BemAvatar
                    key={a.initials}
                    initials={a.initials}
                    {...(a.color ? { color: a.color } : {})}
                  />
                ))}
              </BemAvatarStack>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
