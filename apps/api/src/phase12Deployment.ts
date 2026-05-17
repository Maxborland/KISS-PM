export type Phase12DeploymentTarget = "development" | "test" | "production_like" | "production";

export type Phase12DeploymentCheckStatus = "passed" | "failed" | "warning";

export type Phase12DeploymentCheck = {
  id: string;
  label: string;
  status: Phase12DeploymentCheckStatus;
  severity: "info" | "important" | "critical";
  expected: string;
  actual: string;
  recoveryText: string;
};

export type Phase12DeploymentEnvironmentResult = {
  service: "kiss-pm-api";
  status: "passed" | "failed";
  target: Phase12DeploymentTarget;
  checks: Phase12DeploymentCheck[];
};

export type Phase12DeploymentEnvironment = Record<string, string | undefined>;

const requiredProductionVariables = [
  "KISS_PM_PUBLIC_BASE_URL",
  "KISS_PM_API_BASE_URL",
  "KISS_PM_ALLOWED_ORIGINS",
  "KISS_PM_SECRET_REF",
  "KISS_PM_AUDIT_RETENTION_DAYS",
  "KISS_PM_EXTERNAL_SERVICES_MODE"
] as const;

const devOnlySwitches = [
  "KISS_PM_ALLOW_TEST_FIXTURE_RESET",
  "KISS_PM_ALLOW_TEST_FIXTURE_AUTH",
  "VITE_KISS_PM_ALLOW_FIXTURE_AUTH"
] as const;

function normalizeTarget(value: string | undefined): Phase12DeploymentTarget {
  if (value === "production" || value === "production_like" || value === "test" || value === "development") {
    return value;
  }

  return "development";
}

function hasConfiguredValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isUrl(value: string | undefined): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const candidate = value.trim();

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function isSecretReference(value: string | undefined): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  return /^(secret|vault|env):\/\//.test(value.trim());
}

function createCheck(input: Phase12DeploymentCheck): Phase12DeploymentCheck {
  return input;
}

export function validatePhase12DeploymentEnvironment(
  environment: Phase12DeploymentEnvironment = process.env
): Phase12DeploymentEnvironmentResult {
  const target = normalizeTarget(environment.KISS_PM_RUNTIME_ENV ?? environment.NODE_ENV);
  const productionLike = target === "production" || target === "production_like";
  const checks: Phase12DeploymentCheck[] = [];

  checks.push(
    createCheck({
      id: "runtime-target",
      label: "Runtime target",
      status: productionLike ? "passed" : "warning",
      severity: productionLike ? "info" : "important",
      expected: "production_like or production for release smoke",
      actual: target,
      recoveryText: "Set KISS_PM_RUNTIME_ENV=production_like for local release smoke or production in real deployment."
    })
  );

  for (const key of requiredProductionVariables) {
    const configured = hasConfiguredValue(environment[key]);
    checks.push(
      createCheck({
        id: `required-env.${key}`,
        label: key,
        status: !productionLike || configured ? "passed" : "failed",
        severity: productionLike ? "critical" : "important",
        expected: productionLike ? "configured" : "configured before production smoke",
        actual: configured ? "configured" : "missing",
        recoveryText: `Configure ${key} through the deployment secret/env store. Do not commit real values.`
      })
    );
  }

  checks.push(
    createCheck({
      id: "public-base-url",
      label: "Public base URL",
      status: !productionLike || isUrl(environment.KISS_PM_PUBLIC_BASE_URL) ? "passed" : "failed",
      severity: "critical",
      expected: "https URL, localhost, or 127.0.0.1 for deterministic local smoke",
      actual: isUrl(environment.KISS_PM_PUBLIC_BASE_URL) ? "valid-url" : "invalid-url",
      recoveryText: "Set KISS_PM_PUBLIC_BASE_URL to the web origin used by operators."
    })
  );

  checks.push(
    createCheck({
      id: "api-base-url",
      label: "API base URL",
      status: !productionLike || isUrl(environment.KISS_PM_API_BASE_URL) ? "passed" : "failed",
      severity: "critical",
      expected: "https URL, localhost, or 127.0.0.1 for deterministic local smoke",
      actual: isUrl(environment.KISS_PM_API_BASE_URL) ? "valid-url" : "invalid-url",
      recoveryText: "Set KISS_PM_API_BASE_URL to the API origin used by web clients and smoke checks."
    })
  );

  checks.push(
    createCheck({
      id: "secret-ref.KISS_PM_SECRET_REF",
      label: "Application secret reference",
      status: !productionLike || isSecretReference(environment.KISS_PM_SECRET_REF) ? "passed" : "failed",
      severity: "critical",
      expected: "secret://, vault://, or env:// reference",
      actual: isSecretReference(environment.KISS_PM_SECRET_REF) ? "configured" : "invalid-secret-reference",
      recoveryText: "Store the real secret outside git and provide only a secret-manager reference."
    })
  );

  checks.push(
    createCheck({
      id: "external-services-mode",
      label: "External services mode",
      status:
        environment.KISS_PM_EXTERNAL_SERVICES_MODE === "mocked" || environment.KISS_PM_EXTERNAL_SERVICES_MODE === "adapter"
          ? "passed"
          : productionLike
            ? "failed"
            : "warning",
      severity: productionLike ? "critical" : "important",
      expected: "mocked for release smoke, adapter only when explicitly configured",
      actual: environment.KISS_PM_EXTERNAL_SERVICES_MODE === "adapter" ? "adapter" : environment.KISS_PM_EXTERNAL_SERVICES_MODE === "mocked" ? "mocked" : "missing",
      recoveryText: "Use mocked external services for deterministic release smoke unless a scoped adapter run is explicitly planned."
    })
  );

  for (const key of devOnlySwitches) {
    const enabled = environment[key] === "true";
    checks.push(
      createCheck({
        id: `dev-only.${key}`,
        label: key,
        status: productionLike && enabled ? "failed" : "passed",
        severity: productionLike ? "critical" : "important",
        expected: "disabled for production-like and production release smoke",
        actual: enabled ? "enabled" : "disabled",
        recoveryText: `Unset ${key} before production-like or production deployment smoke.`
      })
    );
  }

  return {
    service: "kiss-pm-api",
    status: checks.some((check) => check.status === "failed") ? "failed" : "passed",
    target,
    checks
  };
}

export function shouldAllowPhase12TestFixtureAuth(environment: Phase12DeploymentEnvironment = process.env): boolean {
  const target = normalizeTarget(environment.KISS_PM_RUNTIME_ENV ?? environment.NODE_ENV);
  const productionLike = target === "production" || target === "production_like";

  return environment.KISS_PM_ALLOW_TEST_FIXTURE_AUTH === "true" || !productionLike;
}
