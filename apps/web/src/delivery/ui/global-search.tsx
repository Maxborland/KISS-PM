"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { cn } from "@/lib/cn";

/* ============================================================
   Глобальный поиск в шапке рабочей области — живой GET /api/workspace/search
   (заменяет disabled-заглушку «Поиск появится в следующей версии», G2-01).
   Дебаунс 300мс, минимум 2 символа (контракт API), результаты с переходом
   на реальные страницы (route отдаёт API). Esc/клик мимо — закрыть.
   ============================================================ */

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  snippet: string;
  route: string;
};

const TYPE_RU: Record<string, string> = {
  project: "Проект",
  task: "Задача",
  opportunity: "Сделка",
  client: "Клиент",
  contact: "Контакт",
  product: "Продукт",
  file: "Файл",
  external_reference: "Ссылка",
  document: "Документ",
  decision: "Решение",
  knowledge_action_item: "Поручение"
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Монотонный номер запроса: применяем только ответ на ПОСЛЕДНИЙ ввод.
  const seqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(() => {
      fetch(`/api/workspace/search?q=${encodeURIComponent(q)}&limit=10`, { credentials: "include" })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          return (await r.json()) as { results: SearchResult[] };
        })
        .then((body) => {
          if (seq !== seqRef.current) return;
          // Страниц базы знаний в web ещё нет — результаты с /knowledge/-маршрутами
          // вели бы в 404 (ревью PR #224). Снимем фильтр вместе с появлением страниц.
          const routable = body.results.filter((r) => !r.route.includes("/knowledge/"));
          setResults(routable);
          setError(null);
          setActiveIndex(routable.length ? 0 : -1);
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setResults(null);
          setError("Поиск сейчас недоступен");
        })
        .finally(() => { if (seq === seqRef.current) setBusy(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Клик мимо — закрыть выпадашку.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(r.route);
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative max-w-md flex-1">
      <label className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 text-[var(--muted)] focus-within:border-[var(--accent)] [@media(pointer:coarse)]:min-h-[var(--touch-target)]">
        <Search className="size-4 shrink-0" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent text-[length:var(--text-sm)] text-[var(--text)] outline-none placeholder:text-[var(--muted-soft)]"
          placeholder="Поиск: проекты, задачи, сделки, клиенты…"
          role="combobox"
          aria-expanded={showPanel}
          aria-label="Глобальный поиск"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); return; }
            if (!results?.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) { e.preventDefault(); go(results[activeIndex]); }
          }}
        />
        {busy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
      </label>

      {showPanel ? (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-50 max-h-[420px] overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] py-1 shadow-[var(--shadow-lg)]">
          {error ? (
            <p className="px-3 py-2 text-[length:var(--text-sm)] text-[var(--danger-text,var(--danger))]">{error}</p>
          ) : results && results.length === 0 ? (
            <p className="px-3 py-2 text-[length:var(--text-sm)] text-[var(--muted)]">Ничего не найдено по «{query.trim()}»</p>
          ) : results ? (
            results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => go(r)}
                className={cn(
                  "flex w-full items-baseline gap-2 px-3 py-2 text-left [@media(pointer:coarse)]:min-h-[var(--touch-target)]",
                  i === activeIndex ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--panel-subtle)]"
                )}
              >
                <span className="shrink-0 rounded-full bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">
                  {TYPE_RU[r.type] ?? r.type}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{r.title}</span>
                  {r.subtitle ? <span className="block truncate text-[length:var(--text-xs)] text-[var(--muted)]">{r.subtitle}</span> : null}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-[length:var(--text-sm)] text-[var(--muted)]">Ищем…</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
