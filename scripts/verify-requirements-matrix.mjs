import { readFileSync, statSync } from "node:fs";

const args = process.argv.slice(2);
const allowBlocked = args.includes("--allow-blocked");
const matrixPath = args.find((arg) => !arg.startsWith("--")) ?? "docs/status/phase1-requirements-matrix.json";
const e2eRunMetadataPath =
  process.env.KISS_PM_E2E_RUN_METADATA_PATH ?? "test-results/kiss-pm-e2e-last-run.json";

const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const failures = [];
const release2E2eIds = Array.from({ length: 10 }, (_, index) => `E2E-R2-${String(index + 1).padStart(3, "0")}`);
const release2E2eTestPath = {
  "E2E-R2-001": "e2e/tests/release2/portfolio-control.spec.ts",
  "E2E-R2-002": "e2e/tests/release2/gantt-planning.spec.ts",
  "E2E-R2-003": "e2e/tests/release2/gantt-planning.spec.ts",
  "E2E-R2-004": "e2e/tests/release2/resource-capacity.spec.ts",
  "E2E-R2-005": "e2e/tests/release2/resource-capacity.spec.ts",
  "E2E-R2-006": "e2e/tests/release2/portfolio-control.spec.ts",
  "E2E-R2-007": "e2e/tests/release2/retrospective.spec.ts",
  "E2E-R2-008": "e2e/tests/release2/tenant-admin-config.spec.ts",
  "E2E-R2-009": "e2e/tests/release2/tenant-admin-config.spec.ts",
  "E2E-R2-010": "e2e/tests/release2/sales-demo-first-five-minutes.spec.ts"
};
const requiredIdsByPhase = {
  P1: Array.from({ length: 10 }, (_, index) => `P1-${String(index + 1).padStart(3, "0")}`),
  "P2-contract": ["P2C-001", "P2C-002", "P2C-003"],
  P2: Array.from({ length: 10 }, (_, index) => `P2-${String(index + 1).padStart(3, "0")}`),
  "P3-contract": ["P3C-001", "P3C-002", "P3C-003"],
  P3: Array.from({ length: 10 }, (_, index) => `P3-${String(index + 1).padStart(3, "0")}`),
  "P4-contract": ["P4C-001", "P4C-002", "P4C-003"],
  P4: Array.from({ length: 10 }, (_, index) => `P4-${String(index + 1).padStart(3, "0")}`),
  "P5-contract": ["P5C-001", "P5C-002", "P5C-003"],
  P5: Array.from({ length: 10 }, (_, index) => `P5-${String(index + 1).padStart(3, "0")}`),
  P6: Array.from({ length: 10 }, (_, index) => `P6-${String(index + 1).padStart(3, "0")}`),
  P7: Array.from({ length: 10 }, (_, index) => `P7-${String(index + 1).padStart(3, "0")}`),
  P8: Array.from({ length: 10 }, (_, index) => `P8-${String(index + 1).padStart(3, "0")}`),
  P9: Array.from({ length: 10 }, (_, index) => `P9-${String(index + 1).padStart(3, "0")}`),
  P10: Array.from({ length: 10 }, (_, index) => `P10-${String(index + 1).padStart(3, "0")}`),
  P11: Array.from({ length: 10 }, (_, index) => `P11-${String(index + 1).padStart(3, "0")}`),
  P12: Array.from({ length: 10 }, (_, index) => `P12-${String(index + 1).padStart(3, "0")}`)
};

function verifyRelease2Matrix() {
  const rows = Array.isArray(matrix.rows) ? matrix.rows : [];
  const requiredIds = Array.from({ length: 12 }, (_, index) => `R2-${String(index + 1).padStart(3, "0")}`);
  const rowById = new Map(rows.map((row) => [row.id, row]));

  if (rows.length === 0) {
    failures.push("matrix.rows must be a non-empty array");
  }
  for (const requiredId of requiredIds) {
    if (!rowById.has(requiredId)) {
      failures.push(`${requiredId}: missing required R2 row`);
    }
  }
  for (const row of rows) {
    if (!requiredIds.includes(row.id)) {
      failures.push(`${row.id ?? "unknown"}: unexpected row id for R2 matrix`);
    }
    if (row.status !== "done") {
      failures.push(`${row.id}: status must be done for Release 2 exit verification, got ${row.status}`);
    }
    if (!Array.isArray(row.done_evidence) || row.done_evidence.length === 0) {
      failures.push(`${row.id}: done row missing done_evidence`);
    }
    if (!Array.isArray(row.owned_scope) || row.owned_scope.length === 0) {
      failures.push(`${row.id}: row missing owned_scope`);
    }
  }

  const exitRow = rowById.get("R2-012");
  if (exitRow && !sameStringSet(exitRow.required_e2e, release2E2eIds)) {
    failures.push("R2-012: required_e2e must exactly match E2E-R2-001..010");
  }

  try {
    const runMetadata = JSON.parse(readFileSync(e2eRunMetadataPath, "utf8"));
    const runMetadataStat = statSync(e2eRunMetadataPath);
    const metadataTestPaths = new Set(
      Array.isArray(runMetadata.testPaths)
        ? runMetadata.testPaths.map((testPath) => String(testPath).replaceAll("\\", "/"))
        : []
    );
    const metadataE2eIds = new Set(Array.isArray(runMetadata.e2eIds) ? runMetadata.e2eIds.map(String) : []);
    const finishedAt = Date.parse(runMetadata.finishedAt);
    const matrixUpdatedAt = Date.parse(matrix.updated_at);
    let newestRelease2InputMtimeMs = statSync(matrixPath).mtimeMs;

    if (runMetadata.profile !== "release2" || runMetadata.status !== "passed" || runMetadata.exitCode !== 0) {
      failures.push("R2: E2E run metadata must come from a passing release2 profile run");
    }
    if (Number.isNaN(finishedAt)) {
      failures.push("R2: E2E run metadata missing valid finishedAt");
    } else if (!Number.isNaN(matrixUpdatedAt) && finishedAt + 120_000 < matrixUpdatedAt) {
      failures.push("R2: E2E run metadata is older than Release 2 matrix updated_at");
    }
    for (const e2eId of release2E2eIds) {
      if (!metadataE2eIds.has(e2eId)) {
        failures.push(`R2: E2E run metadata missing ${e2eId}`);
      }
      const testPath = release2E2eTestPath[e2eId];
      if (!metadataTestPaths.has(testPath)) {
        failures.push(`R2: E2E run metadata missing ${testPath}`);
      }
      try {
        const testPathStat = statSync(testPath);
        if (!testPathStat.isFile()) {
          failures.push(`R2: required E2E test path is not a file at ${testPath}`);
        } else {
          newestRelease2InputMtimeMs = Math.max(newestRelease2InputMtimeMs, testPathStat.mtimeMs);
        }
      } catch {
        failures.push(`R2: required E2E test file missing at ${testPath}`);
      }
    }
    if (!Number.isNaN(finishedAt) && finishedAt + 120_000 < newestRelease2InputMtimeMs) {
      failures.push("R2: E2E run metadata finishedAt is older than Release 2 matrix or required E2E tests");
    }
    if (runMetadataStat.mtimeMs + 120_000 < newestRelease2InputMtimeMs) {
      failures.push("R2: E2E run metadata file is older than Release 2 matrix or required E2E tests");
    }
  } catch {
    failures.push(`R2: missing readable E2E run metadata at ${e2eRunMetadataPath}`);
  }

  if (failures.length > 0) {
    console.error(`Requirements matrix verification failed for ${matrixPath}`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Requirements matrix verified: ${matrixPath}`);
  process.exit(0);
}
const requiredE2eByPhaseRow = {
  P2: {
    "P2-001": ["E2E-010"],
    "P2-002": ["E2E-011"],
    "P2-003": ["E2E-010", "E2E-012"],
    "P2-004": ["E2E-013"],
    "P2-005": [],
    "P2-006": ["E2E-014"],
    "P2-007": ["E2E-010", "E2E-011", "E2E-012", "E2E-013", "E2E-014"],
    "P2-008": ["E2E-011", "E2E-012", "E2E-013", "E2E-014"],
    "P2-009": ["E2E-010", "E2E-011", "E2E-012", "E2E-013", "E2E-014"],
    "P2-010": ["E2E-010", "E2E-011", "E2E-012", "E2E-013", "E2E-014"]
  },
  P3: {
    "P3-001": ["E2E-020"],
    "P3-002": ["E2E-021"],
    "P3-003": ["E2E-020", "E2E-021"],
    "P3-004": ["E2E-021", "E2E-022"],
    "P3-005": ["E2E-022"],
    "P3-006": ["E2E-022"],
    "P3-007": ["E2E-020", "E2E-021", "E2E-022", "E2E-023", "E2E-024"],
    "P3-008": ["E2E-023", "E2E-024"],
    "P3-009": ["E2E-020", "E2E-021", "E2E-022", "E2E-023", "E2E-024"],
    "P3-010": ["E2E-020", "E2E-021", "E2E-022", "E2E-023", "E2E-024"]
  },
  P4: {
    "P4-001": ["E2E-030", "E2E-031", "E2E-032"],
    "P4-002": ["E2E-030", "E2E-031", "E2E-032"],
    "P4-003": ["E2E-031", "E2E-032"],
    "P4-004": ["E2E-030", "E2E-033", "E2E-034"],
    "P4-005": ["E2E-033"],
    "P4-006": ["E2E-034"],
    "P4-007": ["E2E-030", "E2E-031", "E2E-032", "E2E-033", "E2E-034"],
    "P4-008": ["E2E-030", "E2E-031", "E2E-032", "E2E-033", "E2E-034"],
    "P4-009": ["E2E-030", "E2E-031", "E2E-032", "E2E-033", "E2E-034"],
    "P4-010": ["E2E-030", "E2E-031", "E2E-032", "E2E-033", "E2E-034"]
  },
  P5: {
    "P5-001": ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"],
    "P5-002": ["E2E-040", "E2E-041"],
    "P5-003": ["E2E-042"],
    "P5-004": ["E2E-043"],
    "P5-005": ["E2E-044"],
    "P5-006": ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"],
    "P5-007": ["E2E-040"],
    "P5-008": ["E2E-041", "E2E-042", "E2E-043", "E2E-044"],
    "P5-009": ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"],
    "P5-010": ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"]
  },
  P6: {
    "P6-001": ["E2E-050", "E2E-051"],
    "P6-002": ["E2E-050", "E2E-051"],
    "P6-003": ["E2E-050"],
    "P6-004": ["E2E-050", "E2E-051"],
    "P6-005": ["E2E-051"],
    "P6-006": ["E2E-050", "E2E-051", "E2E-052", "E2E-053", "E2E-054", "E2E-055"],
    "P6-007": ["E2E-050", "E2E-051", "E2E-052"],
    "P6-008": ["E2E-052", "E2E-053", "E2E-054", "E2E-055"],
    "P6-009": ["E2E-050", "E2E-051", "E2E-052", "E2E-053", "E2E-054", "E2E-055"],
    "P6-010": ["E2E-050", "E2E-051", "E2E-052", "E2E-053", "E2E-054", "E2E-055"]
  },
  P7: {
    "P7-001": ["E2E-060", "E2E-063", "E2E-064"],
    "P7-002": ["E2E-060", "E2E-061", "E2E-062", "E2E-063"],
    "P7-003": ["E2E-061", "E2E-062"],
    "P7-004": ["E2E-061", "E2E-062", "E2E-063"],
    "P7-005": ["E2E-061", "E2E-062"],
    "P7-006": ["E2E-060", "E2E-063", "E2E-064"],
    "P7-007": ["E2E-060", "E2E-063", "E2E-064"],
    "P7-008": ["E2E-061", "E2E-062"],
    "P7-009": ["E2E-060", "E2E-061", "E2E-062", "E2E-063", "E2E-064"],
    "P7-010": ["E2E-060", "E2E-061", "E2E-062", "E2E-063", "E2E-064"]
  },
  P8: {
    "P8-001": ["E2E-070", "E2E-074", "E2E-075"],
    "P8-002": ["E2E-070", "E2E-074", "E2E-075"],
    "P8-003": ["E2E-071", "E2E-072", "E2E-073", "E2E-074", "E2E-075"],
    "P8-004": ["E2E-072", "E2E-073", "E2E-074"],
    "P8-005": ["E2E-070", "E2E-071", "E2E-073", "E2E-074", "E2E-075"],
    "P8-006": ["E2E-071", "E2E-075"],
    "P8-007": ["E2E-072", "E2E-075"],
    "P8-008": ["E2E-073", "E2E-074", "E2E-075"],
    "P8-009": ["E2E-070", "E2E-071", "E2E-072", "E2E-073", "E2E-074", "E2E-075"],
    "P8-010": ["E2E-070", "E2E-071", "E2E-072", "E2E-073", "E2E-074", "E2E-075"]
  },
  P9: {
    "P9-001": ["E2E-080"],
    "P9-002": ["E2E-080", "E2E-081"],
    "P9-003": ["E2E-081", "E2E-082"],
    "P9-004": ["E2E-082", "E2E-083"],
    "P9-005": ["E2E-082", "E2E-083"],
    "P9-006": ["E2E-082"],
    "P9-007": ["E2E-082"],
    "P9-008": ["E2E-083"],
    "P9-009": ["E2E-080", "E2E-081", "E2E-082", "E2E-083"],
    "P9-010": ["E2E-080", "E2E-081", "E2E-082", "E2E-083"]
  },
  P10: {
    "P10-001": ["E2E-090", "E2E-095"],
    "P10-002": ["E2E-090"],
    "P10-003": ["E2E-090", "E2E-095"],
    "P10-004": ["E2E-091"],
    "P10-005": ["E2E-092", "E2E-094"],
    "P10-006": ["E2E-093"],
    "P10-007": ["E2E-093", "E2E-094", "E2E-095"],
    "P10-008": ["E2E-090", "E2E-091", "E2E-092", "E2E-093", "E2E-094", "E2E-095"],
    "P10-009": ["E2E-090", "E2E-091", "E2E-092", "E2E-093", "E2E-094", "E2E-095"],
    "P10-010": ["E2E-090", "E2E-091", "E2E-092", "E2E-093", "E2E-094", "E2E-095"]
  },
  P11: {
    "P11-001": ["E2E-100", "E2E-101", "E2E-104"],
    "P11-002": ["E2E-100"],
    "P11-003": ["E2E-101", "E2E-104"],
    "P11-004": ["E2E-102", "E2E-104"],
    "P11-005": ["E2E-100", "E2E-102"],
    "P11-006": ["E2E-100", "E2E-101", "E2E-102", "E2E-104"],
    "P11-007": ["E2E-102", "E2E-104"],
    "P11-008": ["E2E-103"],
    "P11-009": ["E2E-100", "E2E-101", "E2E-102", "E2E-103", "E2E-104"],
    "P11-010": ["E2E-100", "E2E-101", "E2E-102", "E2E-103", "E2E-104"]
  },
  P12: {
    "P12-001": ["E2E-113"],
    "P12-002": ["E2E-113", "E2E-115"],
    "P12-003": ["E2E-114"],
    "P12-004": ["E2E-111", "E2E-112"],
    "P12-005": ["E2E-111", "E2E-112"],
    "P12-006": ["E2E-113", "E2E-114"],
    "P12-007": ["E2E-110"],
    "P12-008": ["E2E-110", "E2E-115"],
    "P12-009": ["E2E-110", "E2E-111", "E2E-112", "E2E-113", "E2E-114", "E2E-115"],
    "P12-010": ["E2E-110", "E2E-111", "E2E-112", "E2E-113", "E2E-114", "E2E-115"]
  }
};
const requiredE2eTestPath = {
  "E2E-010": "e2e/tests/phase2/tenant-isolation.spec.ts",
  "E2E-011": "e2e/tests/phase2/access-profile.spec.ts",
  "E2E-012": "e2e/tests/phase2/read-only-permissions.spec.ts",
  "E2E-013": "e2e/tests/phase2/tenant-labels.spec.ts",
  "E2E-014": "e2e/tests/phase2/audit-basics.spec.ts",
  "E2E-020": "e2e/tests/phase3/opportunity-create.spec.ts",
  "E2E-021": "e2e/tests/phase3/intake-readiness.spec.ts",
  "E2E-022": "e2e/tests/phase3/feasibility-analysis.spec.ts",
  "E2E-023": "e2e/tests/phase3/project-draft-from-opportunity.spec.ts",
  "E2E-024": "e2e/tests/phase3/project-draft-canonical.spec.ts",
  "E2E-030": "e2e/tests/phase4/project-from-template.spec.ts",
  "E2E-031": "e2e/tests/phase4/stage-transition.spec.ts",
  "E2E-032": "e2e/tests/phase4/stage-gate-block.spec.ts",
  "E2E-033": "e2e/tests/phase4/my-tasks-relations.spec.ts",
  "E2E-034": "e2e/tests/phase4/kanban-canonical-task.spec.ts",
  "E2E-040": "e2e/tests/phase5/open-gantt.spec.ts",
  "E2E-041": "e2e/tests/phase5/gantt-task-cross-view.spec.ts",
  "E2E-042": "e2e/tests/phase5/gantt-date-persist.spec.ts",
  "E2E-043": "e2e/tests/phase5/gantt-dependency.spec.ts",
  "E2E-044": "e2e/tests/phase5/baseline-stability.spec.ts",
  "E2E-050": "e2e/tests/phase6/resource-load.spec.ts",
  "E2E-051": "e2e/tests/phase6/overload-detection.spec.ts",
  "E2E-052": "e2e/tests/phase6/overload-resolution-entry.spec.ts",
  "E2E-053": "e2e/tests/phase6/resolution-dry-run.spec.ts",
  "E2E-054": "e2e/tests/phase6/resolution-apply-audit.spec.ts",
  "E2E-055": "e2e/tests/phase6/resource-resolution-permissions.spec.ts",
  "E2E-060": "e2e/tests/phase7/kpi-threshold.spec.ts",
  "E2E-061": "e2e/tests/phase7/kpi-control-signal.spec.ts",
  "E2E-062": "e2e/tests/phase7/kpi-traceability.spec.ts",
  "E2E-063": "e2e/tests/phase7/kpi-versioning.spec.ts",
  "E2E-064": "e2e/tests/phase7/kpi-permissions.spec.ts",
  "E2E-070": "e2e/tests/phase8/portfolio-to-gantt.spec.ts",
  "E2E-071": "e2e/tests/phase8/kpi-corrective-task.spec.ts",
  "E2E-072": "e2e/tests/phase8/resource-control-action.spec.ts",
  "E2E-073": "e2e/tests/phase8/accept-risk-audit.spec.ts",
  "E2E-074": "e2e/tests/phase8/action-permissions.spec.ts",
  "E2E-075": "e2e/tests/phase8/control-surface-refresh.spec.ts",
  "E2E-080": "e2e/tests/phase9/project-closure.spec.ts",
  "E2E-081": "e2e/tests/phase9/closed-snapshot-stability.spec.ts",
  "E2E-082": "e2e/tests/phase9/closed-portfolio-trends.spec.ts",
  "E2E-083": "e2e/tests/phase9/template-improvement-action.spec.ts",
  "E2E-090": "e2e/tests/phase10/labels-runtime.spec.ts",
  "E2E-091": "e2e/tests/phase10/custom-field-control-surface.spec.ts",
  "E2E-092": "e2e/tests/phase10/kpi-builder-effect.spec.ts",
  "E2E-093": "e2e/tests/phase10/control-surface-layout-builder.spec.ts",
  "E2E-094": "e2e/tests/phase10/config-validation.spec.ts",
  "E2E-095": "e2e/tests/phase10/config-regression.spec.ts",
  "E2E-100": "e2e/tests/phase11/adapter-import.spec.ts",
  "E2E-101": "e2e/tests/phase11/adapter-idempotency.spec.ts",
  "E2E-102": "e2e/tests/phase11/adapter-failure.spec.ts",
  "E2E-103": "e2e/tests/phase11/imported-project-canonical.spec.ts",
  "E2E-104": "e2e/tests/phase11/external-mapping-diagnostics.spec.ts",
  "E2E-110": "e2e/tests/phase12/full-critical-journey.spec.ts",
  "E2E-111": "e2e/tests/phase12/permission-matrix-smoke.spec.ts",
  "E2E-112": "e2e/tests/phase12/tenant-isolation-full.spec.ts",
  "E2E-113": "e2e/tests/phase12/production-deploy-smoke.spec.ts",
  "E2E-114": "e2e/tests/phase12/recovery-smoke.spec.ts",
  "E2E-115": "e2e/tests/phase12/no-live-external-dependency.spec.ts"
};
if (matrix.release === "R2") {
  verifyRelease2Matrix();
}

const requiredIds = requiredIdsByPhase[matrix.phase];
const requiredE2eByRow = requiredE2eByPhaseRow[matrix.phase] ?? {};
const seenIds = new Set();
const expectedE2ePhaseNumber = matrix.phase?.match(/^P(\d+)$/)?.[1];
const isPhaseExitMatrix = /^P\d+$/.test(matrix.phase ?? "");
let newestRequiredE2eCheckedAt = Number.NEGATIVE_INFINITY;
const requiredPhaseE2eIds = new Set();
const requiredPhaseE2ePaths = new Set();

function sameStringSet(actual, expected) {
  if (!Array.isArray(actual)) return false;
  if (actual.length !== expected.length) return false;
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  return expectedSorted.every((value, index) => actualSorted[index] === value);
}

function hasGlobSyntax(path) {
  return /[*?[\]{}]/.test(path);
}

function normalizeMatrixPath(path) {
  return path.replaceAll("\\", "/").replace(/\/+$/, "");
}

function verifyOwnedScopePaths(row) {
  if (!Array.isArray(row.owned_scope) || row.owned_scope.length === 0) {
    failures.push(`${row.id}: verified row missing owned_scope`);
    return;
  }

  for (const rawPath of row.owned_scope) {
    if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
      failures.push(`${row.id}: owned_scope entries must be non-empty strings`);
      continue;
    }

    const normalizedPath = normalizeMatrixPath(rawPath.trim());
    if (hasGlobSyntax(normalizedPath)) continue;

    try {
      statSync(normalizedPath);
    } catch {
      failures.push(`${row.id}: owned_scope path missing: ${normalizedPath}`);
    }
  }
}

if (!requiredIds) {
  failures.push(`unsupported matrix phase: ${matrix.phase}`);
}

if (!Array.isArray(matrix.rows) || matrix.rows.length === 0) {
  failures.push("matrix.rows must be a non-empty array");
}

for (const row of matrix.rows ?? []) {
  if (!row.id) failures.push("row without id");
  if (seenIds.has(row.id)) {
    failures.push(`${row.id}: duplicate row id`);
  }
  seenIds.add(row.id);
  if (requiredIds && !requiredIds.includes(row.id)) {
    failures.push(`${row.id}: unexpected row id for ${matrix.phase} matrix`);
  }
  const expectedRequiredE2e = requiredE2eByRow[row.id];
  if (expectedRequiredE2e && !sameStringSet(row.required_e2e, expectedRequiredE2e)) {
    failures.push(`${row.id}: required_e2e must exactly match phase contract`);
  }
  if (row.status !== "verified" && row.status !== "blocked") {
    failures.push(`${row.id}: status must be verified or blocked, got ${row.status}`);
  }
  if (row.status === "blocked" && !allowBlocked) {
    failures.push(`${row.id}: blocked row requires --allow-blocked and cannot pass phase-exit verification`);
  }
  if (row.status === "verified") {
    const tests = Array.isArray(row.tests) ? row.tests : [];
    const rowLastCheckedAt = row.last_checked_at ? Date.parse(row.last_checked_at) : Number.NaN;

    verifyOwnedScopePaths(row);

    if (!Array.isArray(row.evidence) || row.evidence.length === 0) {
      failures.push(`${row.id}: verified row missing evidence`);
    }
    if (
      (typeof row.blocker === "string" && row.blocker.trim().length > 0) ||
      (row.blocker !== null && row.blocker !== undefined && typeof row.blocker !== "string")
    ) {
      failures.push(`${row.id}: verified row must not retain blocker text`);
    }
    if (!Array.isArray(row.tests) || row.tests.length === 0) {
      failures.push(`${row.id}: verified row missing tests`);
    }
    if (typeof row.cleanup !== "string" || row.cleanup.trim().length === 0) {
      failures.push(`${row.id}: verified row missing cleanup evidence`);
    } else if (
      /no runtime cleanup yet/i.test(row.cleanup) ||
      (["P8", "P9", "P10", "P11", "P12"].includes(matrix.phase) &&
        /^(no runtime cleanup|no runtime state exists yet)/i.test(row.cleanup.trim()))
    ) {
      failures.push(`${row.id}: verified row cleanup evidence is still a placeholder`);
    }
    if (!row.last_checked_at) {
      failures.push(`${row.id}: verified row missing last_checked_at`);
    } else if (Number.isNaN(rowLastCheckedAt)) {
      failures.push(`${row.id}: last_checked_at is not a valid timestamp`);
    }
    if (!tests.some((test) => /exit 0|manual review/i.test(test))) {
      failures.push(`${row.id}: verified row tests must include exit 0 or manual review evidence`);
    }
    const requiredE2e = expectedRequiredE2e ?? (Array.isArray(row.required_e2e) ? row.required_e2e : []);
    if (requiredE2e.length > 0) {
      const hasE2eEvidenceField = Object.hasOwn(row, "e2e_evidence");
      if (hasE2eEvidenceField && !Array.isArray(row.e2e_evidence)) {
        failures.push(`${row.id}: e2e_evidence must be an array when supplied`);
      }
      const e2eEvidence = Array.isArray(row.e2e_evidence) ? row.e2e_evidence : [];
      const canDeferE2eEvidence = allowBlocked && matrix.phase === "P4";
      const shouldValidateE2eEvidence = !canDeferE2eEvidence || e2eEvidence.length > 0;

      if (shouldValidateE2eEvidence) {
        for (const e2eId of requiredE2e) {
          requiredPhaseE2eIds.add(e2eId);
          if (requiredE2eTestPath[e2eId]) {
            requiredPhaseE2ePaths.add(requiredE2eTestPath[e2eId]);
          }
          const matchingEvidence = e2eEvidence.find((entry) => entry?.id === e2eId);
          if (!matchingEvidence) {
            failures.push(`${row.id}: verified row missing structured E2E evidence for ${e2eId}`);
            continue;
          }
          if (matchingEvidence.exit_code !== 0) {
            failures.push(`${row.id}: ${e2eId} E2E evidence must have exit_code 0`);
          }
          if (matchingEvidence.status !== "passed") {
            failures.push(`${row.id}: ${e2eId} E2E evidence status must be passed`);
          }
          if (typeof matchingEvidence.command !== "string" || !matchingEvidence.command.includes("test:e2e:phase")) {
            failures.push(`${row.id}: ${e2eId} E2E evidence must include the phase E2E command`);
          }
          if (
            expectedE2ePhaseNumber &&
            typeof matchingEvidence.command === "string" &&
            !new RegExp(`--phase(?:=|\\s+)${expectedE2ePhaseNumber}(?:\\s|$)`).test(matchingEvidence.command)
          ) {
            failures.push(`${row.id}: ${e2eId} E2E evidence command must target phase ${expectedE2ePhaseNumber}`);
          }
          const normalizedTestPath =
            typeof matchingEvidence.test_path === "string" ? matchingEvidence.test_path.replaceAll("\\", "/") : null;
          const expectedTestPath = requiredE2eTestPath[e2eId];
          if (!normalizedTestPath) {
            failures.push(`${row.id}: ${e2eId} E2E evidence must include a phase E2E test_path`);
          } else if (expectedTestPath && normalizedTestPath !== expectedTestPath) {
            failures.push(`${row.id}: ${e2eId} E2E evidence test_path must match ${expectedTestPath}`);
          } else if (
            !expectedTestPath &&
            !(
              expectedE2ePhaseNumber
                ? normalizedTestPath.startsWith(`e2e/tests/phase${expectedE2ePhaseNumber}/`)
                : /^e2e\/tests\/phase\d+\//.test(normalizedTestPath)
            )
          ) {
            failures.push(`${row.id}: ${e2eId} E2E evidence must include a phase E2E test_path`);
          }
          if (!matchingEvidence.checked_at || Number.isNaN(Date.parse(matchingEvidence.checked_at))) {
            failures.push(`${row.id}: ${e2eId} E2E evidence missing valid checked_at`);
          } else if (!Number.isNaN(rowLastCheckedAt) && Date.parse(matchingEvidence.checked_at) < rowLastCheckedAt) {
            failures.push(`${row.id}: ${e2eId} E2E evidence is older than row last_checked_at`);
          } else {
            newestRequiredE2eCheckedAt = Math.max(newestRequiredE2eCheckedAt, Date.parse(matchingEvidence.checked_at));
          }
        }
      }
    }
    if (isPhaseExitMatrix && row.id === `${matrix.phase}-010` && allowBlocked) {
      failures.push(`${row.id}: final matrix row must be verified by running the verifier without --allow-blocked`);
    }
  }
  if (row.status === "blocked") {
    if (!row.blocker) {
      failures.push(`${row.id}: blocked row missing blocker`);
    }
    if (["P9", "P10", "P11", "P12"].includes(matrix.phase)) {
      if (typeof row.blocker !== "string" || row.blocker.trim().length < 20) {
        failures.push(`${row.id}: blocked row requires a fresh, specific blocker reason`);
      }
      if (typeof row.blocker === "string" && /^(tbd|todo|placeholder|blocked|not implemented)$/i.test(row.blocker.trim())) {
        failures.push(`${row.id}: blocked row has placeholder blocker text`);
      }
      if (!row.last_checked_at || Number.isNaN(Date.parse(row.last_checked_at))) {
        failures.push(`${row.id}: blocked row missing valid last_checked_at`);
      }
    }
  }
}

for (const requiredId of requiredIds ?? []) {
  if (!seenIds.has(requiredId)) {
    failures.push(`${requiredId}: missing required ${matrix.phase} row`);
  }
}

if (isPhaseExitMatrix && !allowBlocked && newestRequiredE2eCheckedAt !== Number.NEGATIVE_INFINITY) {
  try {
    const runMetadata = JSON.parse(readFileSync(e2eRunMetadataPath, "utf8"));
    const runMetadataStat = statSync(e2eRunMetadataPath);
    const metadataTestPaths = new Set(
      Array.isArray(runMetadata.testPaths)
        ? runMetadata.testPaths.map((testPath) => String(testPath).replaceAll("\\", "/"))
        : []
    );
    const metadataE2eIds = new Set(Array.isArray(runMetadata.e2eIds) ? runMetadata.e2eIds.map(String) : []);

    if (runMetadata.status !== "passed" || runMetadata.exitCode !== 0) {
      failures.push(`${matrix.phase}: E2E run metadata status must be passed with exitCode 0`);
    }
    if (runMetadata.profile !== "phase" || String(runMetadata.phase) !== expectedE2ePhaseNumber) {
      failures.push(`${matrix.phase}: E2E run metadata must come from phase ${expectedE2ePhaseNumber}`);
    }
    const finishedAt = Date.parse(runMetadata.finishedAt);
    if (Number.isNaN(finishedAt)) {
      failures.push(`${matrix.phase}: E2E run metadata missing valid finishedAt`);
    } else if (finishedAt + 120_000 < newestRequiredE2eCheckedAt) {
      failures.push(`${matrix.phase}: E2E run metadata finishedAt is older than recorded E2E evidence`);
    }
    if (runMetadataStat.mtimeMs + 120_000 < newestRequiredE2eCheckedAt) {
      failures.push(`${matrix.phase}: E2E run metadata is older than recorded E2E evidence`);
    }
    for (const e2eId of requiredPhaseE2eIds) {
      if (!metadataE2eIds.has(e2eId)) {
        failures.push(`${matrix.phase}: E2E run metadata missing ${e2eId}`);
      }
    }
    for (const testPath of requiredPhaseE2ePaths) {
      if (!metadataTestPaths.has(testPath)) {
        failures.push(`${matrix.phase}: E2E run metadata missing ${testPath}`);
      }
      try {
        const testPathStat = statSync(testPath);
        if (!testPathStat.isFile()) {
          failures.push(`${matrix.phase}: required E2E test path is not a file at ${testPath}`);
        }
      } catch {
        failures.push(`${matrix.phase}: required E2E test file missing at ${testPath}`);
      }
    }
  } catch {
    failures.push(`${matrix.phase}: missing readable E2E run metadata at ${e2eRunMetadataPath}`);
  }
}

if (failures.length > 0) {
  console.error(`Requirements matrix verification failed for ${matrixPath}`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Requirements matrix verified: ${matrixPath}${allowBlocked ? " (blocked rows allowed)" : ""}`);
