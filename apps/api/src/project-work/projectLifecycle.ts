import { canManageProjects, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { ProjectRecord, ProjectStatus } from "@kiss-pm/persistence";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "../apiTypes";
import {
  findUnknownProjectReference,
  isProjectIdConflict
} from "./projectLifecycleGuards";
import type {
  CreateManualProjectFields,
  UpdateProjectFields
} from "./projectLifecycleParsers";

/* ============================================================
   Жизненный цикл проекта (Блок 5): ручное создание, редактирование
   параметров, статусные переходы (reopen/pause/resume).

   Единое право — tenant.projects.manage (canManageProjects). Каждая мутация:
   1) capability-guard источника данных (нет метода → 501 ДО изменения),
   2) RBAC (запрет → 403 + denied-аудит),
   3) транзакция + управленческий аудит (before/after).
   ============================================================ */

export type ProjectLifecycleDeps = {
  dataSource: ApiTenantDataSource;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

type LifecycleErrorStatus = 400 | 403 | 404 | 409 | 501;
type LifecycleResult =
  | { ok: false; status: LifecycleErrorStatus; error: string }
  | { ok: true; status: 200 | 201; project: ProjectRecord };

// Переход статуса → { целевой статус, допустимые исходные статусы, тип действия }.
const STATUS_TRANSITIONS = {
  reopen: {
    status: "active" as ProjectStatus,
    from: ["closed", "cancelled"] as const,
    actionType: "project.reopened"
  },
  pause: {
    status: "paused" as ProjectStatus,
    from: ["active"] as const,
    actionType: "project.paused"
  },
  resume: {
    status: "active" as ProjectStatus,
    from: ["paused"] as const,
    actionType: "project.resumed"
  }
} as const;

export type ProjectStatusAction = keyof typeof STATUS_TRANSITIONS;

async function authorizeManage(
  deps: ProjectLifecycleDeps,
  actor: TenantUser,
  context: { actionType: string; projectId: string; commandInput: Record<string, unknown> }
): Promise<
  | { ok: true; decision: ReturnType<typeof canManageProjects> }
  | { ok: false; status: 403; error: string }
> {
  const decision = canManageProjects({
    actor,
    profile: await deps.getActorProfile(actor),
    targetTenantId: actor.tenantId
  });
  if (!decision.allowed) {
    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: `${context.actionType}_denied`,
      sourceWorkflow: "project_lifecycle",
      sourceEntity: { type: "Project", id: context.projectId },
      commandInput: context.commandInput,
      beforeState: null,
      afterState: null,
      permissionResult: decision,
      executionResult: { status: "denied" }
    });
    return { ok: false, status: 403, error: decision.reason };
  }
  return { ok: true, decision };
}

export async function createManualProject(
  deps: ProjectLifecycleDeps,
  input: { actor: TenantUser; fields: CreateManualProjectFields }
): Promise<LifecycleResult> {
  if (
    !deps.dataSource.createManualProject ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const { actor, fields } = input;
  const auth = await authorizeManage(deps, actor, {
    actionType: "project.created",
    projectId: fields.id,
    commandInput: { title: fields.title }
  });
  if (!auth.ok) return auth;

  // Проверки ПОСЛЕ RBAC: неавторизованный не должен узнавать о существовании id.
  const unknownReference = await findUnknownProjectReference(
    deps.dataSource,
    actor.tenantId,
    fields
  );
  if (unknownReference) return { ok: false, status: 404, error: unknownReference };

  // Клиентский id: двойной клик, ретрай сети или скриптовый импорт давали 23505 → 500.
  const existing = await deps.dataSource.findProjectById?.(actor.tenantId, fields.id);
  if (existing) return { ok: false, status: 409, error: "project_id_taken" };

  const project = await runCreate(deps, actor, fields, auth.decision);
  if (typeof project === "string") return { ok: false, status: 409, error: project };

  return { ok: true, status: 201, project };
}

// Вставка + аудит в одной транзакции. Гонка между предчеком и insert остаётся
// возможной, поэтому 23505 на projects_pkey тоже маппится в 409.
async function runCreate(
  deps: ProjectLifecycleDeps,
  actor: TenantUser,
  fields: CreateManualProjectFields,
  decision: ReturnType<typeof canManageProjects>
): Promise<ProjectRecord | "project_id_taken"> {
  try {
    return await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createManualProject) {
        throw new Error("manual_project_creation_not_configured");
      }
      const created = await transactionDataSource.createManualProject({
        id: fields.id,
        tenantId: actor.tenantId,
        title: fields.title,
        clientName: fields.clientName,
        projectTypeId: fields.projectTypeId,
        templateId: fields.templateId,
        calendarId: fields.calendarId,
        plannedStart: fields.plannedStart,
        plannedFinish: fields.plannedFinish,
        contractValue: fields.contractValue,
        plannedHours: fields.plannedHours,
        demand: []
      });
      await deps.appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "project.created",
          sourceWorkflow: "project_lifecycle",
          sourceEntity: { type: "Project", id: created.id },
          commandInput: {
            title: fields.title,
            projectTypeId: fields.projectTypeId,
            templateId: fields.templateId
          },
          beforeState: null,
          afterState: created,
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return created;
    });
  } catch (error) {
    if (isProjectIdConflict(error)) return "project_id_taken";
    throw error;
  }
}

export async function updateProjectSettings(
  deps: ProjectLifecycleDeps,
  input: { actor: TenantUser; projectId: string; fields: UpdateProjectFields }
): Promise<LifecycleResult> {
  if (
    !deps.dataSource.findProjectById ||
    !deps.dataSource.updateProjectSettings ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const { actor, projectId, fields } = input;
  const auth = await authorizeManage(deps, actor, {
    actionType: "project.settings_updated",
    projectId,
    commandInput: { fields }
  });
  if (!auth.ok) return auth;

  const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.findProjectById ||
      !transactionDataSource.updateProjectSettings
    ) {
      throw new Error("project_settings_update_not_configured");
    }
    const before = await transactionDataSource.findProjectById(actor.tenantId, projectId);
    if (!before) {
      return { ok: false as const, status: 404 as const, error: "project_not_found" };
    }
    // Ссылочные id клиента писались без всякой проверки: неизвестный projectTypeId
    // падал в 23503 → 500, а templateId/calendarId (FK нет) сохранялись висячими.
    const unknownReference = await findUnknownProjectReference(
      transactionDataSource,
      actor.tenantId,
      fields
    );
    if (unknownReference) {
      return { ok: false as const, status: 404 as const, error: unknownReference };
    }
    const updated = await transactionDataSource.updateProjectSettings({
      tenantId: actor.tenantId,
      projectId,
      ...fields
    });
    if (!updated) {
      return { ok: false as const, status: 404 as const, error: "project_not_found" };
    }
    await deps.appendManagementAuditEvent(
      {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "project.settings_updated",
        sourceWorkflow: "project_lifecycle",
        sourceEntity: { type: "Project", id: updated.id },
        commandInput: { fields },
        beforeState: before,
        afterState: updated,
        permissionResult: auth.decision,
        executionResult: { status: "succeeded" }
      },
      transactionDataSource
    );
    return { ok: true as const, status: 200 as const, project: updated };
  });

  return result;
}

export async function transitionProjectStatus(
  deps: ProjectLifecycleDeps,
  input: { actor: TenantUser; projectId: string; action: ProjectStatusAction }
): Promise<LifecycleResult> {
  if (
    !deps.dataSource.findProjectById ||
    !deps.dataSource.updateProjectStatus ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const { actor, projectId, action } = input;
  const transition = STATUS_TRANSITIONS[action];
  const auth = await authorizeManage(deps, actor, {
    actionType: transition.actionType,
    projectId,
    commandInput: { action }
  });
  if (!auth.ok) return auth;

  const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.findProjectById ||
      !transactionDataSource.updateProjectStatus
    ) {
      throw new Error("project_status_transition_not_configured");
    }
    const before = await transactionDataSource.findProjectById(actor.tenantId, projectId);
    if (!before) {
      return { ok: false as const, status: 404 as const, error: "project_not_found" };
    }
    if (!(transition.from as readonly ProjectStatus[]).includes(before.status)) {
      return {
        ok: false as const,
        status: 409 as const,
        error: "project_status_transition_not_allowed"
      };
    }
    const updated = await transactionDataSource.updateProjectStatus({
      tenantId: actor.tenantId,
      projectId,
      status: transition.status,
      expectedStatuses: transition.from
    });
    if (!updated) {
      // Гонка: статус изменился между чтением и записью.
      return {
        ok: false as const,
        status: 409 as const,
        error: "project_status_transition_not_allowed"
      };
    }
    await deps.appendManagementAuditEvent(
      {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: transition.actionType,
        sourceWorkflow: "project_lifecycle",
        sourceEntity: { type: "Project", id: updated.id },
        commandInput: { action, fromStatus: before.status, toStatus: transition.status },
        beforeState: before,
        afterState: updated,
        permissionResult: auth.decision,
        executionResult: { status: "succeeded" }
      },
      transactionDataSource
    );
    return { ok: true as const, status: 200 as const, project: updated };
  });

  return result;
}
