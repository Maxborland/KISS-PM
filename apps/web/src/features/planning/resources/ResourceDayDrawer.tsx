"use client";

import { Dialog, DialogContent } from "../../../components/ui/dialog";
import type { CrossProjectTask } from "./useCrossProjectTasks";

export function ResourceDayDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName: string | null;
  date: string | null;
  tasks: CrossProjectTask[] | null;
  isLoading: boolean;
  error: string | null;
}) {
  const title =
    props.resourceName && props.date
      ? `${props.resourceName} · ${props.date}`
      : "Задачи дня";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent title={title} onClose={() => props.onOpenChange(false)}>
        <div data-testid="resource-day-drawer">
          {props.isLoading ? <p>Загружаем задачи...</p> : null}
          {props.error ? (
            <p className="planning-pane__alert">Ошибка: {props.error}</p>
          ) : null}
          {!props.isLoading && !props.error ? (
            props.tasks && props.tasks.length > 0 ? (
              <table className="custom-field-definitions">
                <thead>
                  <tr>
                    <th>Проект</th>
                    <th>Задача</th>
                    <th>Окно</th>
                    <th>Часы</th>
                  </tr>
                </thead>
                <tbody>
                  {props.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.projectTitle}</td>
                      <td>{task.title}</td>
                      <td>
                        {task.plannedStart} → {task.plannedFinish}
                      </td>
                      <td>{Math.round(task.workMinutes / 60)} ч</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="planning-pane__muted">Нет задач в этот день.</p>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
