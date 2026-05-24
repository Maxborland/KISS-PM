"use client";

import type { ReactNode } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type CommandDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  placeholder?: string;
  children: ReactNode;
};

export function CommandDialog({
  open,
  onOpenChange,
  title = "Команды",
  description = "Быстрый переход и действия",
  placeholder = "Поиск…",
  children
}: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" showCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="rounded-none border-0">
          <CommandInput placeholder={placeholder} />
          <CommandList>{children}</CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export { CommandEmpty, CommandGroup, CommandItem };
