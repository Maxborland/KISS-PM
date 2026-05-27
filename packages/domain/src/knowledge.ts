import type { TenantId, UserId } from "./index";

export const knowledgeDocumentTypes = [
  "project_brief",
  "meeting_minutes",
  "specification",
  "decision_record",
  "general"
] as const;
export type KnowledgeDocumentType = (typeof knowledgeDocumentTypes)[number];

export const knowledgeDocumentStatuses = ["draft", "active", "archived"] as const;
export type KnowledgeDocumentStatus = (typeof knowledgeDocumentStatuses)[number];

export const knowledgeApprovalStatuses = ["none", "pending", "approved", "rejected"] as const;
export type KnowledgeApprovalStatus = (typeof knowledgeApprovalStatuses)[number];

export const decisionLogStatuses = ["proposed", "accepted", "superseded", "rejected"] as const;
export type DecisionLogStatus = (typeof decisionLogStatuses)[number];

export const knowledgeActionItemStatuses = ["open", "done", "cancelled"] as const;
export type KnowledgeActionItemStatus = (typeof knowledgeActionItemStatuses)[number];

export const knowledgeActionTargetTypes = [
  "project",
  "task",
  "opportunity",
  "corrective_action"
] as const;
export type KnowledgeActionTargetType = (typeof knowledgeActionTargetTypes)[number];

export type KnowledgeDocument = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  title: string;
  summary: string | null;
  documentType: KnowledgeDocumentType;
  status: KnowledgeDocumentStatus;
  currentVersionId: string | null;
  sourceMeetingId: string | null;
  approvalStatus: KnowledgeApprovalStatus;
  approvalRequestedByUserId: UserId | null;
  createdByUserId: UserId;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type KnowledgeDocumentVersion = {
  id: string;
  tenantId: TenantId;
  documentId: string;
  versionNumber: number;
  title: string;
  body: string;
  summary: string | null;
  changeReason: string | null;
  createdByUserId: UserId;
  createdAt: Date;
};

export type DecisionLogEntry = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  title: string;
  decision: string;
  rationale: string | null;
  status: DecisionLogStatus;
  sourceMeetingId: string | null;
  documentId: string | null;
  supersedesDecisionId: string | null;
  createdByUserId: UserId;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type KnowledgeActionItem = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  title: string;
  description: string | null;
  ownerUserId: UserId;
  dueDate: string | null;
  status: KnowledgeActionItemStatus;
  sourceMeetingId: string | null;
  documentId: string | null;
  decisionId: string | null;
  targetEntityType: KnowledgeActionTargetType | null;
  targetEntityId: string | null;
  createdByUserId: UserId;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type KnowledgeParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const maxIdLength = 200;
const maxTitleLength = 180;
const maxSummaryLength = 2000;
const maxBodyLength = 100_000;
const maxReasonLength = 4000;
const controlCharacterPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function parseKnowledgeId(
  value: unknown,
  error = "knowledge_id_invalid"
): KnowledgeParseResult<string> {
  if (typeof value !== "string") return { ok: false, error };
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > maxIdLength ||
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    /[\\/]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return { ok: false, error };
  }
  return { ok: true, value: trimmed };
}

export function parseKnowledgeTitle(value: unknown): KnowledgeParseResult<string> {
  return parseBoundedText(value, {
    emptyError: "knowledge_title_required",
    invalidError: "knowledge_title_invalid",
    maxLength: maxTitleLength
  });
}

export function parseKnowledgeSummary(value: unknown): KnowledgeParseResult<string | null> {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  return parseBoundedText(value, {
    emptyError: "knowledge_summary_invalid",
    invalidError: "knowledge_summary_invalid",
    maxLength: maxSummaryLength,
    allowEmpty: true
  });
}

export function parseKnowledgeBody(value: unknown): KnowledgeParseResult<string> {
  return parseBoundedText(value, {
    emptyError: "knowledge_body_required",
    invalidError: "knowledge_body_invalid",
    maxLength: maxBodyLength
  });
}

export function parseKnowledgeReason(value: unknown): KnowledgeParseResult<string | null> {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  return parseBoundedText(value, {
    emptyError: "knowledge_reason_invalid",
    invalidError: "knowledge_reason_invalid",
    maxLength: maxReasonLength,
    allowEmpty: true
  });
}

export function parseKnowledgeDocumentType(
  value: unknown
): KnowledgeParseResult<KnowledgeDocumentType> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: "general" };
  }
  if (typeof value === "string" && knowledgeDocumentTypes.includes(value as never)) {
    return { ok: true, value: value as KnowledgeDocumentType };
  }
  return { ok: false, error: "knowledge_document_type_invalid" };
}

export function parseKnowledgeDocumentStatus(
  value: unknown
): KnowledgeParseResult<KnowledgeDocumentStatus> {
  if (typeof value === "string" && knowledgeDocumentStatuses.includes(value as never)) {
    return { ok: true, value: value as KnowledgeDocumentStatus };
  }
  return { ok: false, error: "knowledge_document_status_invalid" };
}

export function parseKnowledgeApprovalStatus(
  value: unknown
): KnowledgeParseResult<KnowledgeApprovalStatus> {
  if (value === undefined || value === null || value === "") return { ok: true, value: "none" };
  if (typeof value === "string" && knowledgeApprovalStatuses.includes(value as never)) {
    return { ok: true, value: value as KnowledgeApprovalStatus };
  }
  return { ok: false, error: "knowledge_approval_status_invalid" };
}

export function parseDecisionLogStatus(value: unknown): KnowledgeParseResult<DecisionLogStatus> {
  if (value === undefined || value === null || value === "") return { ok: true, value: "accepted" };
  if (typeof value === "string" && decisionLogStatuses.includes(value as never)) {
    return { ok: true, value: value as DecisionLogStatus };
  }
  return { ok: false, error: "decision_status_invalid" };
}

export function parseKnowledgeActionItemStatus(
  value: unknown
): KnowledgeParseResult<KnowledgeActionItemStatus> {
  if (value === undefined || value === null || value === "") return { ok: true, value: "open" };
  if (typeof value === "string" && knowledgeActionItemStatuses.includes(value as never)) {
    return { ok: true, value: value as KnowledgeActionItemStatus };
  }
  return { ok: false, error: "knowledge_action_item_status_invalid" };
}

export function parseKnowledgeActionTargetType(
  value: unknown
): KnowledgeParseResult<KnowledgeActionTargetType | null> {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value === "string" && knowledgeActionTargetTypes.includes(value as never)) {
    return { ok: true, value: value as KnowledgeActionTargetType };
  }
  return { ok: false, error: "knowledge_action_target_type_invalid" };
}

export function parseKnowledgeDueDate(value: unknown): KnowledgeParseResult<string | null> {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) {
      return { ok: true, value };
    }
  }
  return { ok: false, error: "knowledge_action_due_date_invalid" };
}

export function parseOptionalKnowledgeId(
  value: unknown,
  error = "knowledge_id_invalid"
): KnowledgeParseResult<string | null> {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  return parseKnowledgeId(value, error);
}

function parseBoundedText(
  value: unknown,
  input: {
    emptyError: string;
    invalidError: string;
    maxLength: number;
    allowEmpty?: boolean;
  }
): KnowledgeParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: input.emptyError };
  if (controlCharacterPattern.test(value)) return { ok: false, error: input.invalidError };
  const trimmed = value.trim().replace(/\r\n/g, "\n");
  if (!trimmed && !input.allowEmpty) return { ok: false, error: input.emptyError };
  if (trimmed.length > input.maxLength) return { ok: false, error: input.invalidError };
  return { ok: true, value: trimmed };
}
