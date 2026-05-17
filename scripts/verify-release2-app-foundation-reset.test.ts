import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = resolve("scripts/verify-release2-app-foundation-reset.mjs");
const fixtureDir = resolve("test-results/verify-release2-app-foundation-reset");

const requiredIds = Array.from({ length: 15 }, (_, index) => `R2R-${String(index + 1).padStart(3, "0")}`);

function row(id: string) {
  return {
    id,
    requirement: `${id} route/reload/readback/permission app foundation requirement`,
    status: id === "R2R-012" ? "blocked" : "planned",
    owner: "Release 2 app foundation reset",
    owned_scope: ["apps/web app shell and docs/status reset contract"],
    required_e2e: [
      "E2E-R2R-001 Product owner smoke proves real routes, reload/readback, permissions, profile/account, settings/admin, demo seed/readback, and app readiness."
    ],
    acceptance: [
      "Real route or deep link works without anchor-only scrolling.",
      "Reload/readback proves state or documented read-only reason.",
      "Permission state is visible and backend denial is required where mutation exists.",
      id === "R2R-012" ? "Block continued Release 2 implementation until app foundation reset is done." : "Release 2 app foundation behavior is scoped to this row."
    ],
    non_scope: ["Component demo wall as product app architecture"],
    verification: ["product-owner smoke E2E and reset matrix verifier"],
    dependencies: id === "R2R-012" ? requiredIds.filter((candidate) => candidate !== "R2R-012") : [],
    risks: ["Old E2E-R2-001..010 component evidence is not app-readiness evidence."],
    done_evidence: []
  };
}

function validMatrix() {
  const rows = requiredIds.map(row);
  rows.find((entry) => entry.id === "R2R-013")!.acceptance.push(
    "Profile/account menu shows avatar, profile, role, tenant, and personal preferences."
  );
  rows.find((entry) => entry.id === "R2R-014")!.acceptance.push(
    "Settings/admin area uses shadcn/Radix tables, forms, dialogs, preview, and audit."
  );
  rows.find((entry) => entry.id === "R2R-015")!.acceptance.push(
    "Deep links, browser back-forward, reload, and route guards work for real app pages."
  );
  return {
    version: 1,
    release: "R2",
    reset: "RELEASE_2_APP_FOUNDATION_RESET",
    product_readiness: "blocked",
    product_owner_smoke_e2e: "E2E-R2R-001",
    evidence_timestamp: new Date().toISOString(),
    rows
  };
}

function writeFixture(name: string, matrix: unknown) {
  mkdirSync(fixtureDir, { recursive: true });
  const path = resolve(fixtureDir, name);
  writeFileSync(path, JSON.stringify(matrix, null, 2));
  return path;
}

function runVerifier(path: string) {
  return spawnSync(process.execPath, [scriptPath, path], { encoding: "utf8" });
}

describe("verify-release2-app-foundation-reset", () => {
  it("accepts a complete planned reset matrix", () => {
    const path = writeFixture("valid.json", validMatrix());

    const result = runVerifier(path);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Release 2 app foundation reset matrix verified");
  });

  it("rejects missing or extra R2R rows", () => {
    const matrix = validMatrix();
    matrix.rows = matrix.rows.filter((entry) => entry.id !== "R2R-015");
    matrix.rows.push(row("R2R-999"));
    const path = writeFixture("bad-ids.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("rows must be exactly R2R-001..R2R-015");
  });

  it("rejects app-flow rows without E2E and route/reload/readback/permission acceptance", () => {
    const matrix = validMatrix();
    const appRouting = matrix.rows.find((entry) => entry.id === "R2R-001")!;
    appRouting.required_e2e = [];
    appRouting.acceptance = ["A vague acceptance row"];
    const path = writeFixture("weak-app-flow.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("R2R-001: required_e2e must not be empty");
    expect(result.stderr).toContain("R2R-001: acceptance must mention route");
    expect(result.stderr).toContain("R2R-001: acceptance must mention reload");
    expect(result.stderr).toContain("R2R-001: acceptance must mention readback");
    expect(result.stderr).toContain("R2R-001: acceptance must mention permission");
  });

  it("rejects missing profile/settings/deep-link reset requirements", () => {
    const matrix = validMatrix();
    matrix.rows.find((entry) => entry.id === "R2R-013")!.acceptance = ["route reload readback permission"];
    matrix.rows.find((entry) => entry.id === "R2R-014")!.acceptance = ["route reload readback permission"];
    matrix.rows.find((entry) => entry.id === "R2R-015")!.acceptance = ["route reload readback permission"];
    const path = writeFixture("missing-specifics.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("R2R-013: must mention profile/account/preferences");
    expect(result.stderr).toContain("R2R-014: must mention settings/admin/shadcn/preview/audit");
    expect(result.stderr).toContain("R2R-015: must mention deep links/back-forward/reload/route guards");
  });

  it("rejects product readiness claims before all reset rows are done", () => {
    const matrix = validMatrix();
    matrix.product_readiness = "accepted";
    const path = writeFixture("false-product-ready.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("product readiness cannot be accepted while reset rows are not done");
  });

  it("rejects stale evidence timestamps and done rows without evidence", () => {
    const matrix = validMatrix();
    matrix.evidence_timestamp = "2026-01-01T00:00:00.000Z";
    matrix.rows[0].status = "done";
    const path = writeFixture("stale-done.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("evidence timestamp is stale");
    expect(result.stderr).toContain("R2R-001: done rows require done_evidence");
  });

  it("requires product-owner smoke E2E reference", () => {
    const matrix = validMatrix();
    matrix.product_owner_smoke_e2e = "";
    const path = writeFixture("missing-smoke.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("product-owner smoke E2E reference is missing");
  });

  it("committed matrix stays verifier-valid", () => {
    const matrix = JSON.parse(readFileSync("docs/status/release2-app-foundation-reset-matrix.json", "utf8"));
    const path = writeFixture("committed-copy.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(0);
  });
});
