import type { PlanningReadModel } from "@kiss-pm/planning-client";

import type { ProjectMeta } from "@/delivery/ui/delivery-frame";

/**
 * Шапка проекта для состояний loading/error поверхностей Project Delivery —
 * нейтральная: без finish/variance (их даёт живой read-model) и с прочерком
 * дедлайна, чтобы до загрузки данных ничего конкретного не утверждать.
 */
export const PROJECT_FALLBACK: ProjectMeta = {
  name: "Производственный портал · Релиз 2",
  code: "ПР",
  status: "В работе",
  statusTone: "info",
  planVersion: "v17",
  deadline: "—",
  finish: "—"
};

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
