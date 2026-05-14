import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const allowBlocked = args.includes("--allow-blocked");
const matrixPath = args.find((arg) => !arg.startsWith("--")) ?? "docs/status/phase1-requirements-matrix.json";

const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const failures = [];
const requiredIdsByPhase = {
  P1: Array.from({ length: 10 }, (_, index) => `P1-${String(index + 1).padStart(3, "0")}`),
  "P2-contract": ["P2C-001", "P2C-002", "P2C-003"],
  P2: Array.from({ length: 10 }, (_, index) => `P2-${String(index + 1).padStart(3, "0")}`),
  "P3-contract": ["P3C-001", "P3C-002", "P3C-003"],
  P3: Array.from({ length: 10 }, (_, index) => `P3-${String(index + 1).padStart(3, "0")}`)
};
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
  "E2E-024": "e2e/tests/phase3/project-draft-canonical.spec.ts"
};
const requiredIds = requiredIdsByPhase[matrix.phase];
const requiredE2eByRow = requiredE2eByPhaseRow[matrix.phase] ?? {};
const seenIds = new Set();
const expectedE2ePhaseNumber = matrix.phase?.match(/^P(\d+)$/)?.[1];

function sameStringSet(actual, expected) {
  if (!Array.isArray(actual)) return false;
  if (actual.length !== expected.length) return false;
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  return expectedSorted.every((value, index) => actualSorted[index] === value);
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

    if (!Array.isArray(row.evidence) || row.evidence.length === 0) {
      failures.push(`${row.id}: verified row missing evidence`);
    }
    if (!Array.isArray(row.tests) || row.tests.length === 0) {
      failures.push(`${row.id}: verified row missing tests`);
    }
    if (!row.last_checked_at) {
      failures.push(`${row.id}: verified row missing last_checked_at`);
    } else if (Number.isNaN(Date.parse(row.last_checked_at))) {
      failures.push(`${row.id}: last_checked_at is not a valid timestamp`);
    }
    if (!tests.some((test) => /exit 0|manual review/i.test(test))) {
      failures.push(`${row.id}: verified row tests must include exit 0 or manual review evidence`);
    }
    const requiredE2e = expectedRequiredE2e ?? (Array.isArray(row.required_e2e) ? row.required_e2e : []);
    if (requiredE2e.length > 0) {
      const e2eEvidence = Array.isArray(row.e2e_evidence) ? row.e2e_evidence : [];
      for (const e2eId of requiredE2e) {
        const matchingEvidence = e2eEvidence.find((entry) => entry?.id === e2eId);
        if (!matchingEvidence) {
          failures.push(`${row.id}: verified row missing structured E2E evidence for ${e2eId}`);
          continue;
        }
        if (matchingEvidence.exit_code !== 0) {
          failures.push(`${row.id}: ${e2eId} E2E evidence must have exit_code 0`);
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
        }
      }
    }
  }
  if (row.status === "blocked" && !row.blocker) {
    failures.push(`${row.id}: blocked row missing blocker`);
  }
}

for (const requiredId of requiredIds ?? []) {
  if (!seenIds.has(requiredId)) {
    failures.push(`${requiredId}: missing required ${matrix.phase} row`);
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
