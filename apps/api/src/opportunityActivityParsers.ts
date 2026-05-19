import type {
  OpportunityActivityStatus
} from "@kiss-pm/persistence";

type ParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

export type CreateOpportunityCommentBody = {
  body: string;
};

export type CreateOpportunityTaskBody = {
  title: string;
  body: string | null;
  dueDate: Date | null;
  assigneeUserId: string | null;
};

export type UpdateOpportunityTaskBody = {
  status: OpportunityActivityStatus;
};

export function parseCreateOpportunityCommentBody(
  value: unknown
): ParseResult<CreateOpportunityCommentBody> {
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

export function parseCreateOpportunityTaskBody(
  value: unknown
): ParseResult<CreateOpportunityTaskBody> {
  if (!isObjectBody(value)) return { ok: false, error: "invalid_body" };

  const title = parseRequiredString(value.title, 180);
  if (!title.ok) return { ok: false, error: "task_title_required" };

  const body = parseOptionalString(value.body, 4000);
  if (!body.ok) return { ok: false, error: "task_body_invalid" };

  const dueDate = parseOptionalDate(value.dueDate);
  if (!dueDate.ok) return { ok: false, error: "task_due_date_invalid" };

  const assigneeUserId = parseOptionalString(value.assigneeUserId, 120);
  if (!assigneeUserId.ok) {
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

export function parseUpdateOpportunityTaskBody(
  value: unknown
): ParseResult<UpdateOpportunityTaskBody> {
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

function parseRequiredString(
  value: unknown,
  maxLength: number
): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "invalid_string" };
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return { ok: false, error: "invalid_string" };
  }

  return { ok: true, value: trimmed };
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

function isObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
