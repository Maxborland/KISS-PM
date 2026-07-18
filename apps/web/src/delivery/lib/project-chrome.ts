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
export type PlanningUiError = {
  code: string;
  message: string;
  status?: number;
};

const SESSION_REQUIRED_MESSAGE = "Сессия истекла. Войдите снова, чтобы продолжить";
const PERMISSION_MISSING_MESSAGE = "Недостаточно прав для работы с планом проекта";
const PROJECT_NOT_FOUND_MESSAGE = "Проект не найден: возможно, он удалён или ссылка устарела";
const PERSISTENCE_UNAVAILABLE_MESSAGE = "Сервис планирования временно недоступен";
const TRANSPORT_FAILURE_MESSAGE = "Не удалось связаться с сервисом планирования. Проверьте подключение и повторите";

const PLANNING_ERROR_MESSAGES: Record<string, string> = {
  session_required: SESSION_REQUIRED_MESSAGE,
  unauthorized: SESSION_REQUIRED_MESSAGE,
  permission_missing: PERMISSION_MISSING_MESSAGE,
  forbidden: PERMISSION_MISSING_MESSAGE,
  project_not_found: PROJECT_NOT_FOUND_MESSAGE,
  plan_version_conflict: "План уже изменился. Данные обновлены, повторите действие",
  planning_precondition_failed: "Изменение нельзя применить к текущему состоянию плана",
  idempotency_key_conflict: "Операция конфликтует с уже отправленным запросом. Повторите действие",
  persistence_not_configured: PERSISTENCE_UNAVAILABLE_MESSAGE,
  transport_failure: TRANSPORT_FAILURE_MESSAGE,
  network_error: TRANSPORT_FAILURE_MESSAGE,
  invalid_json_response: "Сервис планирования вернул некорректный ответ",
  nothing_to_revert: "Нет изменений, которые можно отменить",
  // Сценарии: persisted-превью живёт 15 минут и одноразово; все коды ниже означают
  // «предложение больше неприменимо» с разной причиной (см. apply в registerPlanningRoutes).
  scenario_expired: "Срок предложения истёк. Запросите сценарии заново",
  scenario_not_found: "Предложение сценария не найдено. Запросите сценарии заново",
  scenario_unavailable: "Сценарий стал недоступен для применения. Запросите сценарии заново",
  planning_scenario_already_applied: "Этот сценарий уже применён. Данные обновлены",
  scenario_rejected: "Этот сценарий отклонён. Запросите сценарии заново",
  planning_scenario_already_rejected: "Этот сценарий уже отклонён",
  planning_scenario_invalid: "Предложение повреждено или устарело — запросите сценарии заново",
  planning_scenario_hash_mismatch: "Данные предложения изменились после расчёта. Запросите сценарии заново",
  planning_scenario_engine_mismatch: "Версия планировщика обновилась. Запросите сценарии заново",
  planning_scenario_target_mismatch: "Целевой перегруз изменился. Запросите сценарии заново"
};

const STATUS_ERROR_MESSAGES: Record<number, string> = {
  401: SESSION_REQUIRED_MESSAGE,
  403: PERMISSION_MISSING_MESSAGE,
  404: PROJECT_NOT_FOUND_MESSAGE,
  409: "План или операция уже изменились. Обновите данные и повторите действие",
  501: PERSISTENCE_UNAVAILABLE_MESSAGE
};

const STATUS_ERROR_CODES: Record<number, string> = {
  401: "session_required",
  403: "permission_missing",
  404: "project_not_found",
  409: "conflict",
  501: "persistence_not_configured"
};

const FALLBACK_ERROR_MESSAGES: Record<string, string> = {
  load_failed: "Не удалось загрузить план проекта",
  request_failed: "Не удалось выполнить запрос к планировщику",
  apply_failed: "Не удалось применить изменение плана",
  revert_failed: "Не удалось отменить изменение плана",
  preview_failed: "Не удалось рассчитать изменение плана",
  apply_scenario_failed: "Не удалось применить сценарий"
};

export function mapPlanningError(error: unknown, fallbackCode = "request_failed"): PlanningUiError {
  const value = error && typeof error === "object" ? error as { code?: unknown; status?: unknown } : null;
  const status = typeof value?.status === "number" ? value.status : undefined;
  const explicitCode = typeof error === "string"
    ? error
    : typeof value?.code === "string"
      ? value.code
      : undefined;
  const code = explicitCode
    ?? (error instanceof TypeError ? "transport_failure" : undefined)
    ?? (status === undefined ? undefined : STATUS_ERROR_CODES[status])
    ?? fallbackCode;
  const message = PLANNING_ERROR_MESSAGES[code]
    ?? (status === undefined ? undefined : STATUS_ERROR_MESSAGES[status])
    ?? FALLBACK_ERROR_MESSAGES[code]
    ?? "Не удалось выполнить операцию планирования";
  return { code, message, ...(status === undefined ? {} : { status }) };
}

export const planningErr = (code?: string): string =>
  mapPlanningError(code ?? "load_failed", "load_failed").message;

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
