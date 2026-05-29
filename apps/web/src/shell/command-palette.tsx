"use client";

import { useEffect, useState } from "react";

import { CommandDialog, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command-dialog";
import { SearchPill } from "@/components/ui/search-pill";

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <SearchPill
        readOnly
        placeholder="Поиск задач, проектов, людей…"
        shortcut={null}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        className="cursor-pointer"
        aria-label="Открыть поиск (Ctrl/⌘ K)"
      />
      <CommandDialog open={open} onOpenChange={setOpen} title="Командная палитра">
        <CommandEmpty>Ничего не найдено</CommandEmpty>
        <CommandGroup heading="Навигация">
          <CommandItem onSelect={() => setOpen(false)}>Дашборд</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Моя работа</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Сделки</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Проекты</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Справочники</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Отчёты</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Настройки</CommandItem>
        </CommandGroup>
      </CommandDialog>
    </>
  );
}
