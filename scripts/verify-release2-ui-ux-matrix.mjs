import { existsSync, readFileSync } from "node:fs";

const matrixPath = process.argv[2] ?? "docs/status/release2-ui-ux-screen-matrix.json";
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const failures = [];

const requiredStages = new Set(["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
const requiredCrossCuttingScreens = new Set([
  "R2-X-RESOURCE-LOAD-CONTROL",
  "R2-X-KPI-DEVIATION-CONTROL",
  "R2-X-PORTFOLIO-CONTROL",
  "R2-X-ACTION-AUDIT-CONTROL",
  "R2-X-TENANT-CONFIGURATION-CONTROL",
  "R2-X-INTEGRATION-IMPORT-CONTROL"
]);
const requiredStates = [
  "loading",
  "empty",
  "ready",
  "permission_denied",
  "error",
  "stale_preview",
  "mutation_pending",
  "success"
];
const requiredLoop = ["signal", "action", "preview", "result"];
const requiredScreenFields = [
  "id",
  "bp_stage",
  "name",
  "route_or_surface",
  "surface_kind",
  "report_like_surface",
  "primary_role",
  "secondary_roles",
  "managed_object",
  "primary_goal",
  "primary_next_action",
  "management_loop",
  "states",
  "permissions",
  "audit_required",
  "readback_required",
  "reload_required",
  "cleanup_required",
  "spec_refs",
  "flow_refs",
  "modal_panel_refs",
  "action_refs",
  "planned_e2e",
  "implementation_status"
];
const forbiddenPlaceholder = /\b(TBD|TODO|later|nice to have|placeholder|fill me|unknown)\b/i;
const allowedImplementationStatuses = new Set(["specified_not_implemented", "implemented", "verified"]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(id, message) {
  failures.push(`${id}: ${message}`);
}

function verifyText(id, field, value) {
  if (!hasText(value)) {
    fail(id, `${field} must be non-empty text`);
    return;
  }
  if (forbiddenPlaceholder.test(value)) {
    fail(id, `${field} contains placeholder text`);
  }
}

function verifyTextArray(id, field, value) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(id, `${field} must be a non-empty array`);
    return;
  }
  for (const entry of value) {
    verifyText(id, field, entry);
  }
}

function refPath(ref) {
  return String(ref).split("#")[0].replaceAll("\\", "/");
}

if (matrix.version !== 1) failures.push("matrix.version must be 1");
if (matrix.source_bp !== "docs/02_UNIVERSAL_PROJECT_BP.md") {
  failures.push("matrix.source_bp must be docs/02_UNIVERSAL_PROJECT_BP.md");
}
if (matrix.baseline_spec !== "docs/product/RELEASE_2_UI_UX_SPEC.md") {
  failures.push("matrix.baseline_spec must be docs/product/RELEASE_2_UI_UX_SPEC.md");
}
if (!Array.isArray(matrix.required_loop) || !requiredLoop.every((item) => matrix.required_loop.includes(item))) {
  failures.push("matrix.required_loop must include signal, action, preview, and result");
}
if (!Array.isArray(matrix.screens) || matrix.screens.length === 0) {
  failures.push("matrix.screens must be a non-empty array");
}

const ids = new Set();
const coveredStages = new Set();
const coveredCrossCutting = new Set();

for (const screen of matrix.screens ?? []) {
  const id = screen?.id ?? "unknown";

  for (const field of requiredScreenFields) {
    if (!(field in screen)) fail(id, `missing ${field}`);
  }

  verifyText(id, "id", screen.id);
  if (ids.has(screen.id)) fail(id, "duplicate id");
  ids.add(screen.id);

  if (requiredStages.has(screen.bp_stage)) coveredStages.add(screen.bp_stage);
  else if (screen.bp_stage === "cross_cutting") coveredCrossCutting.add(screen.id);
  else fail(id, `bp_stage must be one of S0-S8 or cross_cutting, got ${screen.bp_stage}`);

  for (const field of [
    "name",
    "route_or_surface",
    "surface_kind",
    "primary_role",
    "managed_object",
    "primary_goal",
    "primary_next_action",
    "implementation_status"
  ]) {
    verifyText(id, field, screen[field]);
  }

  if (!allowedImplementationStatuses.has(screen.implementation_status)) {
    fail(id, `implementation_status must be one of ${Array.from(allowedImplementationStatuses).join(", ")}`);
  }

  for (const field of [
    "secondary_roles",
    "states",
    "permissions",
    "spec_refs",
    "flow_refs",
    "modal_panel_refs",
    "action_refs",
    "planned_e2e"
  ]) {
    verifyTextArray(id, field, screen[field]);
  }

  for (const state of requiredStates) {
    if (!screen.states?.includes(state)) fail(id, `missing required state ${state}`);
  }

  for (const booleanField of ["audit_required", "readback_required", "reload_required", "cleanup_required"]) {
    if (screen[booleanField] !== true) fail(id, `${booleanField} must be true`);
  }

  if (typeof screen.report_like_surface !== "boolean") {
    fail(id, "report_like_surface must be boolean");
  }

  for (const loopField of requiredLoop) {
    verifyText(id, `management_loop.${loopField}`, screen.management_loop?.[loopField]);
  }

  if (screen.report_like_surface === true && screen.surface_kind !== "management_control_surface" && screen.surface_kind !== "configuration_control_surface") {
    fail(id, "report-like screens must be management or configuration control surfaces");
  }

  for (const refField of ["spec_refs", "flow_refs", "modal_panel_refs", "action_refs"]) {
    for (const ref of screen[refField] ?? []) {
      const path = refPath(ref);
      if (!existsSync(path)) fail(id, `${refField} path does not exist: ${path}`);
    }
  }
}

for (const stage of requiredStages) {
  if (!coveredStages.has(stage)) failures.push(`${stage}: no Release 2 screen covers this BP stage`);
}

for (const screenId of requiredCrossCuttingScreens) {
  if (!coveredCrossCutting.has(screenId)) failures.push(`${screenId}: missing required cross-cutting control surface`);
}

const gantt = matrix.screens?.find((screen) => screen.id === "R2-S2-PROJECT-GANTT-PLANNER");
if (!gantt) {
  failures.push("R2-S2-PROJECT-GANTT-PLANNER: missing Project Gantt planner screen");
} else {
  const serialized = JSON.stringify(gantt);
  if (!/MS Project-like|MS Project/i.test(serialized)) {
    failures.push("R2-S2-PROJECT-GANTT-PLANNER: must explicitly preserve MS Project-like planner ergonomics");
  }
  if (!/canonical/i.test(serialized)) {
    failures.push("R2-S2-PROJECT-GANTT-PLANNER: must require canonical task model");
  }
}

if (failures.length > 0) {
  console.error(`Release 2 UI/UX matrix verification failed for ${matrixPath}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release 2 UI/UX matrix verified: ${matrixPath} (${matrix.screens.length} screens)`);
