import type {
  ApiTenantDataSource,
  OpportunityCustomFieldValues
} from "../apiTypes";
import type { ServiceError } from "./types";

type OpportunityCustomFieldDataSource = Pick<
  ApiTenantDataSource,
  "listCustomFieldDefinitions"
>;

type ValidationResult =
  | { ok: true; values: OpportunityCustomFieldValues }
  | ServiceError;

export async function validateOpportunityCustomFieldValues(
  dataSource: OpportunityCustomFieldDataSource,
  tenantId: string,
  values: OpportunityCustomFieldValues | undefined
): Promise<ValidationResult> {
  const submittedValues = values ?? {};
  const definitions = dataSource.listCustomFieldDefinitions
    ? await dataSource.listCustomFieldDefinitions(tenantId)
    : [];
  const activeOpportunityFields = definitions.filter(
    (field) => field.targetEntity === "opportunity" && field.status === "active"
  );
  const fieldById = new Map(activeOpportunityFields.map((field) => [field.id, field]));
  const normalizedValues: OpportunityCustomFieldValues = {};

  for (const [fieldId, fieldValue] of Object.entries(submittedValues)) {
    const definition = fieldById.get(fieldId);
    if (!definition) {
      return { ok: false, status: 400, error: "custom_field_not_allowed" };
    }

    const value = fieldValue.trim();
    if (!value) continue;
    if (definition.fieldType === "number" && !Number.isFinite(Number(value))) {
      return { ok: false, status: 400, error: "invalid_custom_field_number" };
    }
    if (definition.fieldType === "date" && !isValidDateInput(value)) {
      return { ok: false, status: 400, error: "invalid_custom_field_date" };
    }

    normalizedValues[fieldId] = value;
  }

  for (const definition of activeOpportunityFields) {
    if (definition.required && !normalizedValues[definition.id]) {
      return { ok: false, status: 400, error: "custom_field_required" };
    }
  }

  return { ok: true, values: normalizedValues };
}

function isValidDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
