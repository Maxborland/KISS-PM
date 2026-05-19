import { useState } from "react";

import type { Opportunity, OpportunityFinalStatus } from "./api";
import { getErrorMessage } from "./workspaceShellState";
import { Modal } from "./components/workspace-ui";

export function DealFinalActionModal(props: {
  action: OpportunityFinalStatus;
  error: string;
  isSaving: boolean;
  opportunity: Opportunity;
  onClose: () => void;
  onSubmit: (input: { status: OpportunityFinalStatus; reason: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState(props.error);
  const [reasonError, setReasonError] = useState("");
  const isLost = props.action === "lost_rejected";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    setFormError("");
    setReasonError("");
    if (!normalizedReason) {
      setReasonError("Укажите причину решения.");
      return;
    }

    try {
      await props.onSubmit({
        status: props.action,
        reason: normalizedReason
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <Modal
      title={isLost ? "Отклонить сделку" : "Закрыть как выигранную"}
      description="Это управляемое финальное действие: сделка будет заблокирована для изменений, а причина попадет в аудит."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={submit}>
        <div className="danger-callout neutral">
          <strong>{props.opportunity.title}</strong>
          <span>
            {props.opportunity.clientName} · {props.opportunity.plannedHours} ч
          </span>
        </div>
        <label htmlFor="deal-final-reason">
          Причина решения
          <textarea
            id="deal-final-reason"
            aria-invalid={Boolean(reasonError)}
            data-autofocus
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {reasonError ? <span className="field-error">{reasonError}</span> : null}
        </label>
        {formError ? <p className="error" role="alert">{formError}</p> : null}
        <div className="form-actions">
          <button
            className={isLost ? "danger-button" : "primary-button"}
            disabled={props.isSaving}
            type="submit"
          >
            {props.isSaving
              ? "Фиксируем..."
              : isLost ? "Отклонить сделку" : "Закрыть сделку"}
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
      </form>
    </Modal>
  );
}
