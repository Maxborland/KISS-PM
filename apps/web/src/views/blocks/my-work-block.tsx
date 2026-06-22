"use client";

import { useState } from "react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { PriorityFlag, type PriorityLevel } from "@/components/domain/priority-flag";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { KanbanBoard, KanbanColumn } from "@/widgets/kanban/kanban-board";
import { KanbanCard } from "@/widgets/kanban/kanban-card";
import { PageIntro } from "@/views/layout/page-intro";

type ColumnId = "backlog" | "progress" | "done";

type Task = {
  id: string;
  title: string;
  project: string;
  priority: PriorityLevel;
  priorityLabel: string;
  column: ColumnId;
  assignees: { initials: string; color: "c1" | "c2" | "c3" | "c4" | "c5" }[];
  comments: number;
  date: string;
};

const COLUMNS: { id: ColumnId; title: string; tone: "info" | "success" }[] = [
  { id: "backlog", title: "Бэклог", tone: "info" },
  { id: "progress", title: "В работе", tone: "info" },
  { id: "done", title: "Готово", tone: "success" }
];

const TASKS: Task[] = [
  { id: "MDS-39", title: "Согласовать ТЗ", project: "Внедрение CRM", priority: "urgent", priorityLabel: "Срочный", column: "backlog", assignees: [{ initials: "ИИ", color: "c1" }], comments: 13, date: "30.05.2026" },
  { id: "MDS-40", title: "Подготовить смету этапа 2", project: "Внедрение CRM", priority: "normal", priorityLabel: "Обычный", column: "backlog", assignees: [{ initials: "АП", color: "c2" }], comments: 4, date: "31.05.2026" },
  { id: "MDS-44", title: "Ревью архитектуры интеграции", project: "DataHub KPI", priority: "high", priorityLabel: "Высокий", column: "backlog", assignees: [{ initials: "КБ", color: "c4" }], comments: 2, date: "02.06.2026" },
  { id: "MDS-2", title: "Коммерческое предложение", project: "Продление · 2027", priority: "low", priorityLabel: "Низкий", column: "progress", assignees: [{ initials: "КБ", color: "c4" }, { initials: "МД", color: "c5" }], comments: 7, date: "31.05.2026" },
  { id: "MDS-31", title: "Миграция данных клиента", project: "Внедрение CRM", priority: "urgent", priorityLabel: "Срочный", column: "progress", assignees: [{ initials: "АП", color: "c2" }], comments: 9, date: "29.05.2026" },
  { id: "MDS-18", title: "Демо клиенту", project: "DataHub KPI", priority: "normal", priorityLabel: "Обычный", column: "done", assignees: [{ initials: "ИИ", color: "c1" }], comments: 5, date: "27.05.2026" },
  { id: "MDS-12", title: "Обновить дорожную карту", project: "Внедрение CRM", priority: "low", priorityLabel: "Низкий", column: "done", assignees: [{ initials: "МД", color: "c5" }], comments: 1, date: "26.05.2026" }
];

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

      {mode === "kanban" ? (
        <KanbanBoard>
          {COLUMNS.map((col) => {
            const tasks = TASKS.filter((t) => t.column === col.id);
            return (
              <KanbanColumn key={col.id} title={col.title} count={tasks.length}>
                {tasks.map((t) => (
                  <KanbanCard
                    key={t.id}
                    id={t.id}
                    title={t.title}
                    priority={t.priority}
                    priorityLabel={t.priorityLabel}
                    meta={[{ label: t.project }]}
                    assignees={t.assignees}
                    comments={t.comments}
                    date={t.date}
                  />
                ))}
              </KanbanColumn>
            );
          })}
        </KanbanBoard>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th>Задача</th>
              <th>Проект</th>
              <th>Приоритет</th>
              <th>Статус</th>
              <th>Команда</th>
              <th>Срок</th>
            </tr>
          </thead>
          <tbody>
            {TASKS.map((t) => {
              const col = COLUMNS.find((c) => c.id === t.column)!;
              return (
                <tr key={t.id}>
                  <td>
                    <CellStack title={t.title} subtitle={t.id} />
                  </td>
                  <td>{t.project}</td>
                  <td>
                    <PriorityFlag level={t.priority} label={t.priorityLabel} />
                  </td>
                  <td>
                    <Chip variant={col.tone}>{col.title}</Chip>
                  </td>
                  <td>
                    <BemAvatarStack>
                      {t.assignees.map((a) => (
                        <BemAvatar key={a.initials} initials={a.initials} color={a.color} size="sm" />
                      ))}
                    </BemAvatarStack>
                  </td>
                  <td className="mono cell-muted">{t.date}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </>
  );
}
