import type {
  CrmActivityEntityType,
  CrmActivityStatus
} from "@kiss-pm/persistence";
import { parseExternalReferenceUrl } from "./attachmentValidation";

type ParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

export type CreateCrmCommentBody = {
  body: string;
};

export type CreateCrmTaskBody = {
  title: string;
  body: string | null;
  dueDate: Date | null;
  assigneeUserId: string | null;
};

export type CreateCrmFileBody = {
  title: string;
  fileUrl: string;
  body: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
};

export type UpdateCrmTaskBody = {
  status: CrmActivityStatus;
};

export function parseCrmActivityEntityType(
  value: string
): ParseResult<CrmActivityEntityType> {
  if (
    value === "opportunity" ||
    value === "client" ||
    value === "contact" ||
    value === "product"
  ) {
    return { ok: true, value };
  }

  return { ok: false, error: "crm_entity_type_invalid" };
}

export function parseCreateCrmCommentBody(
  value: unknown
): ParseResult<CreateCrmCommentBody> {
  if (!isObjectBody(value)) return { ok: false, error: "invalid_body" };

  const body = parseRequiredString(value.body, 4000);
  if (!body.ok) return { ok: false, error: "comment_body_required" };

  return {
    ok: true,
    value: {
      body: body.value
    }
  };
}

export function parseCreateCrmTaskBody(
  value: unknown
): ParseResult<CreateCrmTaskBody> {
  if (!isObjectBody(value)) return { ok: false, error: "invalid_body" };

  const title = parseRequiredString(value.title, 180);
  if (!title.ok) return { ok: false, error: "task_title_required" };
  if (!isSafeSingleLineText(title.value)) {
    return { ok: false, error: "task_title_required" };
  }

  const body = parseOptionalString(value.body, 4000);
  if (!body.ok) return { ok: false, error: "task_body_invalid" };

  const dueDate = parseOptionalDate(value.dueDate);
  if (!dueDate.ok) return { ok: false, error: "task_due_date_invalid" };

  const assigneeUserId = parseOptionalString(value.assigneeUserId, 120);
  if (!assigneeUserId.ok) {
    return { ok: false, error: "task_assignee_invalid" };
  }
  if (assigneeUserId.value !== null && !isSafeUserId(assigneeUserId.value)) {
    return { ok: false, error: "task_assignee_invalid" };
  }

  return {
    ok: true,
    value: {
      title: title.value,
      body: body.value,
      dueDate: dueDate.value,
      assigneeUserId: assigneeUserId.value
    }
  };
}

export function parseUpdateCrmTaskBody(
  value: unknown
): ParseResult<UpdateCrmTaskBody> {
  if (!isObjectBody(value)) return { ok: false, error: "invalid_body" };
  if (value.status !== "todo" && value.status !== "done") {
    return { ok: false, error: "task_status_invalid" };
  }

  return {
    ok: true,
    value: {
      status: value.status
    }
  };
}

export function parseCreateCrmFileBody(
  value: unknown
): ParseResult<CreateCrmFileBody> {
  if (!isObjectBody(value)) return { ok: false, error: "invalid_body" };

  const title = parseRequiredString(value.title, 240);
  if (!title.ok) return { ok: false, error: "file_title_required" };
  if (!isSafeSingleLineText(title.value)) {
    return { ok: false, error: "file_title_required" };
  }

  const fileUrl = parseRequiredUrl(value.fileUrl, 1200);
  if (!fileUrl.ok) {
    return {
      ok: false,
      error: fileUrl.error === "invalid_url" ? "file_url_invalid" : "file_url_required"
    };
  }

  const body = parseOptionalString(value.body, 4000);
  if (!body.ok) return { ok: false, error: "file_description_invalid" };

  const mimeType = parseOptionalString(value.mimeType, 160);
  if (!mimeType.ok) return { ok: false, error: "file_mime_type_invalid" };
  if (mimeType.value !== null && !isSafeSingleLineText(mimeType.value)) {
    return { ok: false, error: "file_mime_type_invalid" };
  }

  const fileSizeBytes = parseOptionalNonNegativeInteger(value.fileSizeBytes);
  if (!fileSizeBytes.ok) return { ok: false, error: "file_size_invalid" };

  return {
    ok: true,
    value: {
      title: title.value,
      fileUrl: fileUrl.value,
      body: body.value,
      fileSizeBytes: fileSizeBytes.value,
      mimeType: mimeType.value
    }
  };
}

function parseRequiredString(
  value: unknown,
  maxLength: number
): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "invalid_string" };
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return { ok: false, error: "invalid_string" };
  }
  if (!isSafeMultilineText(trimmed)) {
    return { ok: false, error: "invalid_string" };
  }

  return { ok: true, value: trimmed };
}

function parseRequiredUrl(
  value: unknown,
  maxLength: number
): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "invalid_string" };
  if (value.trim().length > maxLength) return { ok: false, error: "invalid_url" };
  const parsed = parseExternalReferenceUrl(value);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error === "external_url_required" ? "invalid_string" : "invalid_url"
    };
  }

  return { ok: true, value: parsed.value };
}

function parseOptionalString(
  value: unknown,
  maxLength: number
): ParseResult<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "invalid_string" };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > maxLength) return { ok: false, error: "invalid_string" };
  if (!isSafeMultilineText(trimmed)) return { ok: false, error: "invalid_string" };

  return { ok: true, value: trimmed };
}

function parseOptionalDate(value: unknown): ParseResult<Date | null> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") return { ok: false, error: "invalid_date" };

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { ok: false, error: "invalid_date" };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, error: "invalid_date" };
  }

  return { ok: true, value: date };
}

function parseOptionalNonNegativeInteger(
  value: unknown
): ParseResult<number | null> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, error: "invalid_integer" };
  }

  return { ok: true, value };
}

function isObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeUserId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{2,119}$/.test(value);
}

function isSafeSingleLineText(value: string): boolean {
  return !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeMultilineText(value: string): boolean {
  return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
