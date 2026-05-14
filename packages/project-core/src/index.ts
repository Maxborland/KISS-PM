import type { TenantId, TenantOwned } from "@kiss-pm/domain-core";

export const packageName = "@kiss-pm/project-core";

export type ProjectProcessTemplateId = string;

export type ProjectProcessTemplateAssumption = {
  code: string;
  message: string;
};

export type ProjectProcessTemplateDraft = TenantOwned & {
  id: ProjectProcessTemplateId;
  key: string;
  label: string;
  categoryKeys: string[];
  typologyKeys: string[];
  requiredScopeHintKeys: string[];
  optionalScopeHintKeys: string[];
  baseConfidence: number;
  priority: number;
  active: boolean;
  version: number;
  assumptions: ProjectProcessTemplateAssumption[];
  updatedAt: string;
};

export class ProjectCoreModelError extends Error {
  constructor(
    readonly code: "validation_error" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "ProjectCoreModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireBoolean(value: boolean | undefined, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a boolean`);
  }

  return value;
}

function requireProbability(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be between 0 and 1`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireSystemKey(value: string | undefined, fieldName: string): string {
  const key = requireNonEmptyString(value, fieldName);
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(key)) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a stable system key`);
  }

  return key;
}

function requireObject<T extends object>(value: T | undefined, fieldName: string): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be an object`);
  }

  return value;
}

function requireSystemKeyArray(value: string[] | undefined, fieldName: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(value)) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be an array`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must not be empty`);
  }

  return value.map((key) => requireSystemKey(key, `${fieldName}[]`));
}

function assertUniqueKeys(keys: string[], message: string): void {
  if (new Set(keys).size !== keys.length) {
    throw new ProjectCoreModelError("conflict", message);
  }
}

function cloneAssumptions(
  assumptions: ProjectProcessTemplateAssumption[] | undefined
): ProjectProcessTemplateAssumption[] {
  if (!Array.isArray(assumptions)) {
    throw new ProjectCoreModelError("validation_error", "projectProcessTemplate.assumptions must be an array");
  }

  return assumptions.map((rawAssumption) => {
    const assumption = requireObject(rawAssumption, "projectProcessTemplate.assumption");

    return {
      code: requireSystemKey(assumption.code, "projectProcessTemplate.assumption.code"),
      message: requireNonEmptyString(assumption.message, "projectProcessTemplate.assumption.message")
    };
  });
}

export function createProjectProcessTemplateDraft(input: {
  id: ProjectProcessTemplateId;
  tenantId: TenantId;
  key: string;
  label: string;
  categoryKeys: string[];
  typologyKeys: string[];
  requiredScopeHintKeys: string[];
  optionalScopeHintKeys: string[];
  baseConfidence: number;
  priority: number;
  active: boolean;
  version: number;
  assumptions: ProjectProcessTemplateAssumption[];
  updatedAt: string;
}): ProjectProcessTemplateDraft {
  const categoryKeys = requireSystemKeyArray(input.categoryKeys, "projectProcessTemplate.categoryKeys", false);
  const typologyKeys = requireSystemKeyArray(input.typologyKeys, "projectProcessTemplate.typologyKeys", false);
  const requiredScopeHintKeys = requireSystemKeyArray(
    input.requiredScopeHintKeys,
    "projectProcessTemplate.requiredScopeHintKeys",
    true
  );
  const optionalScopeHintKeys = requireSystemKeyArray(
    input.optionalScopeHintKeys,
    "projectProcessTemplate.optionalScopeHintKeys",
    true
  );
  assertUniqueKeys(categoryKeys, "projectProcessTemplate category keys must be unique");
  assertUniqueKeys(typologyKeys, "projectProcessTemplate typology keys must be unique");
  assertUniqueKeys(
    [...requiredScopeHintKeys, ...optionalScopeHintKeys],
    "projectProcessTemplate scope hint keys must be unique"
  );

  return {
    id: requireNonEmptyString(input.id, "projectProcessTemplate.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    key: requireSystemKey(input.key, "projectProcessTemplate.key"),
    label: requireNonEmptyString(input.label, "projectProcessTemplate.label"),
    categoryKeys,
    typologyKeys,
    requiredScopeHintKeys,
    optionalScopeHintKeys,
    baseConfidence: requireProbability(input.baseConfidence, "projectProcessTemplate.baseConfidence"),
    priority: requirePositiveInteger(input.priority, "projectProcessTemplate.priority"),
    active: requireBoolean(input.active, "projectProcessTemplate.active"),
    version: requirePositiveInteger(input.version, "projectProcessTemplate.version"),
    assumptions: cloneAssumptions(input.assumptions),
    updatedAt: requireValidTimestamp(input.updatedAt, "projectProcessTemplate.updatedAt")
  };
}
