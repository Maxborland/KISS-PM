import type { ProjectMeta } from "@/delivery/ui/delivery-frame";

/**
 * Шапка проекта для состояний loading/error поверхностей Project Delivery.
 *
 * Важно: НЕ содержит finish/variance — эти поля даёт ТОЛЬКО живой read-model.
 * Раньше каждая поверхность показывала в loading/error статичный finish «14.06.2026»
 * и warning-variance, которые противоречили реальному плану (финиш 29.07, срыв дедлайна).
 * Здесь — нейтральная шапка; живой `projectMeta` собирается в каждой поверхности из read-model.
 */
export const PROJECT_FALLBACK: ProjectMeta = {
  name: "Производственный портал · Релиз 2",
  code: "ПР",
  status: "В работе",
  statusTone: "info",
  planVersion: "v17",
  deadline: "12.07.2026",
  finish: "—"
};
