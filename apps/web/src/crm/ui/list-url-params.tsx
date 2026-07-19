"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useUrlPeekParamCleaner } from "@/workspace/lib/url-peek";

/**
 * Резолв URL-параметра списочной поверхности CRM (`?entity=<id>` — подсветка строки
 * из глобального поиска, `?client=<id>` — фильтр по клиенту из счётчиков «Клиентов»).
 * Паттерн DealDeepLinkResolver: null-компонент, монтируемый ТОЛЬКО в ready-ветке
 * поверхности — useSearchParams вне её заставил бы Next требовать Suspense-границу
 * при prerender. Каждое значение резолвим один раз; несуществующий id — честно
 * снимаем параметр replace-ом и сообщаем toast'ом (не подсвечиваем «ничего» молча).
 */
export function CrmListParamResolver({ param, knownIds, setValue, notFoundMessage }: {
  param: string;
  knownIds: ReadonlySet<string>;
  setValue: (id: string | null) => void;
  notFoundMessage: string;
}) {
  // В Next это App Router-параметры; в Storybook (без App Router) хук отдаёт null —
  // тогда эффект читает window.location.search (fallback как в useUrlPeek).
  const searchParams = useSearchParams();
  const clearParam = useUrlPeekParamCleaner(param);
  const resolvedRef = useRef<string | null>(null);

  useEffect(() => {
    const search = searchParams ? searchParams.toString() : window.location.search;
    const raw = new URLSearchParams(search).get(param);
    if (resolvedRef.current === raw) return;
    resolvedRef.current = raw;
    if (!raw) { setValue(null); return; }
    if (!knownIds.has(raw)) {
      clearParam();
      setValue(null);
      toast.error(notFoundMessage);
      return;
    }
    setValue(raw);
  }, [clearParam, knownIds, notFoundMessage, param, searchParams, setValue]);

  return null;
}

/**
 * Честная плашка активного URL-фильтра: что отфильтровано + рабочая кнопка сброса
 * (снимает параметр с адреса replace-ом и чистит локальное состояние поверхности).
 * Монтируется только при активном фильтре — то есть в ready-ветке (см. выше).
 */
export function CrmListFilterChip({ param, label, onReset }: {
  param: string;
  label: string;
  onReset: () => void;
}) {
  const clearParam = useUrlPeekParamCleaner(param);
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <Chip variant="info">{label}</Chip>
      <Button variant="ghost" size="sm" onClick={() => { clearParam(); onReset(); }}>
        <X className="size-3.5" aria-hidden />Сбросить фильтр
      </Button>
    </div>
  );
}

/**
 * ref-колбэк подсвеченной строки: одноразовый scrollIntoView при появлении
 * (повторные рендеры той же подсветки не дёргают прокрутку).
 */
export function useHighlightRowRef(highlightId: string | null) {
  const scrolledForRef = useRef<string | null>(null);
  return useCallback((node: HTMLElement | null) => {
    if (!node || !highlightId || scrolledForRef.current === highlightId) return;
    scrolledForRef.current = highlightId;
    node.scrollIntoView({ block: "center" });
  }, [highlightId]);
}

/** Классы подсветки строки для deep-link `?entity=` — единый вид на всех списках CRM. */
export const highlightRowCls = "bg-[var(--accent-soft)]";
