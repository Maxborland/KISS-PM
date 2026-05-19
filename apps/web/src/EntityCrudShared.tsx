import { PencilLine } from "lucide-react";
import { useState } from "react";

import type { Client } from "./api";
import type { FormErrors } from "./workspaceForms";
import type { SectionState } from "./workspaceShellState";
import { FieldError, StatusPill, SummaryCard } from "./components/workspace-ui";

export function EntitySummary(props: {
  total: number;
  active: number;
  archived: number;
}) {
  return (
    <div className="surface-summary-grid">
      <SummaryCard label="Всего" value={props.total} />
      <SummaryCard label="Активные" value={props.active} tone="success" />
      <SummaryCard label="Архив" value={props.archived} tone="muted" />
    </div>
  );
}

export function canRenderSectionTable(sectionState: SectionState): boolean {
  return sectionState.canRead && !sectionState.error && !sectionState.isLoading;
}

export function EntityNameCell(props: {
  avatar: string;
  primary: string;
  secondary: string;
}) {
  return (
    <span className="entity-name-cell">
      <span className="row-avatar">{props.avatar}</span>
      <span>
        <strong>{props.primary}</strong>
        <small>{props.secondary}</small>
      </span>
    </span>
  );
}

export function EntityActions(props: {
  canManage: boolean;
  entityId: string;
  onEdit: (entityId: string) => void;
}) {
  if (!props.canManage) return <span className="muted">Только просмотр</span>;

  return (
    <button
      className="secondary-button compact-action"
      type="button"
      onClick={() => props.onEdit(props.entityId)}
    >
      <PencilLine aria-hidden="true" size={14} />
      Редактировать
    </button>
  );
}

export function EntityStatusField(props: {
  defaultValue: Client["status"];
  fieldErrors: FormErrors;
  formId: string;
}) {
  return (
    <label htmlFor={`${props.formId}-status`}>
      Статус
      <select
        id={`${props.formId}-status`}
        name="status"
        aria-invalid={Boolean(props.fieldErrors.status)}
        defaultValue={props.defaultValue}
      >
        <option value="active">Активно</option>
        <option value="archived">Архив</option>
      </select>
      <FieldError formId={props.formId} field="status" errors={props.fieldErrors} />
    </label>
  );
}

export function ModalActions(props: {
  error: string;
  isSaving: boolean;
  primaryLabel: string;
  savingLabel: string;
  onClose: () => void;
}) {
  return (
    <>
      {props.error ? <p className="error">{props.error}</p> : null}
      <div className="form-actions">
        <button className="primary-button" disabled={props.isSaving} type="submit">
          {props.isSaving ? props.savingLabel : props.primaryLabel}
        </button>
        <button
          className="secondary-button"
          disabled={props.isSaving}
          type="button"
          onClick={props.onClose}
        >
          Отменить
        </button>
      </div>
    </>
  );
}

export function renderCrmStatus(status: Client["status"]) {
  return (
    <StatusPill
      tone={status === "active" ? "success" : "muted"}
      label={status === "active" ? "Активно" : "Архив"}
    />
  );
}

export function useEntityFormState() {
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  return {
    fieldErrors,
    formError,
    reset: () => {
      setFormError("");
      setFieldErrors({});
    },
    setFieldErrors,
    setFormError
  };
}
