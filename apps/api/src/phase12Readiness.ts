import type { Phase12DeploymentEnvironmentResult } from "./phase12Deployment";

export type Phase12ReadinessStatus = "passed" | "failed" | "blocked";

export type Phase12ReadinessCheck = {
  id: string;
  category: "deployment" | "observability" | "dependency" | "e2e" | "matrix";
  status: Phase12ReadinessStatus;
  severity: "info" | "important" | "critical";
  expected: string;
  actual: string;
  recoveryText: string;
};

export type Phase12ReleaseBlocker = {
  id: string;
  severity: "important" | "critical";
  reason: string;
  recoveryText: string;
};

export type Phase12ReleaseReadinessReadModel = {
  tenantId: string;
  generatedAt: string;
  summary: {
    status: Phase12ReadinessStatus;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    blockedChecks: number;
  };
  deployment: Phase12DeploymentEnvironmentResult;
  observability: {
    mode: "local-readiness";
    errorBoundary: "pending-ui-surface";
    sensitiveDataPolicy: "redacted";
  };
  checks: Phase12ReadinessCheck[];
  openBlockers: Phase12ReleaseBlocker[];
};

function mapDeploymentStatus(deployment: Phase12DeploymentEnvironmentResult): Phase12ReadinessCheck {
  return {
    id: "p12.deployment-smoke",
    category: "deployment",
    status: deployment.status === "passed" ? "passed" : "failed",
    severity: "critical",
    expected: "Production-like deployment environment passes safe validation",
    actual: deployment.status,
    recoveryText: "Fix failed /health/deployment checks before running E2E-113."
  };
}

function externalDependencyCheck(deployment: Phase12DeploymentEnvironmentResult): Phase12ReadinessCheck {
  const externalMode = deployment.checks.find((check) => check.id === "external-services-mode")?.actual;
  const mocked = externalMode === "mocked";
  return {
    id: "p12.no-live-external-dependency",
    category: "dependency",
    status: mocked ? "passed" : "blocked",
    severity: mocked ? "info" : "critical",
    expected: "Critical release smoke uses mocked external services",
    actual: externalMode ?? "unknown",
    recoveryText: "Set KISS_PM_EXTERNAL_SERVICES_MODE=mocked for deterministic release readiness checks."
  };
}

export function buildPhase12ReleaseReadinessReadModel(input: {
  tenantId: string;
  generatedAt: string;
  deployment: Phase12DeploymentEnvironmentResult;
}): Phase12ReleaseReadinessReadModel {
  const checks: Phase12ReadinessCheck[] = [
    mapDeploymentStatus(input.deployment),
    {
      id: "p12.observability-read-model",
      category: "observability",
      status: "passed",
      severity: "important",
      expected: "Readiness API exposes typed local observability evidence without secret payloads",
      actual: "local-readiness",
      recoveryText: "Wire operator UI and external telemetry adapters in later P12 blocks if required."
    },
    externalDependencyCheck(input.deployment),
    {
      id: "p12.e2e-110-115",
      category: "e2e",
      status: "blocked",
      severity: "critical",
      expected: "E2E-110..115 implemented and passing",
      actual: "not-implemented",
      recoveryText: "Implement deterministic Phase 12 fixtures and Playwright E2E-110..115 before P12-010."
    },
    {
      id: "p12.strict-matrix",
      category: "matrix",
      status: "blocked",
      severity: "critical",
      expected: "docs/status/phase12-requirements-matrix.json passes strict verifier",
      actual: "blocked",
      recoveryText: "Keep matrix truthful until all P12 rows and E2E evidence are verified."
    }
  ];

  const openBlockers = checks
    .filter((check) => check.status !== "passed")
    .map((check) => ({
      id: check.id,
      severity: check.severity === "critical" ? "critical" : "important",
      reason: check.actual,
      recoveryText: check.recoveryText
    })) satisfies Phase12ReleaseBlocker[];

  const failedChecks = checks.filter((check) => check.status === "failed").length;
  const blockedChecks = checks.filter((check) => check.status === "blocked").length;
  const status: Phase12ReadinessStatus = failedChecks > 0 ? "failed" : blockedChecks > 0 ? "blocked" : "passed";

  return {
    tenantId: input.tenantId,
    generatedAt: input.generatedAt,
    summary: {
      status,
      totalChecks: checks.length,
      passedChecks: checks.filter((check) => check.status === "passed").length,
      failedChecks,
      blockedChecks
    },
    deployment: input.deployment,
    observability: {
      mode: "local-readiness",
      errorBoundary: "pending-ui-surface",
      sensitiveDataPolicy: "redacted"
    },
    checks,
    openBlockers
  };
}
