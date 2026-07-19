import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Guard against duplicate migration *numbers* (the 4-digit prefix) slipping in.
 *
 * Why this is safe today, and why the guard is a baseline-exception guard
 * rather than a hard "numbers must be unique" rule:
 *
 * The runner (`packages/persistence/scripts/migrate.mjs`) does:
 *   readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort()
 * i.e. it sorts by the FULL file name (default lexicographic sort), applies
 * every file in that order, and records each applied file under its full file
 * name as the primary-key `tag`. It never parses or dedupes the numeric prefix.
 *
 * Consequences:
 *  - Two files that share a number but differ in the rest of the name (e.g.
 *    `0023_phase_7_8_assignment_allocations.sql` vs
 *    `0023_phase_d_tenant_production_calendar.sql`) are DISTINCT tags. Both are
 *    applied exactly once, in a stable order determined by the full name.
 *  - So the existing duplicates are harmless to the runner. They are a naming/
 *    hygiene wart from parallel branches landing the same number, not a bug.
 *
 * Because the existing duplicates are safe and already shipped, we freeze them
 * as an explicit baseline and only fail the build when a *new* duplicate number
 * appears (or when an extra file is added to one of the baselined numbers).
 * If a duplicate is ever resolved by renaming, prune the corresponding entry
 * from BASELINE_DUPLICATES below.
 */

const migrationsDir = new URL("../migrations/", import.meta.url);

// Frozen set of pre-existing duplicate numbers -> the exact files sharing them.
// Each list is sorted the same way the runner sorts (full-name lexicographic).
const BASELINE_DUPLICATES: Record<string, string[]> = {
  "0023": [
    "0023_phase_7_8_assignment_allocations.sql",
    "0023_phase_d_tenant_production_calendar.sql",
  ],
  "0024": [
    "0024_phase_7_8_planning_solver_runs.sql",
    "0024_phase_d_saved_views_custom_fields.sql",
  ],
  "0027": [
    "0027_planning_saved_view_name_uniqueness.sql",
    "0027_tenant_org_nodes_composite_pk.sql",
  ],
  "0037": [
    "0037_phase_12_calendar_occupancy_v2.sql",
    "0037_phase_h_documents_knowledge_layer.sql",
  ],
  "0041": [
    "0041_crm_pipeline_schema_contract.sql",
    "0041_phase_g4_call_recordings_per_track.sql",
  ],
  "0042": [
    "0042_phase_g4_recording_jobs.sql",
    "0042_phase_i_auth_password_reset.sql",
  ],
};

function listMigrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
}

function numberPrefix(fileName: string): string | null {
  const match = /^(\d{4})_/.exec(fileName);
  return match?.[1] ?? null;
}

function duplicatesByNumber(): Record<string, string[]> {
  const byNumber = new Map<string, string[]>();
  for (const fileName of listMigrationFiles()) {
    const prefix = numberPrefix(fileName);
    if (!prefix) {
      continue;
    }
    const bucket = byNumber.get(prefix) ?? [];
    bucket.push(fileName);
    byNumber.set(prefix, bucket);
  }

  const duplicates: Record<string, string[]> = {};
  for (const [prefix, files] of byNumber) {
    if (files.length > 1) {
      duplicates[prefix] = files.slice().sort();
    }
  }
  return duplicates;
}

describe("migration numbering guard", () => {
  it("every migration file uses a 4-digit numeric prefix", () => {
    const badlyNamed = listMigrationFiles().filter(
      (fileName) => numberPrefix(fileName) === null
    );
    expect(badlyNamed).toEqual([]);
  });

  it("no two migration files share an identical full name", () => {
    const files = listMigrationFiles();
    expect(new Set(files).size).toBe(files.length);
  });

  it("introduces no duplicate migration numbers beyond the frozen baseline", () => {
    const duplicates = duplicatesByNumber();

    // Any duplicate number must be a known, frozen baseline entry.
    const newDuplicateNumbers = Object.keys(duplicates).filter(
      (prefix) => !(prefix in BASELINE_DUPLICATES)
    );
    expect(newDuplicateNumbers).toEqual([]);

    // And a baselined number must not have gained an extra colliding file.
    for (const [prefix, files] of Object.entries(duplicates)) {
      expect(files).toEqual(BASELINE_DUPLICATES[prefix]);
    }
  });

  it("keeps every baselined duplicate present (prune the baseline if one is renamed away)", () => {
    const duplicates = duplicatesByNumber();
    for (const [prefix, files] of Object.entries(BASELINE_DUPLICATES)) {
      // If this fails because a duplicate was intentionally resolved, delete
      // the corresponding BASELINE_DUPLICATES entry rather than re-adding a file.
      expect(duplicates[prefix]).toEqual(files);
    }
  });
});
