"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

export type PrototypeDialogProps = {
  /** Кнопка-триггер. Можно опустить вместе с `defaultOpen` для витрины. */
  trigger?: ReactNode;
  defaultOpen?: boolean;
  title: string;
  description?: string;
  /** Явная пометка прототипа внутри модалки. */
  note?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
};

/**
 * Реальная модалка (Dialog/overlay) для флагманских create-сценариев каркаса.
 * Содержит видимый маркер «прототип», чтобы форма не выдавалась за рабочую
 * (§6 DESIGN_CONTRACT + честность прототипа). Сама форма ничего не сохраняет.
 */
export function PrototypeDialog({
  trigger,
  defaultOpen,
  title,
  description,
  note = "Прототип · форма не сохраняется",
  children,
  footer,
  contentClassName
}: PrototypeDialogProps) {
  return (
    <Dialog defaultOpen={defaultOpen ?? false}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <p className="proto-note">
          <Info className="size-3.5" aria-hidden />
          {note}
        </p>
        {children}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
