/* ============================================================
   Каталог прав доступа (permission catalog) — зеркало
   packages/access-control/src/index.ts (export const permissions).

   ЧЕСТНОСТЬ: это compile-time enum, общий для фронта и бэка. Боевого
   GET-эндпоинта каталога прав в apps/api НЕТ (перечень нигде не отдаётся
   по REST), а web-пакет не зависит от @kiss-pm/access-control, поэтому
   каталог продублирован здесь статической константой ДОМЕНА (не «мок»),
   идентичной в Storybook и проде. Чек-лист прав в ролях строится из неё
   как в mock-, так и в live-режиме. Роль «Администратор» получает ВЕСЬ
   список (полный доступ).
   ============================================================ */

import type { Permission } from "./admin-client";

export const ALL_PERMISSIONS: Permission[] = [
  "tenant.users.read", "tenant.users.manage",
  "tenant.access_profiles.read", "tenant.access_profiles.manage",
  "tenant.positions.read", "tenant.positions.manage",
  "tenant.audit_events.read",
  "tenant.workspace_config.read", "tenant.workspace_config.manage",
  "tenant.absences.read", "tenant.absences.manage",
  "tenant.org_structure.read", "tenant.org_structure.manage",
  "tenant.clients.read", "tenant.clients.manage",
  "tenant.contacts.read", "tenant.contacts.manage",
  "tenant.products.read", "tenant.products.manage",
  "tenant.project_types.read", "tenant.project_types.manage",
  "tenant.deal_stages.read", "tenant.deal_stages.manage",
  "tenant.opportunities.read", "tenant.opportunities.manage",
  "tenant.projects.read", "tenant.projects.manage",
  "tenant.project_plan.read", "tenant.project_plan.manage",
  "tenant.project_baselines.manage",
  "tenant.project_resources.read", "tenant.project_resources.manage",
  "tenant.planning_scenarios.preview", "tenant.planning_scenarios.apply",
  "tenant.kpi_definitions.read", "tenant.kpi_definitions.manage",
  "tenant.control_signals.read", "tenant.control_signals.manage",
  "tenant.management_actions.execute",
  "tenant.corrective_actions.manage",
  "tenant.control_surfaces.read", "tenant.control_surfaces.manage", "tenant.control_surfaces.publish",
  "tenant.retrospectives.read", "tenant.retrospectives.manage",
  "tenant.template_improvements.apply",
  "tenant.background_jobs.read", "tenant.background_jobs.manage",
  "tenant.communications.read", "tenant.communications.manage",
  "tenant.tasks.create", "tenant.tasks.edit", "tenant.tasks.delete",
  "tenant.task_statuses.manage",
  "tenant.project_activation.manage",
  "tenant.resource_feasibility.read",
  "profile.read", "profile.update",
  "workspace.theme.manage"
];
