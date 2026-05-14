import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const allowBlocked = args.includes("--allow-blocked");
const matrixPath = args.find((arg) => !arg.startsWith("--")) ?? "docs/status/phase1-requirements-matrix.json";

const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const failures = [];
const requiredIdsByPhase = {
  P1: Array.from({ length: 10 }, (_, index) => `P1-${String(index + 1).padStart(3, "0")}`),
  "P2-contract": ["P2C-001", "P2C-002", "P2C-003"],
  P2: Array.from({ length: 10 }, (_, index) => `P2-${String(index + 1).padStart(3, "0")}`)
};
const requiredIds = requiredIdsByPhase[matrix.phase];
const seenIds = new Set();

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
  if (row.status !== "verified" && row.status !== "blocked") {
    failures.push(`${row.id}: status must be verified or blocked, got ${row.status}`);
  }
  if (row.status === "blocked" && !allowBlocked) {
    failures.push(`${row.id}: blocked row requires --allow-blocked and cannot pass phase-exit verification`);
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
