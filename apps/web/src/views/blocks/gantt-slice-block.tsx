"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter,
  Link2,
  PanelRightOpen,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Unlink
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { PageIntro } from "@/views/layout/page-intro";
import { GANTT_MOCK, GanttInteractive } from "@/widgets/gantt";
import type { GanttToolbarApi } from "@/widgets/gantt";

export type GanttSliceBlockProps = {
  title: string;
  lead: string;
};

function ToolbarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="gantt-toolbar__section">
      <span className="gantt-toolbar__label">{label}</span>
      <div className="gantt-toolbar__group">{children}</div>
    </div>
  );
}

function ViewToggle({
  pressed,
  label,
  onClick
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn("gantt-toolbar__toggle", pressed && "is-active")}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function GanttToolbar({
  api,
  zoom,
  onZoomChange,
  taskCount
}: {
  api: GanttToolbarApi;
  zoom: "hour" | "day" | "week" | "month";
  onZoomChange: (z: "hour" | "day" | "week" | "month") => void;
  taskCount: number;
}) {
  return (
    <>
      <div className="gantt-toolbar" role="toolbar" aria-label="Действия Ганта">
        <ToolbarSection label="Правка">
          <Button variant="ghost" size="icon-sm" aria-label="Добавить задачу" title="Добавить задачу" onClick={api.addTask}>
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Удалить задачу"
            disabled={!api.selectedRowId}
            title={api.selectedRowId ? "Удалить выбранную задачу" : "Выберите задачу в таблице"}
            onClick={api.deleteTask}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Переместить вверх"
            disabled={!api.selectedRowId}
            title="Переместить вверх"
            onClick={api.moveUp}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Переместить вниз"
            disabled={!api.selectedRowId}
            title="Переместить вниз"
            onClick={api.moveDown}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Увеличить уровень WBS"
            disabled={!api.selectedRowId}
            title="Увеличить уровень (indent)"
            onClick={api.indent}
          >
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Уменьшить уровень WBS"
            disabled={!api.selectedRowId}
            title="Уменьшить уровень (outdent)"
            onClick={api.outdent}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
        </ToolbarSection>

        <span className="gantt-toolbar__sep" aria-hidden />

        <ToolbarSection label="Связи">
          <Button
            variant={api.linkMode ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Создать связь FS"
            disabled={!api.selectedRowId}
            title={api.linkMode ? "Выберите задачу-преемник на графике" : "Создать связь окончание-начало"}
            onClick={api.linkTasks}
          >
            <Link2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Удалить связь"
            disabled={!api.selectedDependencyId}
            title={api.selectedDependencyId ? "Удалить выбранную связь" : "Выберите связь на графике"}
            onClick={api.unlinkTasks}
          >
            <Unlink className="size-4" />
          </Button>
        </ToolbarSection>

        <span className="gantt-toolbar__sep" aria-hidden />

        <ToolbarSection label="Вид">
          <ViewToggle pressed={api.flags.showCriticalPath} label="Крит. путь" onClick={api.toggleCriticalPath} />
          <ViewToggle pressed={api.flags.showBaseline} label="Базовый план" onClick={api.toggleBaseline} />
          <ViewToggle pressed={api.flags.showDependencies} label="Связи" onClick={api.toggleDependencies} />
          <Button
            variant="ghost"
            size="icon-sm"
            className="gantt-toolbar__filter-soon"
            aria-label="Фильтр (скоро)"
            disabled
            title="Фильтр (скоро) — будет в следующем этапе"
          >
            <Filter className="size-4" aria-hidden />
          </Button>
        </ToolbarSection>

        <ToolbarSection label="Панель">
          <Button
            variant={api.taskDetailsOpen ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Свойства задачи"
            title={api.taskDetailsOpen ? "Скрыть свойства задачи" : "Показать свойства задачи"}
            disabled={!api.selectedRowId && !api.taskDetailsOpen}
            onClick={api.toggleTaskDetails}
          >
            <PanelRightOpen className="size-4" />
          </Button>
        </ToolbarSection>

        <span className="gantt-toolbar__sep" aria-hidden />

        <ToolbarSection label="История">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Отменить"
            disabled={!api.canUndo}
            title={api.canUndo ? "Отменить (Ctrl+Z)" : "Нечего отменять"}
            onClick={api.undo}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Повторить"
            disabled={!api.canRedo}
            title={api.canRedo ? "Повторить (Ctrl+Y)" : "Нечего повторять"}
            onClick={api.redo}
          >
            <Redo2 className="size-4" />
          </Button>
        </ToolbarSection>

        <span className="gantt-toolbar__sep" aria-hidden />

        <ToolbarSection label="Масштаб">
          <Segmented
            className="gantt-toolbar__zoom"
            name="gantt-zoom"
            value={zoom}
            onChange={onZoomChange}
            options={[
              { value: "hour", label: "Час" },
              { value: "day", label: "День" },
              { value: "week", label: "Нед" },
              { value: "month", label: "Мес" }
            ]}
          />
        </ToolbarSection>
      </div>

      <div className="gantt-stats" aria-label="Показатели плана">
        <div className="gantt-stat">
          <span className="gantt-stat__label">SPI</span>
          <span className="gantt-stat__value">0.94</span>
        </div>
        <div className="gantt-stat">
          <span className="gantt-stat__label">CPI</span>
          <span className="gantt-stat__value">1.02</span>
        </div>
        <div className="gantt-stat">
          <span className="gantt-stat__label">Прогресс</span>
          <span className="gantt-stat__value">62%</span>
        </div>
        <div className="gantt-stat">
          <span className="gantt-stat__label">Задач</span>
          <span className="gantt-stat__value">{taskCount}</span>
        </div>
      </div>
    </>
  );
}

export function GanttSliceBlock({ title, lead }: GanttSliceBlockProps) {
  const [zoom, setZoom] = useState<"hour" | "day" | "week" | "month">("day");
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [lastTaskCardId, setLastTaskCardId] = useState<string | null>(null);

  return (
    <div className="gantt-workspace">
      <PageIntro
        title={title}
        lead={lead}
        actions={
          <>
            <Button variant="ghost" size="sm" type="button" title="Период плана (демо)">
              <Calendar className="size-4" aria-hidden />
              Май 2026
            </Button>
            <Button
              variant={hasLocalEdits ? "primary" : "ghost"}
              size="sm"
              type="button"
              disabled={!hasLocalEdits}
              title={
                hasLocalEdits
                  ? "Сохранить на сервер (mock — API не вызывается)"
                  : "Нет локальных изменений для сохранения"
              }
            >
              <Save className="size-4" aria-hidden />
              Сохранить
            </Button>
          </>
        }
      />
      {lastTaskCardId ? (
        <p className="gantt2__slice-hint" role="status">
          Открыта карточка задачи (Storybook): <code>03-task-card</code> · id={lastTaskCardId}
        </p>
      ) : null}
      <GanttInteractive
        initialData={GANTT_MOCK}
        zoom={zoom}
        onChange={() => setHasLocalEdits(true)}
        onOpenTaskCard={(taskId) => setLastTaskCardId(taskId)}
        toolbarSlot={(api) => (
          <GanttToolbar api={api} zoom={zoom} onZoomChange={setZoom} taskCount={api.rowCount} />
        )}
      />
    </div>
  );
}
