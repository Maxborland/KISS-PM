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
  status: "—",
  statusTone: "info",
  planVersion: "",
  deadline: "—",
  finish: "—"
};

/* ============================================================
   Реальное название проекта в шапке (G3-01): read-model плана не несёт title,
   поэтому в live тянем active-only GET /api/workspace/projects/:id. Identity
   хранится только в состоянии экземпляра hook: module-cache здесь опасен,
   потому что projectId уникален лишь внутри tenant.
   ============================================================ */
type ProjectIdentity = {
  title: string;
  status: "active";
};

const codeInitials = (title: string): string => {
  const words = title.replace(/[«»"']/g, "").split(/[\s·]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "ПР";
};

export function useProjectBase(projectId: string, mockBase: ProjectMeta): ProjectMeta {
  const { live } = usePlanningRuntime();
  const [loaded, setLoaded] = useState<{ projectId: string; identity: ProjectIdentity } | null>(null);
  const identity = loaded?.projectId === projectId ? loaded.identity : null;

  useEffect(() => {
    if (!live) return;
    let active = true;
    void fetch("/api/workspace/projects/" + encodeURIComponent(projectId), { credentials: "include" })
      .then((response) => (
        response.ok
          ? (response.json() as Promise<{ project?: { title?: unknown; status?: unknown } }>)
          : null
      ))
      .then((data) => {
        const title = data?.project?.title;
        const status = data?.project?.status;
        if (active && typeof title === "string" && title.length > 0 && status === "active") {
          setLoaded({ projectId, identity: { title, status } });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [live, projectId]);

  if (!live) return mockBase;
  if (identity) {
    return {
      ...mockBase,
      name: identity.title,
      code: codeInitials(identity.title),
      status: "В работе",
      statusTone: "info"
    };
  }
  // Identity ещё не загружена или detail недоступен — только нейтральная мета.
  return { ...mockBase, name: "Проект", code: "…", status: "—", statusTone: "info" };
}
/**
 * RU-маппер кодов ошибок загрузки плана для <SurfaceState errorFormat>. Коды приходят
 * из usePlanning (load_failed) и из PlanningApiError.code/сетевых сообщений транспорта.
 * Неизвестный код отдаём как есть (или общий fallback).
 */
const PLANNING_ERR_RU: Record<string, string> = {
  permission_missing: "Недостаточно прав для просмотра плана проекта",
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
