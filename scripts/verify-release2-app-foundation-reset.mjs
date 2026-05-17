import { readFileSync } from "node:fs";

const matrixPath = process.argv[2] ?? "docs/status/release2-app-foundation-reset-matrix.json";
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const failures = [];

const requiredIds = Array.from({ length: 15 }, (_, index) => `R2R-${String(index + 1).padStart(3, "0")}`);
const requiredFields = [
  "id",
  "requirement",
  "status",
  "owner",
  "owned_scope",
  "required_e2e",
  "acceptance",
  "non_scope",
  "verification",
  "dependencies",
  "risks",
  "done_evidence"
];
const allowedStatuses = new Set(["planned", "blocked", "done"]);
const appFlowRows = new Set(requiredIds);

function fail(message) {
  failures.push(message);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function joined(value) {
  return Array.isArray(value) ? value.join(" ").toLowerCase() : String(value ?? "").toLowerCase();
}

function requireTextArray(row, field) {
  const value = row[field];
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => !hasText(entry))) {
    fail(`${row.id}: ${field} must be a non-empty text array`);
  }
}

function requireWords(row, field, words) {
  const text = joined(row[field]);
  for (const word of words) {
    if (!text.includes(word)) fail(`${row.id}: ${field} must mention ${word}`);
  }
}

if (matrix.version !== 1) fail("matrix.version must be 1");
if (matrix.release !== "R2") fail("matrix.release must be R2");
if (matrix.reset !== "RELEASE_2_APP_FOUNDATION_RESET") {
  fail("matrix.reset must be RELEASE_2_APP_FOUNDATION_RESET");
}
if (!hasText(matrix.product_owner_smoke_e2e) || !String(matrix.product_owner_smoke_e2e).includes("E2E-R2R-001")) {
  fail("product-owner smoke E2E reference is missing");
}

if (matrix.evidence_timestamp) {
  const timestamp = Date.parse(matrix.evidence_timestamp);
  const ageMs = Date.now() - timestamp;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (Number.isNaN(timestamp)) {
    fail("evidence timestamp is invalid");
  } else if (ageMs > sevenDaysMs || ageMs < -60 * 60 * 1000) {
    fail("evidence timestamp is stale");
  }
} else {
  fail("evidence timestamp is missing");
}

if (!Array.isArray(matrix.rows)) {
  fail("matrix.rows must be an array");
} else {
  const ids = matrix.rows.map((row) => row.id);
  const expected = requiredIds.join(",");
  if (ids.join(",") !== expected) {
    fail("rows must be exactly R2R-001..R2R-015");
  }
}

for (const row of matrix.rows ?? []) {
  const id = row?.id ?? "unknown";

  for (const field of requiredFields) {
    if (!(field in row)) fail(`${id}: missing ${field}`);
  }

  if (!requiredIds.includes(id)) continue;
  if (!hasText(row.requirement)) fail(`${id}: requirement must be non-empty`);
  if (!hasText(row.owner)) fail(`${id}: owner must be non-empty`);
  if (!allowedStatuses.has(row.status)) fail(`${id}: status must be planned, blocked, or done`);

  for (const field of ["owned_scope", "acceptance", "non_scope", "verification", "risks"]) {
    requireTextArray(row, field);
  }
  for (const field of ["dependencies", "done_evidence"]) {
    if (!Array.isArray(row[field])) fail(`${id}: ${field} must be an array`);
  }

  if (row.status === "done" && (!Array.isArray(row.done_evidence) || row.done_evidence.length === 0)) {
    fail(`${id}: done rows require done_evidence`);
  }

  if (appFlowRows.has(id)) {
    if (!Array.isArray(row.required_e2e) || row.required_e2e.length === 0) {
      fail(`${id}: required_e2e must not be empty`);
    }
    requireWords(row, "acceptance", ["route", "reload", "readback", "permission"]);
  }
}

const r2r013 = matrix.rows?.find((row) => row.id === "R2R-013");
if (r2r013) {
  const text = joined([r2r013.requirement, ...r2r013.acceptance, ...r2r013.required_e2e]);
  if (!text.includes("profile") || !text.includes("account") || !text.includes("preferences")) {
    fail("R2R-013: must mention profile/account/preferences");
  }
}

const r2r014 = matrix.rows?.find((row) => row.id === "R2R-014");
if (r2r014) {
  const text = joined([r2r014.requirement, ...r2r014.acceptance, ...r2r014.required_e2e]);
  if (!text.includes("settings") || !text.includes("admin") || !text.includes("shadcn") || !text.includes("preview") || !text.includes("audit")) {
    fail("R2R-014: must mention settings/admin/shadcn/preview/audit");
  }
}

const r2r015 = matrix.rows?.find((row) => row.id === "R2R-015");
if (r2r015) {
  const text = joined([r2r015.requirement, ...r2r015.acceptance, ...r2r015.required_e2e]);
  if (!text.includes("deep links") || !text.includes("back-forward") || !text.includes("reload") || !text.includes("route guards")) {
    fail("R2R-015: must mention deep links/back-forward/reload/route guards");
  }
}

if (matrix.product_readiness && !["blocked", "not_accepted"].includes(matrix.product_readiness)) {
  const allDone = (matrix.rows ?? []).every((row) => row.status === "done");
  if (!allDone) fail("product readiness cannot be accepted while reset rows are not done");
}

const r2r012 = matrix.rows?.find((row) => row.id === "R2R-012");
if (r2r012) {
  const text = joined([r2r012.requirement, ...r2r012.acceptance, ...r2r012.dependencies, ...r2r012.risks]);
  if (!text.includes("block") || !text.includes("release 2")) {
    fail("R2R-012: must explicitly block continued Release 2 implementation");
  }
}

if (failures.length > 0) {
  console.error(`Release 2 app foundation reset matrix verification failed for ${matrixPath}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release 2 app foundation reset matrix verified: ${matrixPath} (${matrix.rows.length} rows)`);
