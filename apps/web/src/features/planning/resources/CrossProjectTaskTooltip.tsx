"use client";

import type { CrossProjectTask } from "./useCrossProjectTasks";

export function CrossProjectTaskTooltip(props: {
  isVisible: boolean;
  isLoading: boolean;
  error: string | null;
  tasks: CrossProjectTask[] | null;
  position: { top: number; left: number } | null;
}) {
  if (!props.isVisible || !props.position) return null;

  return (
    <div
      className="planning-resource-tooltip"
      role="tooltip"
      style={{
        position: "fixed",
        top: props.position.top,
        left: props.position.left,
        zIndex: 50,
        background: "var(--card, #111827)",
        border: "1px solid var(--border, #334155)",
        borderRadius: 8,
        padding: 8,
        maxWidth: 320
      }}
      data-testid="resource-day-tooltip"
    >
      {props.isLoading ? <span>Загружаем задачи...</span> : null}
      {props.error ? <span className="planning-pane__alert">Ошибка: {props.error}</span> : null}
      {!props.isLoading && !props.error ? (
        props.tasks && props.tasks.length > 0 ? (
          <ul>
            {props.tasks.slice(0, 12).map((task) => (
              <li key={task.id}>
                <strong>{task.projectTitle}:</strong> {task.title} · {Math.round(task.workMinutes / 60)} ч
              </li>
            ))}
            {props.tasks.length > 12 ? <li>… ещё {props.tasks.length - 12}</li> : null}
          </ul>
        ) : (
          <span className="planning-pane__muted">Нет задач в этот день</span>
        )
      ) : null}
    </div>
  );
}
