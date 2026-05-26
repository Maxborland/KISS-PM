"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { PriorityFlag } from "@/components/domain/priority-flag";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import type { Task, TaskStatusCategory } from "@/lib/api-types";
import { formatDateRange } from "@/lib/mock-data/format";
import { buildTaskKanbanCards } from "@/lib/mock-data/scenario-presenters";
import { ScenarioFetchGate, useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { userName } from "@/lib/mock-data/users";
import { TaskDetailDrawer } from "@/views/blocks/task-detail-drawer";
import { PageIntro } from "@/views/layout/page-intro";
import {
  Kanban,
  KanbanCardViewMenu,
  TASK_KANBAN_SORT_OPTIONS,
  TASK_KANBAN_VIEW_PROFILE,
  TaskKanbanCard,
  buildTaskKanbanComparators,
  defaultTaskKanbanViewState,
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
  { id: "new", title: "Бэклог", emptyLabel: "Нет задач" },
  { id: "in_progress", title: "В работе", emptyLabel: "Нет задач" },
  { id: "review", title: "Приемка", emptyLabel: "Нет задач на приемке" },
  { id: "done", title: "Готово", emptyLabel: "Нет задач за сегодня" }
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

function handleItemMove(items: CardModel[], id: string, toColumnId: ColumnId, toIndex: number): CardModel[] {
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
  byCol[toColumnId].splice(toIndex, 0, moved);
  return KANBAN_COLUMNS.flatMap((col) => byCol[col.id]);
}

function handleItemReorder(
  items: CardModel[],
  columnId: ColumnId,
  fromIndex: number,
  toIndex: number
): CardModel[] {
  const byCol: Record<ColumnId, CardModel[]> = {
    new: [],
    in_progress: [],
    review: [],
    done: []
  };
  for (const c of items) byCol[c.columnId].push(c);
  byCol[columnId] = arrayMove(byCol[columnId], fromIndex, toIndex);
  return KANBAN_COLUMNS.flatMap((col) => byCol[col.id]);
}

export type MyWorkBlockProps = {
  initialMode?: "kanban" | "list";
};

export function MyWorkBlock({ initialMode = "kanban" }: MyWorkBlockProps = {}) {
  const { scenario } = useScenarioFixtures();
  return (
    <ScenarioFetchGate loadingLabel="Загрузка задач…">
      <MyWorkBlockInner key={scenario} initialMode={initialMode} />
    </ScenarioFetchGate>
  );
}

function MyWorkBlockInner({ initialMode = "kanban" }: MyWorkBlockProps = {}) {
  const { fixtures } = useScenarioFixtures();
  const initialCards = useMemo(
    () => buildTaskKanbanCards(fixtures.tasks),
    [fixtures.tasks]
  );
  const [mode, setMode] = useState<"kanban" | "list">(initialMode);
  const [cards, setCards] = useState<CardModel[]>(initialCards);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [columnSort, setColumnSort] = useState<KanbanColumnSortState<ColumnId>>({});
  const [cardView, setCardView] = useState(() => defaultTaskKanbanViewState());

  const cardsOrdered = useMemo(() => flattenByColumns(cards), [cards]);

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
      description: "Демо Storybook: действие зафиксировано локально."
    });
  };

  const handleColumnSortChange = (columnId: ColumnId, key: KanbanColumnSortKey) => {
    setColumnSort((prev) => ({ ...prev, [columnId]: key }));
  };

  const handleReorder = (columnId: ColumnId, fromIndex: number, toIndex: number) => {
    if ((columnSort[columnId] ?? "manual") !== "manual") {
      setColumnSort((prev) => ({ ...prev, [columnId]: "manual" }));
      toast.info("Ручной порядок", {
        description: `Колонка «${COLUMN_LABEL[columnId]}» переключена на ручную сортировку.`
      });
    }
    setCards((prev) => handleItemReorder(prev, columnId, fromIndex, toIndex));
  };

  return (
    <>
      <PageIntro title="Моя работа" lead="Канбан и список задач в одном рабочем контуре." />
      <div className="view-toolbar">
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
      <div className="u-mb-3">
        <DataTable>
          <thead>
            <tr>
              <th>План сегодня</th>
              <th>Проект</th>
              <th>Период</th>
              <th>Работа</th>
            </tr>
          </thead>
          <tbody>
            {fixtures.scheduledTasks.map((task) => (
              <tr key={task.id}>
                <td><CellStack title={task.title} subtitle={task.id} /></td>
                <td>{task.projectTitle}</td>
                <td className="mono">{formatDateRange(task.plannedStart, task.plannedFinish)}</td>
                <td className="mono">{Math.round(task.workMinutes / 60)} ч</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
      {mode === "list" ? (
        <MyWorkList cards={cardsOrdered} onOpen={setOpenCardId} />
      ) : (
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
          onItemMove={(id, toColumnId, toIndex) =>
            setCards((prev) => handleItemMove(prev, id, toColumnId, toIndex))
          }
          onItemReorder={handleReorder}
          onColumnAction={handleColumnAction}
        />
      )}

      <TaskDetailDrawer
        open={openCard != null}
        onOpenChange={(o) => !o && setOpenCardId(null)}
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
    </>
  );
}

function MyWorkList({
  cards,
  onOpen
}: {
  cards: CardModel[];
  onOpen: (id: string) => void;
}) {
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
            role="button"
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
