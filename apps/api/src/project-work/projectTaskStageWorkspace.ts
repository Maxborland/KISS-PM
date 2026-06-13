import {
  canManageProjectStages,
  canReadProjects,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { ProjectTaskStageRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "../apiTypes";
import type { ProjectTaskStageWriteBody } from "../projectWorkParsers";
import { appendProjectTaskStageAudit } from "./projectTaskStageAudit";

type ProjectTaskStageWorkspaceDeps = {
  dataSource: ApiTenantDataSource;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

type WorkspaceInput = {
  actor: TenantUser;
  profile: AccessProfile;
};

type WorkspaceError = {
  ok: false;
  status: 403 | 404 | 409 | 501;
  error: string;
};

type ProjectTaskStageListResult =
  | { ok: true; projectTaskStages: ProjectTaskStageRecord[] }
  | WorkspaceError;

type ProjectTaskStageResult =
  | { ok: true; projectTaskStage: ProjectTaskStageRecord }
  | WorkspaceError;

export function createProjectTaskStageWorkspace(deps: ProjectTaskStageWorkspaceDeps) {
  return {
    listProjectTaskStages(input: WorkspaceInput) {
      return listProjectTaskStages(deps, input);
    },
    createProjectTaskStage(input: WorkspaceInput & { value: ProjectTaskStageWriteBody }) {
      return createProjectTaskStage(deps, input);
    },
    updateProjectTaskStage(
      input: WorkspaceInput & { stageId: string; value: ProjectTaskStageWriteBody }
    ) {
      return updateProjectTaskStage(deps, input);
    },
    archiveProjectTaskStage(input: WorkspaceInput & { stageId: string }) {
      return archiveProjectTaskStage(deps, input);
    }
  };
}

async function listProjectTaskStages(
  deps: ProjectTaskStageWorkspaceDeps,
  input: WorkspaceInput
): Promise<ProjectTaskStageListResult> {
  if (!deps.dataSource.listProjectTaskStages) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  return {
    ok: true,
    projectTaskStages: await deps.dataSource.listProjectTaskStages(input.actor.tenantId)
  };
}

async function createProjectTaskStage(
  deps: ProjectTaskStageWorkspaceDeps,
  input: WorkspaceInput & { value: ProjectTaskStageWriteBody }
): Promise<ProjectTaskStageResult> {
  if (
    !deps.dataSource.createProjectTaskStage ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageProjectStages({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  try {
    return await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createProjectTaskStage || !transactionDataSource.appendAuditEvent) {
        return { ok: false, status: 501, error: "persistence_not_configured" };
      }

      const projectTaskStage = await transactionDataSource.createProjectTaskStage({
        ...input.value,
        tenantId: input.actor.tenantId
      });

      await appendProjectTaskStageAudit(
        deps,
        {
          actor: input.actor,
          actionType: "project_task_stage.created",
          stageId: projectTaskStage.id,
          commandInput: input.value,
          beforeState: null,
          afterState: summarizeProjectTaskStage(projectTaskStage),
          permissionReason: decision.reason
        },
        transactionDataSource
      );

      return { ok: true, projectTaskStage };
    });
  } catch (error) {
    const conflict = mapProjectTaskStageConflictError(error);
    if (conflict) return conflict;
    throw error;
  }
}

async function updateProjectTaskStage(
  deps: ProjectTaskStageWorkspaceDeps,
  input: WorkspaceInput & { stageId: string; value: ProjectTaskStageWriteBody }
): Promise<ProjectTaskStageResult> {
  if (
    !deps.dataSource.updateProjectTaskStage ||
    !deps.dataSource.listProjectTaskStages ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageProjectStages({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  try {
    return await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.updateProjectTaskStage ||
        !transactionDataSource.listProjectTaskStages ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false, status: 501, error: "persistence_not_configured" };
      }

      const before = (await transactionDataSource.listProjectTaskStages(input.actor.tenantId)).find(
        (stage) => stage.id === input.stageId
      );
      if (!before) return { ok: false, status: 404, error: "project_task_stage_not_found" };
      if (before.isSystem && input.value.status === "archived") {
        return { ok: false, status: 409, error: "system_project_task_stage_required" };
      }

      const projectTaskStage = await transactionDataSource.updateProjectTaskStage({
        ...input.value,
        id: input.stageId,
        tenantId: input.actor.tenantId
      });

      await appendProjectTaskStageAudit(
        deps,
        {
          actor: input.actor,
          actionType: "project_task_stage.updated",
          stageId: projectTaskStage.id,
          commandInput: input.value,
          beforeState: summarizeProjectTaskStage(before),
          afterState: summarizeProjectTaskStage(projectTaskStage),
          permissionReason: decision.reason
        },
        transactionDataSource
      );

      return { ok: true, projectTaskStage };
    });
  } catch (error) {
    const conflict = mapProjectTaskStageConflictError(error);
    if (conflict) return conflict;
    throw error;
  }
}

async function archiveProjectTaskStage(
  deps: ProjectTaskStageWorkspaceDeps,
  input: WorkspaceInput & { stageId: string }
): Promise<ProjectTaskStageResult> {
  if (
    !deps.dataSource.archiveProjectTaskStage ||
    !deps.dataSource.listProjectTaskStages ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageProjectStages({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.archiveProjectTaskStage ||
      !transactionDataSource.listProjectTaskStages ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false, status: 501, error: "persistence_not_configured" };
    }

    const before = (await transactionDataSource.listProjectTaskStages(input.actor.tenantId)).find(
      (stage) => stage.id === input.stageId
    );
    if (!before) return { ok: false, status: 404, error: "project_task_stage_not_found" };
    if (before.isSystem) {
      return { ok: false, status: 409, error: "system_project_task_stage_required" };
    }

    const projectTaskStage = await transactionDataSource.archiveProjectTaskStage(
      input.actor.tenantId,
      input.stageId
    );
    if (!projectTaskStage) {
      return { ok: false, status: 409, error: "system_project_task_stage_required" };
    }

    await appendProjectTaskStageAudit(
      deps,
      {
        actor: input.actor,
        actionType: "project_task_stage.archived",
        stageId: projectTaskStage.id,
        commandInput: { id: projectTaskStage.id },
        beforeState: summarizeProjectTaskStage(before),
        afterState: summarizeProjectTaskStage(projectTaskStage),
        permissionReason: decision.reason
      },
      transactionDataSource
    );

    return { ok: true, projectTaskStage };
  });
}

function summarizeProjectTaskStage(stage: ProjectTaskStageRecord) {
  return {
    id: stage.id,
    name: stage.name,
    sortOrder: stage.sortOrder,
    status: stage.status,
    isSystem: stage.isSystem
  };
}

function mapProjectTaskStageConflictError(error: unknown): WorkspaceError | undefined {
  if (isConstraintError(error, "project_task_stages_tenant_name_uidx")) {
    return { ok: false, status: 409, error: "project_task_stage_name_conflict" };
  }
  if (isConstraintError(error, "project_task_stages_tenant_sort_order_uidx")) {
    return { ok: false, status: 409, error: "project_task_stage_sort_order_conflict" };
  }
  if (isConstraintError(error, "project_task_stages_pkey")) {
    return { ok: false, status: 409, error: "project_task_stage_id_conflict" };
  }
}

function isConstraintError(error: unknown, constraintName: string): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;

  return (
    (record.code === "23505" &&
      (record.constraint_name === constraintName ||
        record.constraint === constraintName ||
        String(record.message ?? "").includes(constraintName))) ||
    isConstraintError(record.cause, constraintName)
  );
}
