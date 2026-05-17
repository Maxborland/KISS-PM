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
  latestRun: Phase12ReleaseReadinessRun | null;
};

export type Phase12ReleaseReadinessRun = {
  id: string;
  tenantId: string;
  status: Phase12ReadinessStatus;
  checkedAt: string;
  auditEventId: string;
  summary: Phase12ReleaseReadinessReadModel["summary"];
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
  latestRun?: Phase12ReleaseReadinessRun | null;
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
    openBlockers,
    latestRun: input.latestRun === undefined || input.latestRun === null ? null : cloneRun(input.latestRun)
  };
}

function cloneRun(run: Phase12ReleaseReadinessRun): Phase12ReleaseReadinessRun {
  return {
    ...run,
    summary: { ...run.summary },
    checks: run.checks.map((check) => ({ ...check })),
    openBlockers: run.openBlockers.map((blocker) => ({ ...blocker }))
  };
}

export function createPhase12ReadinessRuntimeState() {
  const runs = new Map<string, Phase12ReleaseReadinessRun>();
  const latestRunIds = new Map<string, string>();
  let runCounter = 0;

  function read(input: {
    tenantId: string;
    generatedAt: string;
    deployment: Phase12DeploymentEnvironmentResult;
  }): Phase12ReleaseReadinessReadModel {
    const latestRunId = latestRunIds.get(input.tenantId);
    const latestRun = latestRunId === undefined ? null : runs.get(latestRunId) ?? null;
    return buildPhase12ReleaseReadinessReadModel({
      ...input,
      latestRun
    });
  }

  function run(input: {
    tenantId: string;
    checkedAt: string;
    deployment: Phase12DeploymentEnvironmentResult;
  }): Phase12ReleaseReadinessRun {
    runCounter += 1;
    const readModel = buildPhase12ReleaseReadinessReadModel({
      tenantId: input.tenantId,
      generatedAt: input.checkedAt,
      deployment: input.deployment
    });
    const id = `p12-readiness-${input.tenantId}-${runCounter.toString().padStart(4, "0")}`;
    const runSnapshot: Phase12ReleaseReadinessRun = {
      id,
      tenantId: input.tenantId,
      status: readModel.summary.status,
      checkedAt: input.checkedAt,
      auditEventId: `audit-${id}`,
      summary: { ...readModel.summary },
      checks: readModel.checks.map((check) => ({ ...check })),
      openBlockers: readModel.openBlockers.map((blocker) => ({ ...blocker }))
    };
    runs.set(id, cloneRun(runSnapshot));
    latestRunIds.set(input.tenantId, id);

    return cloneRun(runSnapshot);
  }

  function getRun(tenantId: string, runId: string): Phase12ReleaseReadinessRun | null {
    const runSnapshot = runs.get(runId);
    if (runSnapshot === undefined || runSnapshot.tenantId !== tenantId) {
      return null;
    }

    return cloneRun(runSnapshot);
  }

  return {
    read,
    run,
    getRun
  };
}
