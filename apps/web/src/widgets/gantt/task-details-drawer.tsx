"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dayIndexToDateLabel, finishDayIndex } from "./gantt-dates";
import { GanttDateField } from "./gantt-date-field";
import { GanttResourcePicker } from "./gantt-resource-picker";
import type { GanttResource } from "./gantt-resources";
import { drawerIssueBlockClass } from "./gantt-issue-styling";
import type { GanttCellField, GanttDependency, GanttDependencyType, GanttRow } from "./types";

const DEP_TYPES: GanttDependencyType[] = ["FS", "SS", "FF", "SF"];

function statusMeta(row: GanttRow) {
  if (row.scheduleState === "overdue") return { label: "Просрочено", tone: "overdue" as const };
  if (row.scheduleState === "at-risk") return { label: "Под риском", tone: "at-risk" as const };
  if (row.critical) return { label: "Критический путь", tone: "critical" as const };
  return { label: "В плане", tone: "on-track" as const };
}

function kindLabel(kind: GanttRow["kind"]) {
  if (kind === "summary") return "Суммарная";
  if (kind === "milestone") return "Веха";
  return "Задача";
}

export function TaskDetailsDrawer({
  open,
  row,
  dependencies,
  dirty,
  onClose,
  onCommitField,
  onUpdateDependency,
  onAssignResource,
  onOpenTaskCard
}: {
  open: boolean;
  row: GanttRow | undefined;
  dependencies: GanttDependency[];
  dirty: boolean;
  onClose: () => void;
  onCommitField: (rowId: string, field: GanttCellField, draft: string) => string | undefined;
  onUpdateDependency: (dependencyId: string, patch: Partial<Pick<GanttDependency, "type" | "lagDays">>) => void;
  onAssignResource?: (rowId: string, resource: GanttResource | null) => void;
  onOpenTaskCard?: () => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [finish, setFinish] = useState("");
  const [duration, setDuration] = useState("");
  const [progress, setProgress] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [resource, setResource] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();

  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setStart(dayIndexToDateLabel(row.startDay));
    setFinish(dayIndexToDateLabel(finishDayIndex(row)));
    setDuration(row.kind === "milestone" ? "0" : String(row.durationDays));
    setProgress(`${Math.round((row.progress ?? 0) * 100)}`);
    setWorkHours(String(row.workHours ?? (row.kind === "task" ? row.durationDays * (row.hoursPerDay ?? 8) : 0)));
    setResource(row.assignee?.initials ?? "");
    setNotes(row.notes ?? "");
    setFieldError(undefined);
  }, [row]);

  const preds = row ? dependencies.filter((d) => d.toId === row.id) : [];

  const commit = (field: GanttCellField, value: string) => {
    if (!row) return;
    const err = onCommitField(row.id, field, value);
    setFieldError(err);
  };

  return (
    <aside
      className={cn("gantt2__drawer", open && "gantt2__drawer--open", row && "gantt2__drawer--active")}
      aria-label="Свойства задачи"
      aria-hidden={!open}
    >
      <header className="gantt2__drawer-head">
        <div className="gantt2__drawer-head-main">
          <span className="gantt2__drawer-eyebrow">Свойства задачи</span>
          {row ? (
            <>
              <span className="gantt2__drawer-wbs">{row.wbs ?? "—"}</span>
              <h2 className="gantt2__drawer-title">{row.name}</h2>
              <span className={cn("gantt2__status-chip", `gantt2__status-chip--${statusMeta(row).tone}`)}>
                {statusMeta(row).label}
              </span>
            </>
          ) : (
            <p className="gantt2__drawer-empty">Выберите задачу в таблице или на графике</p>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" type="button" aria-label="Закрыть" title="Закрыть" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      {dirty ? (
        <p className="gantt2__drawer-dirty" role="status">
          Есть локальные изменения (отмена: Ctrl+Z)
        </p>
      ) : null}

      {fieldError ? <p className="gantt2__drawer-error">{fieldError}</p> : null}

      {row && row.planningIssues && row.planningIssues.length > 0 ? (
        <div className={cn("gantt2__drawer-issues", drawerIssueBlockClass(row))} role="alert">
          <strong>Ошибка планирования</strong>
          <ul>
            {row.planningIssues.map((issue, i) => (
              <li key={`${issue.type}-${i}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {row ? (
        <div className="gantt2__drawer-body">
          <label className="gantt2__drawer-field">
            <span className="gantt2__drawer-label">Название</span>
            <input
              className="gantt2__drawer-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => commit("name", name)}
            />
          </label>

          <div className="gantt2__drawer-field gantt2__drawer-field--readonly">
            <span className="gantt2__drawer-label">Тип</span>
            <span className="gantt2__drawer-value">{kindLabel(row.kind)}</span>
          </div>

          <div className="gantt2__drawer-grid-2">
            <div className="gantt2__drawer-field gantt2__drawer-field--readonly">
              <span className="gantt2__drawer-label">Backend status</span>
              <span className="gantt2__drawer-value">{row.statusName ?? row.statusId ?? "—"}</span>
            </div>
            <div className="gantt2__drawer-field gantt2__drawer-field--readonly">
              <span className="gantt2__drawer-label">Project / owner</span>
              <span className="gantt2__drawer-value">{row.projectId ?? "—"} · {row.ownerUserId ?? "—"}</span>
            </div>
          </div>

          <div className="gantt2__drawer-grid-2">
            <label className="gantt2__drawer-field">
              <span className="gantt2__drawer-label">Начало</span>
              <GanttDateField
                className="gantt2__drawer-input gantt2__drawer-input--date"
                value={start}
                disabled={row.kind === "summary"}
                ariaLabel="Начало"
                onChange={setStart}
                onBlurCommit={(label) => commit("start", label)}
              />
            </label>

            <label className="gantt2__drawer-field">
              <span className="gantt2__drawer-label">Окончание</span>
              <GanttDateField
                className="gantt2__drawer-input gantt2__drawer-input--date"
                value={finish}
                disabled={row.kind === "summary"}
                ariaLabel="Окончание"
                onChange={setFinish}
                onBlurCommit={(label) => commit("finish", label)}
              />
            </label>
          </div>

          <div className="gantt2__drawer-grid-2">
            <label className="gantt2__drawer-field">
              <span className="gantt2__drawer-label">Длительность</span>
              <input
                className="gantt2__drawer-input"
                value={duration}
                disabled={row.kind === "milestone" || row.kind === "summary"}
                onChange={(e) => setDuration(e.target.value)}
                onBlur={() => commit("duration", duration)}
              />
            </label>

            <label className="gantt2__drawer-field">
              <span className="gantt2__drawer-label">Прогресс</span>
              <input
                className="gantt2__drawer-input"
                value={progress}
                disabled={row.kind !== "task"}
                onChange={(e) => setProgress(e.target.value)}
                onBlur={() => commit("progress", progress)}
              />
            </label>
          </div>

          <label className="gantt2__drawer-field">
            <span className="gantt2__drawer-label">Трудозатраты</span>
            <input
              className="gantt2__drawer-input"
              value={workHours}
              disabled={row.kind !== "task"}
              title="ч"
              onChange={(e) => setWorkHours(e.target.value)}
              onBlur={() => commit("work", workHours)}
            />
            {row.kind === "task" ? (
              <span className="gantt2__drawer-hint">
                {row.hoursPerDay ?? 8} ч/день · режим {row.effortMode === "custom" ? "ручной" : "авто"}
                {row.plannedWork != null || row.actualWork != null
                  ? ` · API план/факт ${row.plannedWork ?? 0}/${row.actualWork ?? 0} мин`
                  : ""}
              </span>
            ) : null}
          </label>

          <div className="gantt2__drawer-field">
            <span className="gantt2__drawer-label">Ресурсы</span>
            {row.kind === "task" && onAssignResource ? (
              <GanttResourcePicker
                value={resource}
                triggerClassName="gantt2__drawer-input"
                onAssign={(res) => {
                  onAssignResource(row.id, res);
                  setResource(res?.initials ?? "");
                }}
              />
            ) : (
              <span className="gantt2__drawer-value">—</span>
            )}
          </div>

          <div className="gantt2__drawer-field gantt2__drawer-field--wide">
            <span className="gantt2__drawer-label">Предшественники</span>
            {preds.length === 0 ? (
              <span className="gantt2__drawer-value">{row.predecessors ?? "—"}</span>
            ) : (
              <ul className="gantt2__drawer-dep-list">
                {preds.map((dep) => (
                  <li key={dep.id} className="gantt2__drawer-dep-item">
                    <select
                      className="gantt2__drawer-select"
                      value={dep.type ?? "FS"}
                      aria-label="Тип связи"
                      title="Тип связи"
                      onChange={(e) =>
                        onUpdateDependency(dep.id, { type: e.target.value as GanttDependencyType })
                      }
                    >
                      {DEP_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <div className="gantt2__drawer-dep-lag">
                      <span className="gantt2__drawer-label">Опережение/запаздывание, дн</span>
                      <input
                        className="gantt2__drawer-input"
                        type="number"
                        value={dep.lagDays ?? 0}
                        title="Опережение/запаздывание, дни"
                        onChange={(e) =>
                          onUpdateDependency(dep.id, { lagDays: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="gantt2__drawer-hint">
              Новые связи создаются перетаскиванием маркеров на концах полос задач. Пересчёт сроков — только
              предпросмотр, серверный движок ещё не подключён.
            </p>
          </div>

          <label className="gantt2__drawer-field gantt2__drawer-field--wide">
            <span className="gantt2__drawer-label">Описание</span>
            <textarea
              className="gantt2__drawer-textarea"
              rows={3}
              value={notes}
              placeholder="Заметки по задаче"
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => commit("notes", notes)}
            />
          </label>
        </div>
      ) : null}

      <footer className="gantt2__drawer-foot">
        <div className="gantt2__drawer-foot-actions">
          {onOpenTaskCard ? (
            <Button variant="primary" size="sm" type="button" onClick={onOpenTaskCard}>
              Открыть карточку задачи
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </footer>
    </aside>
  );
}
