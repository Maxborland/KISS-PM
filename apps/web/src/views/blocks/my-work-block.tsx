"use client";

import { useState } from "react";

import { Segmented } from "@/components/ui/segmented";
import { KanbanBoard, KanbanColumn } from "@/widgets/kanban/kanban-board";
import { KanbanCard } from "@/widgets/kanban/kanban-card";
import { PageIntro } from "@/views/layout/page-intro";

export function MyWorkBlock() {
  const [mode, setMode] = useState<"kanban" | "list">("kanban");

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
      </div>
      {mode === "list" ? (
        <p className="u-text-sm u-text-muted">Список задач (демо переключения режима).</p>
      ) : (
        <KanbanBoard>
          <KanbanColumn title="Бэклог" count={24}>
            <KanbanCard
              id="MDS-39"
              title="Новая страница продукта"
              priority="urgent"
              priorityLabel="Срочно"
              meta={[{ label: "Новая Homepage" }, { label: "Срок: 29 июля" }]}
              assignees={[{ initials: "ИИ", color: "c1" }]}
              comments={13}
              date="30.05.2024"
            />
          </KanbanColumn>
          <KanbanColumn title="В работе" count={4}>
            <KanbanCard
              id="MDS-2"
              title="Презентация для клиента"
              priority="low"
              priorityLabel="Low"
              highlight
              assignees={[
                { initials: "КБ", color: "c4" },
                { initials: "МД", color: "c5" }
              ]}
              comments={7}
              date="31.05.2024"
            />
          </KanbanColumn>
          <KanbanColumn title="Готово" count={13}>
            <p className="u-text-xs u-text-muted">Нет задач за сегодня</p>
          </KanbanColumn>
        </KanbanBoard>
      )}
    </>
  );
}
