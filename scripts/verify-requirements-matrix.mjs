import { readFileSync } from "node:fs";

const matrixPath = process.argv[2] ?? "docs/status/phase1-requirements-matrix.json";

const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const failures = [];
const requiredIds = Array.from({ length: 10 }, (_, index) => `P1-${String(index + 1).padStart(3, "0")}`);
const seenIds = new Set();

if (!Array.isArray(matrix.rows) || matrix.rows.length === 0) {
  failures.push("matrix.rows must be a non-empty array");
}

for (const row of matrix.rows ?? []) {
  if (!row.id) failures.push("row without id");
  if (seenIds.has(row.id)) {
    failures.push(`${row.id}: duplicate row id`);
  }
  seenIds.add(row.id);
  if (!requiredIds.includes(row.id)) {
    failures.push(`${row.id}: unexpected row id for Phase 1 matrix`);
  }
  if (row.status !== "verified" && row.status !== "blocked") {
    failures.push(`${row.id}: status must be verified or blocked, got ${row.status}`);
  }
  if (row.status === "verified") {
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
    if (!row.tests.some((test) => /exit 0|manual review/i.test(test))) {
      failures.push(`${row.id}: verified row tests must include exit 0 or manual review evidence`);
    }
  }
  if (row.status === "blocked" && !row.blocker) {
    failures.push(`${row.id}: blocked row missing blocker`);
  }
}

for (const requiredId of requiredIds) {
  if (!seenIds.has(requiredId)) {
    failures.push(`${requiredId}: missing required Phase 1 row`);
  }
}

if (failures.length > 0) {
  console.error(`Requirements matrix verification failed for ${matrixPath}`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Requirements matrix verified: ${matrixPath}`);
