"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceState } from "@/components/domain/surface-state";
import { CommsFrame, type CommsTab } from "@/communications/ui/comms-frame";
import { commsErr } from "@/communications/lib/comms-bits";
import { useCommsProjects } from "@/communications/lib/use-comms";
import type { CommsProject, EntityType } from "@/communications/lib/comms-client";

/* ============================================================
   Реальный scope для entity-привязанных поверхностей коммуникаций
   (чат/звонки/встречи) вместо прежнего hardcode демо-проекта proj-portal,
   из-за которого поверхности были мертвы на живых данных (G5-01..03, G8-07).

   Выбранный проект: ?project=<id> в URL (deep-link) → иначе первый активный
   проект воркспейса. Переключение — селектором в шапке области, выбор
   синхронизируется в URL через history.replaceState (без перезагрузки).
   ============================================================ */

export type ResolvedCommsScope = {
  entityType: EntityType;
  entityId: string;
  /** Человеческое название проекта для подзаголовков (вместо сырого type/id). */
  title: string;
  /** Селектор проекта — поверхность кладёт его в actions CommsFrame. */
  picker: ReactNode;
};

function readProjectParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("project");
}

function writeProjectParam(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("project", id);
  window.history.replaceState(null, "", url);
}

function ScopePicker({ projects, selectedId, onSelect }: { projects: CommsProject[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-[length:var(--text-sm)] text-[var(--muted)]">
      Проект
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="max-w-[16rem] truncate rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[length:var(--text-sm)] text-[var(--text-strong)]"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.title}</option>
        ))}
      </select>
    </label>
  );
}

/** Состояние резолва проект-scope для поверхностей, живущих и БЕЗ него (чат: DM-ось). */
export type CommsScopeState = {
  scope: ResolvedCommsScope | null;
  status: "loading" | "ready" | "error" | "forbidden";
  error: string | null;
  reload: () => void | Promise<void>;
};

/**
 * Резолв проект-scope как хук: scope-или-null + состояние загрузки проектов.
 * Для поверхностей, у которых есть не-проектная ось (DM в чате) и которые
 * не должны прятаться за гейтом целиком.
 */
export function useCommsEntityScope(
  input: { explicitEntityType?: EntityType; explicitEntityId?: string } = {}
): CommsScopeState {
  const projectsLoad = useCommsProjects();
  // Выбор пользователя в рамках сессии; стартуем с ?project= из URL (deep-link).
  const [chosenId, setChosenId] = useState<string | null>(readProjectParam);

  const projects = projectsLoad.data?.projects ?? [];
  const selected = projects.find((p) => p.id === chosenId) ?? projects[0] ?? null;

  const onSelect = useCallback((id: string) => {
    setChosenId(id);
    writeProjectParam(id);
  }, []);

  const picker =
    selected && projects.length > 1 ? <ScopePicker projects={projects} selectedId={selected.id} onSelect={onSelect} /> : null;

  // Явный scope (stories/тесты/встраивание в карточку сущности) — без резолва и селектора.
  if (input.explicitEntityType && input.explicitEntityId) {
    return {
      scope: { entityType: input.explicitEntityType, entityId: input.explicitEntityId, title: input.explicitEntityId, picker: null },
      status: "ready",
      error: null,
      reload: () => {}
    };
  }
  return {
    scope: selected ? { entityType: "project", entityId: selected.id, title: selected.title, picker } : null,
    status: projectsLoad.status,
    error: projectsLoad.error,
    reload: projectsLoad.reload
  };
}

/**
 * Резолвит проект-scope и рендерит children только когда scope определён.
 * Пока проекты грузятся / ошибка / нет проектов — рендерит CommsFrame с
 * соответствующим состоянием сам (children не вызывается).
 * Явные entityType/entityId (stories, тесты, встраивание) отключают резолв.
 */
export function WithCommsEntityScope({
  activeTab,
  explicitEntityType,
  explicitEntityId,
  children
}: {
  activeTab: CommsTab;
  explicitEntityType?: EntityType;
  explicitEntityId?: string;
  children: (scope: ResolvedCommsScope) => ReactNode;
}) {
  const state = useCommsEntityScope({
    ...(explicitEntityType ? { explicitEntityType } : {}),
    ...(explicitEntityId ? { explicitEntityId } : {})
  });

  if (!state.scope) {
    return (
      <CommsFrame activeTab={activeTab}>
        <SurfaceState
          status={state.status}
          error={state.error}
          onRetry={() => void state.reload()}
          errorFormat={commsErr}
          loadingLabel="Определяем проект…"
          forbidden={{ title: "Нет доступа к проектам", description: "Коммуникации привязаны к проектам, а у вас нет прав на их просмотр." }}
        >
          <EmptyState
            title="Пока нет проектов"
            description="Коммуникации привязаны к проекту. Проекты появляются активацией сделки из CRM: выиграйте сделку — и здесь откроются её беседы, звонки и встречи."
            action={
              <Button asChild variant="default">
                <Link href="/crm/deals">К сделкам</Link>
              </Button>
            }
          />
        </SurfaceState>
      </CommsFrame>
    );
  }

  return <>{children(state.scope)}</>;
}
