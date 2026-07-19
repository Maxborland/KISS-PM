"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { subscribeToPlanEvents, type PlanEventSubscription, type PlanRealtimeEvent } from "@kiss-pm/planning-client";

import { Button } from "@/components/ui/button";

/** Тестовый шов: та же сигнатура, что у subscribeToPlanEvents (fake-источник вместо EventSource). */
export type PlanEventsSubscriber = (
  apiOrigin: string,
  projectId: string,
  callback: (event: PlanRealtimeEvent) => void
) => PlanEventSubscription;

/**
 * Подписка поверхности на SSE план-событий своего проекта
 * (GET /api/workspace/projects/:projectId/planning/events).
 *
 * Контракт:
 * - `planVersionChanged` с planVersion > клиентской → remotePlanVersion (поверхность показывает
 *   неблокирующий баннер «Обновить»; автоперезагрузки нет — пользователь может быть в редактировании);
 * - собственный apply не даёт баннера: к моменту события клиентская версия уже поднята ответом apply,
 *   event.planVersion <= клиентской. Если событие обогнало ответ apply, баннер снимется сам,
 *   как только клиентская версия догонит удалённую (эффект ниже);
 * - жизненный цикл: подписка на mount/смену projectId, отписка на unmount;
 * - деградация: без SSE (mock-режим enabled=false, нет EventSource, ошибка соединения) — молча
 *   работаем как раньше: баннера просто нет, никаких тостов (EventSource сам переподключается).
 */
export function usePlanVersionWatch(input: {
  projectId: string;
  /** SSE есть только у боевого API — в mock-режиме подписку не открываем. */
  enabled: boolean;
  /** planVersion клиентского read-model (null, пока план не загружен). */
  clientPlanVersion: number | null;
  subscribe?: PlanEventsSubscriber;
}): { remotePlanVersion: number | null } {
  const { projectId, enabled, clientPlanVersion } = input;
  const subscribe = input.subscribe ?? subscribeToPlanEvents;
  const [remotePlanVersion, setRemotePlanVersion] = useState<number | null>(null);
  // Актуальная клиентская версия для обработчика событий — без переподписки на каждый apply.
  const clientVersionRef = useRef(clientPlanVersion);
  clientVersionRef.current = clientPlanVersion;

  useEffect(() => {
    // Смена проекта: прежний баннер — про другой проект, снимаем в любом случае.
    setRemotePlanVersion(null);
    if (!enabled) return;
    const subscription = subscribe("", projectId, (event) => {
      if (event.type !== "planVersionChanged" || event.projectId !== projectId) return;
      const clientVersion = clientVersionRef.current;
      if (clientVersion == null || event.planVersion <= clientVersion) return;
      setRemotePlanVersion((current) =>
        current != null && current >= event.planVersion ? current : event.planVersion
      );
    });
    return () => subscription.unsubscribe();
  }, [enabled, projectId, subscribe]);

  // Клиент догнал удалённую версию (reload или собственный apply) — баннер больше не нужен.
  useEffect(() => {
    if (remotePlanVersion != null && clientPlanVersion != null && clientPlanVersion >= remotePlanVersion) {
      setRemotePlanVersion(null);
    }
  }, [clientPlanVersion, remotePlanVersion]);

  return { remotePlanVersion };
}

/**
 * Неблокирующий баннер «план обновлён другим пользователем». Общий для Графика и Сценариев —
 * один текст, без дублирования формулировок; note — поверхность-специфичное дополнение.
 */
export function PlanUpdatedBanner({
  version,
  note,
  onReload
}: {
  version: number;
  note?: string;
  onReload: () => void;
}) {
  return (
    <div
      role="status"
      data-testid="plan-updated-banner"
      className="mb-2 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--info-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--info)]"
    >
      <span>
        План обновлён другим пользователем (v{version}).
        {note ? <span className="text-[var(--muted-strong)]"> {note}</span> : null}
      </span>
      <Button variant="secondary" size="sm" onClick={onReload}>
        <RefreshCw className="size-3.5" aria-hidden />
        Обновить
      </Button>
    </div>
  );
}
