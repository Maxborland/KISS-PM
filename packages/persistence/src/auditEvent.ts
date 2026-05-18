import type { TenantId, UserId } from "@kiss-pm/domain";

import type { AuditSourceEntity } from "./schema";

export type AuditEventRecordInput = {
  id: string;
  tenantId: TenantId;
  actorUserId: UserId;
  actionType: string;
  sourceSurfaceId?: string | null;
  sourceWorkflow?: string | null;
  sourceEntity: AuditSourceEntity;
  input: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  permissionResult: Record<string, unknown>;
  executionResult: Record<string, unknown>;
  correlationId: string;
  createdAt: Date;
};

export type AuditEventRecord = Required<AuditEventRecordInput>;

export function createAuditEventRecord(
  input: AuditEventRecordInput
): AuditEventRecord {
  requireNonBlank("id", input.id);
  requireNonBlank("tenantId", input.tenantId);
  requireNonBlank("actorUserId", input.actorUserId);
  requireNonBlank("actionType", input.actionType);
  requireNonBlank("sourceEntity.type", input.sourceEntity.type);
  requireNonBlank("sourceEntity.id", input.sourceEntity.id);
  requireNonBlank("correlationId", input.correlationId);
  requireObject("permissionResult", input.permissionResult);
  requireObject("executionResult", input.executionResult);

  return {
    ...input,
    sourceSurfaceId: input.sourceSurfaceId ?? null,
    sourceWorkflow: input.sourceWorkflow ?? null
  };
}

function requireNonBlank(fieldName: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
}

function requireObject(fieldName: string, value: Record<string, unknown>): void {
  if (Object.keys(value).length === 0) {
    throw new Error(`${fieldName} is required`);
  }
}
