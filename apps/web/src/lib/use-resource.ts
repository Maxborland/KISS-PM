"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";

import { DomainApiError } from "./domain-client";

/* ============================================================
   Общий load-state примитив доменных хуков: data/status/error +
   загрузка с разводкой 403→forbidden. Заменяет рукописный квартет
   useState+load()+useEffect, который каждый домен копировал у соседа.

   Вариации остаются у вызывающего: loader — произвольный колбэк
   (Promise.all по спискам, толерантные catch'и на под-запросах,
   пост-обработка) — примитив владеет только жизненным циклом.
   ============================================================ */

// forbidden — реальное состояние: 403 (permission_missing) от боевого RBAC.
export type LoadStatus = "loading" | "ready" | "error" | "forbidden";

export type ResourceState<T> = {
  data: T | null;
  status: LoadStatus;
  error: string | null;
  setData: Dispatch<SetStateAction<T | null>>;
  reload: () => Promise<void>;
};

export function useResource<T>(loader: () => Promise<T>): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const next = await loader();
      setData(next);
      setStatus("ready");
      setError(null);
    } catch (e) {
      if (e instanceof DomainApiError && e.status === 403) {
        setStatus("forbidden");
        setError(e.code);
        return;
      }
      setStatus("error");
      setError(e instanceof DomainApiError ? e.code : e instanceof Error ? e.message : "load_failed");
    }
  }, [loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, status, error, setData, reload };
}
