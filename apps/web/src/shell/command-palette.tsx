"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CommandDialog, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command-dialog";
import { SearchPill } from "@/components/ui/search-pill";
import { NAV_LINKS } from "@/views/config/sidebar-nav";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

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
          {NAV_LINKS.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandDialog>
    </>
  );
}
