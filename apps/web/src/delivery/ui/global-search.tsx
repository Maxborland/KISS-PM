"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Compass, FileText, FolderKanban, Gavel, ListChecks, Loader2, Package, Plus, Search, SquareCheckBig, Target, UserRound } from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSessionState } from "@/shell/use-session-user";
import { getPaletteCommands, paletteRouteForSearchResult, type PaletteCommand } from "@/delivery/ui/workspace-commands";

const SEARCH_RESULT_TYPES = ["project", "task", "opportunity", "client", "contact", "product", "document", "decision", "knowledge_action_item"] as const;
type SearchResultType = (typeof SEARCH_RESULT_TYPES)[number];
type SearchResult = { id: string; type: SearchResultType; title: string; subtitle: string; snippet: string; route: string; entityId?: string };

const SEARCH_TYPES = SEARCH_RESULT_TYPES.join(",");
// Маршруты результатов — серверный searchRouting.ts: сделка/проект — карточка,
// клиент/контакт — список с подсветкой ?entity=, продукт — список продуктов (Р16),
// knowledge (документ/решение/пункт действий) — карточки /knowledge/... по result.route.
const RESULT_GROUPS: Array<{ type: SearchResultType; title: string; icon: typeof FolderKanban }> = [
  { type: "task", title: "Задачи", icon: SquareCheckBig },
  { type: "opportunity", title: "Сделки", icon: Target },
  { type: "project", title: "Проекты", icon: FolderKanban },
  { type: "client", title: "Клиенты", icon: Building2 },
  { type: "contact", title: "Контакты", icon: UserRound },
  { type: "product", title: "Продукты", icon: Package },
  { type: "document", title: "Документы", icon: FileText },
  { type: "decision", title: "Решения", icon: Gavel },
  { type: "knowledge_action_item", title: "Пункты действий", icon: ListChecks }
];

export function GlobalSearch() {
  const router = useRouter();
  const session = useSessionState();
  const commands = useMemo(() => getPaletteCommands({ loaded: session.loaded, permissions: session.user?.permissions ?? null }), [session]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const initiatorRef = useRef<HTMLElement | null>(null);
  const seqRef = useRef(0);

  const openPalette = useCallback((initiator?: HTMLElement | null) => {
    initiatorRef.current = initiator ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const changeOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (next) return;
    setQuery("");
    setResults(null);
    setError(null);
    setBusy(false);
    window.requestAnimationFrame(() => initiatorRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLocaleLowerCase("en-US") !== "k") return;
      event.preventDefault();
      if (open) changeOpen(false);
      else openPalette();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [changeOpen, open, openPalette]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let attempts = 0;
    const settleFocus = () => {
      const input = inputRef.current;
      input?.focus();
      if (input && document.activeElement !== input && attempts++ < 120) {
        frame = window.requestAnimationFrame(settleFocus);
      }
    };
    frame = window.requestAnimationFrame(settleFocus);
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    if (!open || normalized.length < 2 || !session.user) {
      seqRef.current += 1;
      setResults(null);
      setError(null);
      setBusy(false);
      return;
    }
    const seq = ++seqRef.current;
    const controller = new AbortController();
    setBusy(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: normalized, limit: "15", types: SEARCH_TYPES });
      void fetch(`/api/workspace/search?${params.toString()}`, { credentials: "include", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json() as Promise<{ results?: unknown }>;
        })
        .then((body) => {
          if (seq !== seqRef.current) return;
          setResults(Array.isArray(body.results) ? body.results.filter(isSearchResult) : []);
          setError(null);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || seq !== seqRef.current) return;
          setResults(null);
          setError(reason instanceof Error && reason.message === "403" ? "Недостаточно прав для поиска" : "Поиск сейчас недоступен. Измените запрос, чтобы повторить.");
        })
        .finally(() => { if (seq === seqRef.current) setBusy(false); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query, session.user]);

  const grouped = useMemo(() => RESULT_GROUPS.map((group) => ({ ...group, items: (results ?? []).filter((result) => result.type === group.type) })).filter((group) => group.items.length > 0), [results]);
  const navigate = (href: string) => { changeOpen(false); router.push(href); };
  const commandGroup = (title: string, items: PaletteCommand[], Icon: typeof Compass) => {
    if (!items.length) return null;
    return <CommandGroup key={title} heading={title}>
      {items.map((item) => <CommandItem key={item.id} value={`${item.label} ${(item.keywords ?? []).join(" ")}`} onSelect={() => navigate(item.href)}><Icon aria-hidden /><span className="min-w-0 flex-1 truncate">{item.label}</span><CommandShortcut>↵</CommandShortcut></CommandItem>)}
    </CommandGroup>;
  };

  return <>
    <button type="button" onClick={(event) => openPalette(event.currentTarget)} className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 text-left text-[var(--muted)] hover:border-[var(--border-strong)] focus-visible:shadow-[var(--ring-focus)] [@media(pointer:coarse)]:min-h-[var(--touch-target)]" aria-haspopup="dialog">
      <Search className="size-4 shrink-0" aria-hidden /><span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)]">Поиск и команды…</span>
      <kbd className="hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[length:var(--text-xs)] text-[var(--muted-soft)] sm:block" aria-hidden>Ctrl K</kbd>
    </button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-[640px] overflow-hidden p-0" showCloseButton={false} onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
        <DialogHeader className="sr-only"><DialogTitle>Поиск и команды</DialogTitle><DialogDescription>Быстрый переход и доступные действия</DialogDescription></DialogHeader>
        <Command className="rounded-none bg-[var(--panel)]">
          <CommandInput ref={inputRef} value={query} onValueChange={(value) => { setQuery(value); setResults(null); }} placeholder="Команда, проект, задача, сделка, клиент…" aria-label="Поиск и команды" />
          <CommandList className="max-h-[min(60dvh,420px)]">
            {!session.loaded ? <p className="flex items-center justify-center gap-2 px-4 py-8 text-[length:var(--text-sm)] text-[var(--muted)]" role="status"><Loader2 className="size-4 animate-spin" aria-hidden /> Проверяем доступные команды…</p> : !session.user ? <p className="px-4 py-8 text-center text-[length:var(--text-sm)] text-[var(--muted)]" role="status">Сессия недоступна — команды скрыты</p> : <>
              {commandGroup("Навигация", commands.navigation, Compass)}
              {query.trim().length >= 2 && (commands.navigation.length || commands.actions.length) ? <CommandSeparator /> : null}
              {query.trim().length < 2 ? <p className="px-4 py-3 text-center text-[length:var(--text-xs)] text-[var(--muted)]" role="status">Введите минимум два символа для поиска сущностей</p> : error ? <p className="px-4 py-8 text-center text-[length:var(--text-sm)] text-[var(--danger-text,var(--danger))]" role="alert">{error}</p> : busy && results === null ? <p className="flex items-center justify-center gap-2 px-4 py-8 text-[length:var(--text-sm)] text-[var(--muted)]" role="status" aria-live="polite"><Loader2 className="size-4 animate-spin" aria-hidden /> Ищем доступные результаты…</p> : <>
                {grouped.map((group) => { const Icon = group.icon; return <CommandGroup forceMount key={group.type} heading={group.title}>{group.items.map((result) => <CommandItem forceMount key={result.id} value={result.id} onSelect={() => navigate(paletteRouteForSearchResult(result))}><Icon aria-hidden /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{result.title}</span>{result.subtitle ? <span className="block truncate text-[length:var(--text-xs)] text-[var(--muted)]">{result.subtitle}</span> : null}</span><CommandShortcut>↵</CommandShortcut></CommandItem>)}</CommandGroup>; })}
                {results?.length === 0 ? <CommandEmpty>Ничего не найдено по «{query.trim()}»</CommandEmpty> : null}
              </>}
            </>}
              {commandGroup("Действия", commands.actions, Plus)}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  </>;
}

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return typeof result.id === "string" && (SEARCH_RESULT_TYPES as readonly string[]).includes(result.type as string) && typeof result.title === "string" && typeof result.subtitle === "string" && typeof result.snippet === "string" && typeof result.route === "string" && (result.entityId === undefined || typeof result.entityId === "string");
}
