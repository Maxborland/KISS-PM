"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";

import type { PlanningPermissions } from "../hooks/usePlanningPermissions";

export function AssignmentsMatrix(props: {
  readModel: PlanningReadModel | undefined;
  permissions: PlanningPermissions;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
}) {
  const assignments = props.readModel?.authored.assignments ?? [];
  const readOnly = !props.permissions.canManageProjectResources;

  return (
    <section className="planning-pane" data-testid="planning-assignments-pane">
      <h2>Назначения</h2>
      <table className="planning-assignments-table">
        <thead>
          <tr>
            <th>Задача</th>
            <th>Ресурс</th>
            <th>Units, ‰</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment) => (
            <tr key={String(assignment.id)}>
              <td>{String(assignment.taskId)}</td>
              <td>{String(assignment.resourceId)}</td>
              <td>
                <input
                  className="planning-cell-input"
                  type="number"
                  defaultValue={Number(assignment.unitsPermille ?? 1000)}
                  readOnly={readOnly}
                  title={readOnly ? "Нужно право tenant.project_resources.manage" : undefined}
                  onBlur={(event) => {
                    if (readOnly) return;
                    const unitsPermille = Number(event.target.value);
                    if (!Number.isFinite(unitsPermille) || unitsPermille <= 0) return;
                    void props.onPreviewCommand({
                      type: "assignment.upsert",
                      payload: {
                        id: String(assignment.id),
                        taskId: String(assignment.taskId),
                        resourceId: String(assignment.resourceId),
                        role: assignment.role as "executor",
                        unitsPermille,
                        workMinutes: (assignment.workMinutes as number | null) ?? null
                      }
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
