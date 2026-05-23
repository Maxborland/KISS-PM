"use client";

import { useState } from "react";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { Dialog, DialogContent } from "../../../components/ui/dialog";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";

export function CalendarsPane(props: {
  readModel: PlanningReadModel | undefined;
  permissions: PlanningPermissions;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const calendars = props.readModel?.authored ? (props.readModel as PlanningReadModel & { calendars?: unknown }).calculatedPlan : null;
  const calendarList = (props.readModel as { calendars?: Array<{ id: string }> } | undefined)?.calendars ?? [];
  const canManage = props.permissions.canManageProjectResources;

  return (
    <section className="planning-pane" data-testid="planning-calendars-pane">
      <h2>Календари</h2>
      <p className="planning-pane__muted">Календарей в снимке: {calendarList.length || (calendars ? 1 : 0)}</p>
      <button
        className="primary-button"
        type="button"
        disabled={!canManage}
        title={canManage ? undefined : "Нужно право tenant.project_resources.manage"}
        onClick={() => setIsOpen(true)}
      >
        Добавить исключение
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent title="Исключение календаря" onClose={() => setIsOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void props.onPreviewCommand({
                type: "calendar.exception.upsert",
                payload: {
                  id: `exception-${Date.now()}`,
                  calendarId: String(form.get("calendarId") || "calendar-default"),
                  resourceId: String(form.get("resourceId") || "") || null,
                  date: String(form.get("date")),
                  workingMinutes: Number(form.get("workingMinutes") ?? 0),
                  reason: String(form.get("reason") || "") || null
                }
              });
              setIsOpen(false);
            }}
          >
            <label>
              Дата
              <input name="date" type="date" required />
            </label>
            <label>
              Рабочие минуты
              <input name="workingMinutes" type="number" defaultValue={0} />
            </label>
            <label>
              Ресурс (опционально)
              <input name="resourceId" />
            </label>
            <label>
              Причина
              <input name="reason" />
            </label>
            <button className="primary-button" type="submit">
              Превью
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
