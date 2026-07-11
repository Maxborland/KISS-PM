"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

/* ============================================================
   FormDialog — жизненный цикл модальной формы одним компонентом:
   open/busy/formError, submit → onSubmit (строка = ошибка В модалке,
   null = успех: toast + закрытие + onSuccess). Поля, валидность и
   их сброс остаются у родителя — формы различаются именно этим.

   Управление открытием: либо trigger (кнопка, неуправляемый режим),
   либо open/onOpenChange (управляемый, для «диалог по target»).
   ============================================================ */

export function DialogError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft,var(--panel-subtle))] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--danger-text,var(--danger))]"
    >
      {text}
    </p>
  );
}

export type FormDialogProps = {
  title: string;
  description?: ReactNode;
  /** Кнопка-триггер (неуправляемый режим). */
  trigger?: ReactNode;
  /** Управляемый режим (диалог «по target»). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Подпись действия (иконка+текст). */
  submitLabel: ReactNode;
  /** Валидность формы — от родителя. */
  submitDisabled?: boolean;
  /**
   * Сабмит: null — успех (toast + закрытие + onSuccess), строка — готовый
   * RU-текст ошибки, остаётся В модалке (G4-05).
   */
  onSubmit: () => Promise<string | null>;
  successToast?: string;
  /** Сброс полей у родителя после успеха/закрытия. */
  onSuccess?: () => void;
  onClose?: () => void;
  cancelLabel?: string;
  contentClassName?: string;
  children: ReactNode;
};

export function FormDialog({
  title,
  description = "Заполните поля и подтвердите действие.",
  trigger,
  open,
  onOpenChange,
  submitLabel,
  submitDisabled = false,
  onSubmit,
  successToast,
  onSuccess,
  onClose,
  cancelLabel = "Отмена",
  contentClassName = "max-w-[560px]",
  children
}: FormDialogProps) {
  const controlled = open !== undefined;
  const [innerOpen, setInnerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isOpen = controlled ? open : innerOpen;

  const setOpen = (next: boolean) => {
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
    if (next) setFormError(null);
    else onClose?.();
  };

  const submit = async () => {
    setBusy(true);
    setFormError(null);
    const error = await onSubmit();
    setBusy(false);
    if (error !== null) {
      setFormError(error);
      return;
    }
    if (successToast) toast.success(successToast);
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogError text={formError} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{cancelLabel}</Button>
          </DialogClose>
          <Button variant="default" disabled={submitDisabled || busy} onClick={() => void submit()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
