import { readFileSync } from "node:fs";

const matrixPath = process.argv[2] ?? "docs/status/p3-p12-ux-screen-matrix.json";
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const failures = [];
const requiredFields = [
  "id",
  "phase",
  "name",
  "route_or_surface",
  "primary_role",
  "primary_goal",
  "primary_next_action",
  "states",
  "mutations",
  "permission_rules",
  "audit_required",
  "reload_required",
  "e2e",
  "spec_refs",
  "status"
];
const requiredPhases = new Set(["P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12"]);
const requiredStates = ["loading", "empty", "ready", "permission_denied", "error"];
const forbiddenPattern = /\b(TBD|TODO|later|nice to have)\b/i;
const seenIds = new Set();
const coveredPhases = new Set();

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

if (!Array.isArray(matrix.screens) || matrix.screens.length === 0) {
  failures.push("matrix.screens must be a non-empty array");
}

for (const screen of matrix.screens ?? []) {
  for (const field of requiredFields) {
    if (!(field in screen)) {
      failures.push(`${screen.id ?? "unknown"}: missing ${field}`);
    }
  }

  if (!hasText(screen.id)) failures.push("screen without id");
  if (seenIds.has(screen.id)) failures.push(`${screen.id}: duplicate id`);
  seenIds.add(screen.id);

  if (!requiredPhases.has(screen.phase)) failures.push(`${screen.id}: unsupported phase ${screen.phase}`);
  coveredPhases.add(screen.phase);

  for (const field of ["name", "route_or_surface", "primary_role", "primary_goal", "primary_next_action", "status"]) {
    if (!hasText(screen[field])) failures.push(`${screen.id}: ${field} must be non-empty text`);
    if (hasText(screen[field]) && forbiddenPattern.test(screen[field])) failures.push(`${screen.id}: ${field} contains forbidden placeholder text`);
  }

  for (const arrayField of ["states", "mutations", "permission_rules", "e2e", "spec_refs"]) {
    if (!Array.isArray(screen[arrayField]) || screen[arrayField].length === 0) {
      failures.push(`${screen.id}: ${arrayField} must be a non-empty array`);
      continue;
    }
    for (const value of screen[arrayField]) {
      if (!hasText(value)) failures.push(`${screen.id}: ${arrayField} contains empty value`);
      if (hasText(value) && forbiddenPattern.test(value)) failures.push(`${screen.id}: ${arrayField} contains forbidden placeholder text`);
    }
  }

  for (const state of requiredStates) {
    if (!screen.states?.includes(state)) failures.push(`${screen.id}: missing state ${state}`);
  }

  if (screen.mutations?.length > 0 && screen.permission_rules?.length === 0) {
    failures.push(`${screen.id}: mutation screens require permission rules`);
  }
  if (screen.mutations?.length > 0 && screen.audit_required !== true) {
    failures.push(`${screen.id}: mutation screens require audit_required=true`);
  }
  if (screen.reload_required !== true) {
    failures.push(`${screen.id}: reload_required must be true`);
  }
}

for (const phase of requiredPhases) {
  if (!coveredPhases.has(phase)) failures.push(`${phase}: no related screen`);
}

const gantt = matrix.screens?.find((screen) => screen.id === "UX-P5-PROJECT-GANTT");
if (!gantt) {
  failures.push("UX-P5-PROJECT-GANTT missing");
} else {
  if (gantt.implementation_policy !== "custom_kiss_pm_surface") failures.push("Gantt must be a custom KISS PM surface");
  if (gantt.ready_gantt_widget_allowed !== false) failures.push("Gantt must disallow packaged widget substitution");
  if (gantt.canonical_task_required !== true) failures.push("Gantt must require canonical tasks");
  const foundation = JSON.stringify(gantt.headless_foundation ?? []);
  if (!foundation.includes("TanStack Table")) failures.push("Gantt must mention TanStack Table/headless grid foundation");
  if (!foundation.includes("shadcn")) failures.push("Gantt must mention shadcn/Radix control primitives");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`UX screen matrix OK: ${matrix.screens.length} screens`);
