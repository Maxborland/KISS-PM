"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Dialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={props.open} onOpenChange={props.onOpenChange}>
      {props.children}
    </DialogPrimitive.Root>
  );
}

export function DialogContent(props: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="planning-dialog-overlay" />
      <DialogPrimitive.Content className="planning-dialog-content" aria-describedby={undefined}>
        <DialogPrimitive.Title>{props.title}</DialogPrimitive.Title>
        {props.children}
        {props.onClose ? (
          <button className="secondary-button" type="button" onClick={props.onClose}>
            Закрыть
          </button>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
