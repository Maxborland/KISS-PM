"use client";

import { useState } from "react";

import { Dialog, DialogContent } from "../../../components/ui/dialog";

export function AcceptRiskDialog(props: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent title="Принять риск перегруза" onClose={props.onClose}>
        <label>
          Обоснование
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} required />
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={reason.trim().length === 0}
          onClick={() => void props.onConfirm(reason.trim())}
        >
          Применить сценарий
        </button>
      </DialogContent>
    </Dialog>
  );
}
