"use client";

import { useState } from "react";

import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PlanningSelect, PlanningSelectLabel } from "../../components/ui/select";
import { AbsenceTypeSelect } from "./AbsenceTypeSelect";
import type { AbsenceType } from "./absenceTypes";
import type { CreateAbsenceInput } from "./useAbsences";

export function AbsenceCreateDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: Array<{ id: string; name: string }>;
  onSubmit: (input: CreateAbsenceInput) => Promise<unknown>;
}) {
  const [userId, setUserId] = useState(props.users[0]?.id ?? "");
  const [type, setType] = useState<AbsenceType>("vacation");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent title="Новое отсутствие" onClose={() => props.onOpenChange(false)}>
        <form
          className="absences-create-form"
          data-testid="absence-create-dialog"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            void props
              .onSubmit({
                userId,
                type,
                dateFrom,
                dateTo,
                reason: reason.trim() || null
              })
              .then(() => props.onOpenChange(false))
              .catch((submitError) => {
                setError(submitError instanceof Error ? submitError.message : "save_failed");
              });
          }}
        >
          <label>
            <PlanningSelectLabel>Сотрудник</PlanningSelectLabel>
            <PlanningSelect
              aria-label="Сотрудник"
              value={userId}
              onChange={setUserId}
              options={props.users.map((user) => ({ value: user.id, label: user.name }))}
            />
          </label>
          <label>
            <PlanningSelectLabel>Тип</PlanningSelectLabel>
            <AbsenceTypeSelect value={type} onChange={setType} />
          </label>
          <label>
            Дата начала
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required />
          </label>
          <label>
            Дата окончания
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} required />
          </label>
          <label>
            Причина
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {error ? <p className="planning-pane__alert">{error}</p> : null}
          <button className="primary-button" type="submit">
            Сохранить
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
