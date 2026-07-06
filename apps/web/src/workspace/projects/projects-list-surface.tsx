"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { SurfaceState } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { useProjects, useWorkspaceUsers } from "@/workspace/lib/use-workspace";
import type { ProjectRecord } from "@/workspace/lib/workspace-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

/* ============================================================
   Workspace — поверхность «Проекты» (список активных проектов
   рабочей области). Каркас: WorkspaceShell (левая навигация + топбар),
   внутренний экран рабочего пространства.

   ЧЕСТНОСТЬ:
   - Баннер «Прототип»: боевой контракт GET /api/workspace/projects
     (только status === "active"); транспорт — contract-mock,
     переключение на боевой = apiOrigin; данные in-memory.
   - Фильтр «Все/Активные»: контракт отдаёт ТОЛЬКО активные проекты,
     поэтому «Активные» — настоящий вид, а «Все» — демо-переключатель
     (архив/закрытые в этой ручке недоступны).
   - Клик по строке навигации НЕ выполняет (cursor-default + title):
     карточка проекта — отдельный экран рабочего приложения.

   Состояния — только через <SurfaceState> (loading/error/empty).
   ============================================================ */

type Filter = "active" | "all";

// Аватары/инициалы/цвет — по образцу deals-surface (детерминированно по справочнику).
const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
const initials = (name: string) => {
  const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
};

// Денежный форматтер — зеркало money() из crm-bits/deals-surface.
const money = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`
    : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс ₽`;

// ISO-дата (YYYY-MM-DD) → ДД.ММ.ГГГГ. Невалидную строку отдаём как есть.
const fmtDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

// RU-маппер кодов ошибок (локальный, как ERR_RU в deals-surface).
const ERR_RU: Record<string, string> = {
  load_failed: "Не удалось загрузить проекты",
  request_failed: "Запрос не выполнен",
  invalid_json_response: "Некорректный ответ сервера"
};
const projectsErr = (code?: string) => (code && ERR_RU[code]) || code || "Не удалось загрузить";

// Человекочитаемый статус проекта (боевой status — свободная строка; известные — переводим).
const STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  draft: "Черновик",
  closed: "Закрыт",
  archived: "Архив"
};
const statusVariant = (status: string) =>
  status === "active" ? "success" : status === "closed" || status === "archived" ? "danger" : "info";

export function ProjectsListSurface() {
  const usersDir = useWorkspaceUsers();
  const userColor = (id: string): BemAvatarColor => {
    const i = usersDir.indexOf(id);
    return i < 0 ? "c5" : AV[i % AV.length]!;
  };
  const { data, status, error, reload } = useProjects();
  const [filter, setFilter] = useState<Filter>("active");

  // Контракт отдаёт только активные → оба таба показывают один и тот же список.
  // «Активные» честно фильтрует по status==="active"; «Все» — демо (архив недоступен).
  const projects = useMemo<ProjectRecord[]>(() => {
    const all = data?.projects ?? [];
    return filter === "active" ? all.filter((p) => p.status === "active") : all;
  }, [data, filter]);

  // Статус поверхности: есть данные → ready; ошибка → error; иначе loading.
  // Пустой список активных проектов → empty.
  const surfaceStatus =
    status === "forbidden"
      ? "forbidden"
      : status === "error"
        ? "error"
        : data
          ? projects.length === 0
            ? "empty"
            : "ready"
          : "loading";

  return (
    <WorkspaceShell activeNav="Проекты">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />

        <div className="mb-3">
          <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Проекты</h1>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Активные проекты рабочей области</p>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Segmented
            name="projects-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Все" },
              { value: "active", label: "Активные" }
            ]}
          />
          {filter === "all" && prototypeNotesEnabled ? (
            <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">
              Демо-переключатель: GET /api/workspace/projects отдаёт только активные — архив/закрытые в этой ручке недоступны.
            </span>
          ) : null}
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={projectsErr}
          loadingLabel="Загрузка проектов…"
          empty={{
            title: "Нет проектов",
            description: "Проекты появляются активацией сделки из CRM: выиграйте сделку — и она станет проектом.",
            action: (
              <Button asChild variant="default">
                <Link href="/crm/deals">К сделкам</Link>
              </Button>
            )
          }}
        >
          <ProjectsTable projects={projects} userColor={userColor} />
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}

// Баннер честности «Прототип» (зеркало profile-/deals-surface).
function ProtoBanner() {
  if (!prototypeNotesEnabled) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        Боевой контракт: GET /api/workspace/projects (только активные проекты рабочей области). Транспорт — contract-mock;
        переключение на боевой = apiOrigin. Данные in-memory.
      </span>
    </div>
  );
}

// Таблица проектов: Проект · Клиент · Статус · Срок · Сумма · План.часы · Спрос.
function ProjectsTable({ projects, userColor }: { projects: ProjectRecord[]; userColor: (id: string) => BemAvatarColor }) {
  const router = useRouter();
  return (
    <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <table className="w-full border-collapse text-[length:var(--text-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
            <th className="px-3 py-2 font-semibold">Проект</th>
            <th className="px-3 py-2 font-semibold">Клиент</th>
            <th className="px-3 py-2 font-semibold">Статус</th>
            <th className="px-3 py-2 font-semibold">Срок</th>
            <th className="px-3 py-2 text-right font-semibold">Сумма</th>
            <th className="px-3 py-2 text-right font-semibold">План.часы</th>
            <th className="px-3 py-2 font-semibold">Спрос</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              className="v4-row cursor-pointer border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--panel-subtle)]"
              onClick={() => router.push(`/projects/${p.id}/overview`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/projects/${p.id}/overview`);
              }}
            >
              <td className="px-3 py-2">
                <div className="font-medium text-[var(--text-strong)]">{p.title}</div>
                {prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{p.id}</div> : null}
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <BemAvatar initials={initials(p.clientName)} color={userColor(p.clientId ?? p.clientName)} size="sm" title={p.clientName} />
                  <span className="text-[var(--muted-strong)]">{p.clientName}</span>
                </span>
              </td>
              <td className="px-3 py-2">
                <Chip variant={statusVariant(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Chip>
              </td>
              <td className="px-3 py-2">
                <span className="v4-num whitespace-nowrap text-[length:var(--text-xs)] text-[var(--muted-strong)]">
                  {fmtDate(p.plannedStart)} — {fmtDate(p.plannedFinish)}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="v4-num font-semibold text-[var(--text-strong)]">{money(p.contractValue)}</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="v4-num text-[var(--muted-strong)]">{p.plannedHours.toLocaleString("ru-RU")} ч</span>
              </td>
              <td className="px-3 py-2">
                {p.demand.length === 0 ? (
                  <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">—</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {p.demand.map((d) => (
                      <Chip key={d.positionId} variant="info">
                        {d.positionId} · {d.requiredHours} ч
                      </Chip>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
