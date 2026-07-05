import { randomUUID } from "node:crypto";

import {
  canManageKpiDefinitions,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import { validateKpiFormula, type KpiDefinition, type TenantUser } from "@kiss-pm/domain";

import type { ControlDataPort, TransactionDataPort } from "../apiDataPorts";
import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";

type KpiDefinitionBodyReaderResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

type KpiDefinitionCommandDeps = {
  dataSource: ControlDataPort & Partial<TransactionDataPort>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ControlDataPort) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type UpsertKpiDefinitionResult =
  | { ok: true; definition: KpiDefinition; auditEventId: string }
  | { ok: false; status: 400 | 403 | 413 | 415 | 501; error: string };

export async function executeUpsertKpiDefinition(input: {
  actor: TenantUser;
  profile: AccessProfile;
  readBody(): Promise<KpiDefinitionBodyReaderResult>;
  deps: KpiDefinitionCommandDeps;
}): Promise<UpsertKpiDefinitionResult> {
  if (!input.deps.dataSource.upsertKpiDefinition || !input.deps.dataSource.appendAuditEvent) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageKpiDefinitions({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) {
    await appendKpiDefinitionDeniedAudit(input.actor, decision, input.deps);
    return { ok: false, status: 403, error: decision.reason };
  }

  const body = await input.readBody();
  if (!body.ok) return { ok: false, status: body.status, error: body.error };
  const parsed = parseKpiDefinitionBody(body.value, input.actor.tenantId);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  if (!input.deps.dataSource.withTransaction) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  return input.deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (!transactionDataSource.upsertKpiDefinition || !transactionDataSource.appendAuditEvent) {
      return { ok: false as const, status: 501, error: "persistence_not_configured" };
    }
    const definition = await transactionDataSource.upsertKpiDefinition(parsed.value);
    const auditEventId = await input.deps.appendManagementAuditEvent(
      kpiDefinitionAuditInput({
        actor: input.actor,
        actionType: "kpi.definition.upserted",
        sourceEntity: { type: "KpiDefinition", id: definition.id },
        commandInput: { definition },
        beforeState: null,
        afterState: { definition },
        permissionResult: decision,
        executionResult: { status: "succeeded" }
      }),
      transactionDataSource
    );
    return { ok: true as const, definition, auditEventId };
  });
}

async function appendKpiDefinitionDeniedAudit(
  actor: TenantUser,
  permissionResult: PolicyDecision,
  deps: KpiDefinitionCommandDeps
) {
  await deps.appendManagementAuditEvent(
    kpiDefinitionAuditInput({
      actor,
      actionType: "kpi.definition.upsert_denied",
      sourceEntity: { type: "KpiDefinition", id: "__unknown__" },
      commandInput: { route: "/api/tenant/current/kpi-definitions" },
      beforeState: null,
      afterState: null,
      permissionResult,
      executionResult: { status: "denied" }
    }),
    deps.dataSource
  );
}

function kpiDefinitionAuditInput(input: {
  actor: TenantUser;
  actionType: string;
  sourceEntity: { type: string; id: string };
  commandInput: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  permissionResult: PolicyDecision;
  executionResult: Record<string, unknown>;
}): ManagementAuditEventInput {
  return {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "control",
    sourceEntity: input.sourceEntity,
    commandInput: input.commandInput,
    beforeState: input.beforeState,
    afterState: input.afterState,
    permissionResult: input.permissionResult,
    executionResult: input.executionResult
  };
}

function parseKpiDefinitionBody(
  input: unknown,
  tenantId: string
): { ok: true; value: KpiDefinition } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "kpi_definition_invalid" };
  const id = stringField(input, "id") ?? `kpi-${randomUUID()}`;
  const code = stringField(input, "code");
  const label = stringField(input, "label");
  const unit = stringField(input, "unit") ?? "count";
  const period = stringField(input, "period") ?? "snapshot";
  const status = stringField(input, "status") ?? "active";
  const version = integerField(input, "version") ?? 1;
  if (
    !code ||
    !label ||
    !validateKpiFormula(input.formula) ||
    !Array.isArray(input.thresholdRules) ||
    !isValidThresholdRules(input.thresholdRules) ||
    !isValidKpiUnit(unit) ||
    !isValidKpiPeriod(period) ||
    !isValidKpiStatus(status) ||
    version <= 0 ||
    !isValidAllowedActions(input.allowedActions)
  ) {
    return { ok: false, error: "kpi_definition_invalid" };
  }
  return {
    ok: true,
    value: {
      id,
      tenantId,
      entityType: "project",
      code,
      label,
      formula: input.formula,
      unit,
      period,
      thresholdRules: input.thresholdRules as KpiDefinition["thresholdRules"],
      ownerRole: stringField(input, "ownerRole"),
      allowedActions: Array.isArray(input.allowedActions)
        ? (input.allowedActions as KpiDefinition["allowedActions"])
        : ["create_corrective_action"],
      version,
      status
    }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function integerField(input: Record<string, unknown>, field: string): number | null {
  const value = input[field];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isValidThresholdRules(value: unknown[]): value is KpiDefinition["thresholdRules"] {
  return value.every(
    (item) =>
      isObject(item) &&
      (item.severity === "warning" || item.severity === "critical") &&
      (item.operator === "gt" ||
        item.operator === "gte" ||
        item.operator === "lt" ||
        item.operator === "lte" ||
        item.operator === "eq") &&
      typeof item.value === "number" &&
      Number.isFinite(item.value)
  );
}

function isValidAllowedActions(value: unknown): value is KpiDefinition["allowedActions"] | undefined {
  if (value === undefined) return true;
  const actions = [
    "create_corrective_action",
    "generate_planning_solution",
    "apply_planning_delta",
    "accept_risk",
    "move_deadline",
    "open_gantt"
  ];
  return Array.isArray(value) && value.every((item) => typeof item === "string" && actions.includes(item));
}

function isValidKpiUnit(value: string): value is KpiDefinition["unit"] {
  return ["days", "minutes", "percent", "count"].includes(value);
}

function isValidKpiPeriod(value: string): value is KpiDefinition["period"] {
  return ["snapshot", "day", "week", "month"].includes(value);
}

function isValidKpiStatus(value: string): value is KpiDefinition["status"] {
  return ["active", "archived"].includes(value);
}
