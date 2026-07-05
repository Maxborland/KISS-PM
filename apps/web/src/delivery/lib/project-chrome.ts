import { useEffect, useState } from "react";

import type { PlanningReadModel } from "@kiss-pm/planning-client";

import type { ProjectMeta } from "@/delivery/ui/delivery-frame";
import { usePlanningRuntime } from "@/delivery/lib/planning-runtime";

/**
 * Шапка проекта для состояний loading/error поверхностей Project Delivery —
 * нейтральная: без имени/finish/variance (их дают живые данные) и с прочерком
 * дедлайна, чтобы до загрузки данных ничего конкретного не утверждать.
 */
export const PROJECT_FALLBACK: ProjectMeta = {
  name: "Проект",
  code: "…",
  status: "В работе",
  statusTone: "info",
  planVersion: "",
  deadline: "—",
  finish: "—"
};

/* ============================================================
   Реальное название проекта в шапке (G3-01): read-model плана не несёт title,
   поэтому в live тянем GET /api/workspace/projects/:id и подменяем name/code
   базовой меты. В mock (stories, live=false) возвращаем mockBase без запросов.
   Кэш на модуль — шапка не мигает при переключении вкладок проекта.
   ============================================================ */
const projectTitleCache = new Map<string, string>();

const codeInitials = (title: string): string => {
  const words = title.replace(/[«»"']/g, "").split(/[\s·]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "ПР";
};

export function useProjectBase(projectId: string, mockBase: ProjectMeta): ProjectMeta {
  const { live } = usePlanningRuntime();
  const [title, setTitle] = useState<string | null>(() => projectTitleCache.get(projectId) ?? null);

  useEffect(() => {
    if (!live || projectTitleCache.has(projectId)) return;
    let active = true;
    void fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}`, { credentials: "include" })
      .then((r) => (r.ok ? (r.json() as Promise<{ project?: { title?: unknown } }>) : null))
      .then((d) => {
        const t = d?.project?.title;
        if (active && typeof t === "string" && t.length > 0) {
          projectTitleCache.set(projectId, t);
          setTitle(t);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [live, projectId]);

  if (!live) return mockBase;
  if (title) return { ...mockBase, name: title, code: codeInitials(title) };
  // Название ещё не загрузилось — нейтральная шапка вместо чужого мок-имени.
  return { ...mockBase, name: "Проект", code: "…" };
}

/**
 * RU-маппер кодов ошибок загрузки плана для <SurfaceState errorFormat>. Коды приходят
 * из usePlanning (load_failed) и из PlanningApiError.code/сетевых сообщений транспорта.
 * Неизвестный код отдаём как есть (или общий fallback).
 */
const PLANNING_ERR_RU: Record<string, string> = {
  project_not_found: "Проект не найден: возможно, он удалён или ссылка устарела",
  load_failed: "Не удалось загрузить план проекта",
  request_failed: "Запрос к планировщику не выполнен",
  invalid_json_response: "Некорректный ответ планировщика",
  plan_version_conflict: "Конфликт версий плана — обновите страницу",
  forbidden: "Нет прав на просмотр плана проекта"
};
export const planningErr = (code?: string): string =>
  (code && PLANNING_ERR_RU[code]) || code || "Не удалось загрузить план";

const ddmmyyyy = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
};
const dayOf = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/**
 * Живая шапка проекта из read-model: версия плана, расчётный финиш и дедлайн —
 * из реальных данных, variance — резерв/срыв к дедлайну. Чтобы шапка НЕ
 * противоречила содержимому (как в overview/settings). Заменяет старое
 * `{ ...PROJECT, planVersion }`, тянувшее статический finish «14.06.2026».
 */
export function deriveProjectMeta(readModel: PlanningReadModel, base: ProjectMeta): ProjectMeta {
  const project = readModel.project as { deadline?: unknown };
  const cp = readModel.calculatedPlan as { projectFinish?: unknown };
  const finishIso = typeof cp.projectFinish === "string" ? cp.projectFinish : null;
  const deadlineIso = typeof project.deadline === "string" ? project.deadline : null;
  const reserveDays = finishIso && deadlineIso ? dayOf(deadlineIso) - dayOf(finishIso) : null;
  const meta: ProjectMeta = {
    name: base.name,
    code: base.code,
    status: base.status,
    planVersion: `v${readModel.planVersion}`,
    deadline: ddmmyyyy(deadlineIso),
    finish: ddmmyyyy(finishIso)
  };
  if (base.statusTone) meta.statusTone = base.statusTone;
  if (reserveDays !== null) {
    meta.variance = reserveDays < 0
      ? { label: `+${-reserveDays} дн. к дедлайну`, tone: "danger" }
      : { label: `резерв ${reserveDays} дн. до дедлайна`, tone: "success" };
  }
  return meta;
}
