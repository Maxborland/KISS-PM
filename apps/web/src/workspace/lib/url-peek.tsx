"use client";

import { useCallback, useContext, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
// ВНИМАНИЕ, ХРУПКИЙ ИМПОРТ: AppRouterContext — внутренний модуль Next.js без семвер-гарантий
// (путь может поменяться при обновлении Next). Он нужен ЕДИНСТВЕННО для Storybook-fallback:
// вне App Router контекст равен null, и peek переключается на window.history. Держим импорт
// ТОЛЬКО здесь — все URL-peek (TaskPeek, DealPeek, …) обязаны идти через useUrlPeek.
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type BrowserLocation = {
  pathname: string;
  search: string;
  hash: string;
};

const SERVER_LOCATION: BrowserLocation = { pathname: "", search: "", hash: "" };

function browserLocation(): BrowserLocation {
  if (typeof window === "undefined") return SERVER_LOCATION;
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash };
}

function useBrowserLocation() {
  const [location, setLocation] = useState<BrowserLocation>(browserLocation);
  const sync = useCallback(() => setLocation(browserLocation()), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [sync]);

  return [location, sync] as const;
}

/**
 * URL-управляемое открытие peek-панели: `?<param>=<id>` в адресе ⇔ панель открыта.
 * Открытие — push (back закрывает панель), закрытие — replace (без мусора в истории).
 * Внутри Next использует App Router; в Storybook (без App Router) — window.history.
 */
export function useUrlPeek(param: string, id: string): [boolean, (nextOpen: boolean) => void] {
  const router = useContext(AppRouterContext);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fallbackLocation, syncFallbackLocation] = useBrowserLocation();

  const useRouterLocation = router !== null && pathname !== null && searchParams !== null;
  const currentPathname = useRouterLocation ? pathname : fallbackLocation.pathname;
  const currentSearch = useRouterLocation ? searchParams.toString() : fallbackLocation.search;
  const currentHash = typeof window === "undefined" ? "" : window.location.hash;
  const open = new URLSearchParams(currentSearch).get(param) === id;

  const setOpen = useCallback((nextOpen: boolean) => {
    const params = new URLSearchParams(useRouterLocation ? searchParams.toString() : fallbackLocation.search);
    if (nextOpen) params.set(param, id);
    else params.delete(param);

    const query = params.toString();
    const href = `${currentPathname || "/"}${query ? `?${query}` : ""}${currentHash}`;
    if (useRouterLocation) {
      if (nextOpen) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
      return;
    }

    if (nextOpen) window.history.pushState(window.history.state, "", href);
    else window.history.replaceState(window.history.state, "", href);
    syncFallbackLocation();
  }, [currentHash, currentPathname, fallbackLocation.search, id, param, router, searchParams, syncFallbackLocation, useRouterLocation]);

  return [open, setOpen];
}

export type UrlPeekSheetProps = {
  /** Имя query-параметра (`task`, `deal`, …). */
  param: string;
  /** Значение параметра — id сущности; открыт ⇔ `?param=id`. */
  id: string;
  title: ReactNode;
  description: ReactNode;
  /** Канонический адрес полной страницы («Открыть полностью»). */
  fullHref: string;
  /** Один фокусируемый элемент — Radix SheetTrigger через asChild. */
  trigger: ReactElement;
  children: ReactNode;
};

/**
 * Общий каркас URL-peek: Sheet справа, заголовок + сводка, тело read-only,
 * футер «Открыть полностью» → каноническая страница. Escape/back закрывают,
 * фокус возвращается на триггер (Radix).
 */
export function UrlPeekSheet({ param, id, title, description, fullHref, trigger, children }: UrlPeekSheetProps): ReactElement {
  const [open, setOpen] = useUrlPeek(param, id);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <SheetBody>{children}</SheetBody>
        <SheetFooter>
          <Button asChild variant="secondary">
            <a href={fullHref}>Открыть полностью</a>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
