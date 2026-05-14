import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";

export type TenantConfigurationStatus = "draft" | "active" | "archived";

export type TenantConfiguration = {
  id: string;
  tenantId: TenantId;
  version: number;
  labelSetVersion: number;
  status: TenantConfigurationStatus;
  createdBy: TenantUserId;
  createdAt: string;
  activatedAt?: string;
};

export type TenantLabelSet = {
  tenantId: TenantId;
  configurationVersion: number;
  labels: Record<string, string>;
  updatedAt: string;
};

export type TenantLabelChangeTrace = {
  tenantId: TenantId;
  configurationVersion: number;
  previousConfigurationVersion: number;
  changedLabel: {
    key: string;
    beforeLabel: string;
    afterLabel: string;
  };
  labels: Record<string, string>;
};

export type TenantLabelUpdateResult = {
  labelSet: TenantLabelSet;
  trace: TenantLabelChangeTrace;
};

export class TenantConfigModelError extends Error {
  constructor(
    readonly code: "validation_error" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "TenantConfigModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TenantConfigModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new TenantConfigModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new TenantConfigModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireValidStatus(value: TenantConfigurationStatus | undefined): TenantConfigurationStatus {
  if (value !== "draft" && value !== "active" && value !== "archived") {
    throw new TenantConfigModelError("validation_error", "tenantConfiguration.status is invalid");
  }

  return value;
}

function normalizeLabels(labels: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, label] of Object.entries(labels)) {
    normalized[requireNonEmptyString(key, "tenantLabel.key")] = requireNonEmptyString(label, "tenantLabel.label");
  }

  if (Object.keys(normalized).length === 0) {
    throw new TenantConfigModelError("validation_error", "tenantLabelSet.labels must not be empty");
  }

  return normalized;
}

export function createTenantConfiguration(input: {
  id: string;
  tenantId: TenantId;
  version: number;
  labelSetVersion: number;
  status: TenantConfigurationStatus;
  createdBy: TenantUserId;
  createdAt: string;
  activatedAt?: string;
}): TenantConfiguration {
  return {
    id: requireNonEmptyString(input.id, "tenantConfiguration.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    version: requirePositiveInteger(input.version, "tenantConfiguration.version"),
    labelSetVersion: requirePositiveInteger(input.labelSetVersion, "tenantConfiguration.labelSetVersion"),
    status: requireValidStatus(input.status),
    createdBy: requireNonEmptyString(input.createdBy, "tenantConfiguration.createdBy"),
    createdAt: requireValidTimestamp(input.createdAt, "tenantConfiguration.createdAt"),
    ...(input.activatedAt !== undefined
      ? { activatedAt: requireValidTimestamp(input.activatedAt, "tenantConfiguration.activatedAt") }
      : {})
  };
}

export function createTenantLabelSet(input: {
  tenantId: TenantId;
  configurationVersion: number;
  labels: Record<string, string>;
  updatedAt: string;
}): TenantLabelSet {
  return {
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    configurationVersion: requirePositiveInteger(input.configurationVersion, "tenantLabelSet.configurationVersion"),
    labels: normalizeLabels(input.labels),
    updatedAt: requireValidTimestamp(input.updatedAt, "tenantLabelSet.updatedAt")
  };
}

export function resolveTenantLabel(labelSet: TenantLabelSet, key: string, fallbackLabel?: string): string {
  const labelKey = requireNonEmptyString(key, "tenantLabel.key");
  const label = labelSet.labels[labelKey];

  if (label !== undefined) {
    return label;
  }

  if (fallbackLabel !== undefined) {
    return requireNonEmptyString(fallbackLabel, "tenantLabel.fallbackLabel");
  }

  throw new TenantConfigModelError("validation_error", `Tenant label is not configured: ${labelKey}`);
}

export function updateTenantLabel(
  current: TenantLabelSet,
  input: {
    key: string;
    label: string;
    expectedConfigurationVersion: number;
    updatedAt: string;
  }
): TenantLabelUpdateResult {
  const key = requireNonEmptyString(input.key, "tenantLabel.key");
  const afterLabel = requireNonEmptyString(input.label, "tenantLabel.label");
  const expectedConfigurationVersion = requirePositiveInteger(
    input.expectedConfigurationVersion,
    "expectedConfigurationVersion"
  );
  const updatedAt = requireValidTimestamp(input.updatedAt, "tenantLabelSet.updatedAt");
  const currentVersion = requirePositiveInteger(current.configurationVersion, "tenantLabelSet.configurationVersion");

  if (expectedConfigurationVersion !== currentVersion) {
    throw new TenantConfigModelError(
      "conflict",
      `Tenant label configuration version conflict: expected ${expectedConfigurationVersion}, current ${currentVersion}`
    );
  }

  const beforeLabel = current.labels[key] ?? "";
  const nextLabels = {
    ...normalizeLabels(current.labels),
    [key]: afterLabel
  };
  const nextVersion = currentVersion + 1;
  const labelSet = createTenantLabelSet({
    tenantId: current.tenantId,
    configurationVersion: nextVersion,
    labels: nextLabels,
    updatedAt
  });

  return {
    labelSet,
    trace: {
      tenantId: labelSet.tenantId,
      configurationVersion: labelSet.configurationVersion,
      previousConfigurationVersion: currentVersion,
      changedLabel: {
        key,
        beforeLabel,
        afterLabel
      },
      labels: { ...labelSet.labels }
    }
  };
}
