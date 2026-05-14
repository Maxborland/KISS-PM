import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const scriptPath = resolve("scripts/verify-requirements-matrix.mjs");
const fixtureDir = resolve("test-results/verify-requirements-matrix");
const p2RequiredE2e = {
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
};
const p3RequiredE2e = {
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
};
const e2eTestPaths = {
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

function writeMatrixFixture(fileName: string, firstRow: Record<string, unknown>) {
  mkdirSync(fixtureDir, { recursive: true });
  const matrixPath = resolve(fixtureDir, fileName);
  const baseRow = {
    requirement: "Contract row",
    status: "verified",
    owner: "test",
    owned_scope: ["docs/status"],
    evidence: ["manual review"],
    tests: ["manual review"],
    cleanup: "No runtime cleanup",
    blocker: null,
    last_checked_at: "2026-05-14T10:28:24+07:00"
  };

  writeFileSync(
    matrixPath,
    JSON.stringify(
      {
        phase: "P2-contract",
        rows: [
          { ...baseRow, id: "P2C-001", ...firstRow },
          { ...baseRow, id: "P2C-002" },
          { ...baseRow, id: "P2C-003" }
        ]
      },
      null,
      2
    )
  );

  return matrixPath;
}

function writeP2MatrixFixture(fileName: string, overrideById: Record<string, Record<string, unknown>>) {
  mkdirSync(fixtureDir, { recursive: true });
  const matrixPath = resolve(fixtureDir, fileName);
  const rows = Object.entries(p2RequiredE2e).map(([id, requiredE2e]) => ({
    id,
    requirement: `${id} row`,
    status: "blocked",
    owner: "test",
    owned_scope: ["docs/status"],
    required_e2e: requiredE2e,
    evidence: [],
    tests: ["npm test"],
    cleanup: "No runtime cleanup",
    blocker: "Not implemented in fixture",
    last_checked_at: "2026-05-14T10:28:24+07:00",
    ...overrideById[id]
  }));

  writeFileSync(
    matrixPath,
    JSON.stringify(
      {
        phase: "P2",
        rows
      },
      null,
      2
    )
  );

  return matrixPath;
}

function writePhaseMatrixFixture(
  phase: "P2" | "P3",
  fileName: string,
  requiredE2eById: Record<string, string[]>,
  overrideById: Record<string, Record<string, unknown>>
) {
  mkdirSync(fixtureDir, { recursive: true });
  const matrixPath = resolve(fixtureDir, fileName);
  const rows = Object.entries(requiredE2eById).map(([id, requiredE2e]) => ({
    id,
    requirement: `${id} row`,
    status: "blocked",
    owner: "test",
    owned_scope: ["docs/status"],
    required_e2e: requiredE2e,
    evidence: [],
    tests: ["npm test"],
    cleanup: "No runtime cleanup",
    blocker: "Not implemented in fixture",
    last_checked_at: "2026-05-14T17:57:59+07:00",
    ...overrideById[id]
  }));

  writeFileSync(
    matrixPath,
    JSON.stringify(
      {
        phase,
        rows
      },
      null,
      2
    )
  );

  return matrixPath;
}

describe("verify-requirements-matrix", () => {
  it("rejects verified rows missing required E2E evidence", () => {
    const matrixPath = writeMatrixFixture("missing-e2e.json", {
      required_e2e: ["E2E-013"]
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2C-001: verified row missing structured E2E evidence for E2E-013");
  });

  it("rejects planned prose that mentions an E2E ID without structured E2E evidence", () => {
    const matrixPath = writeMatrixFixture("planned-prose-e2e.json", {
      required_e2e: ["E2E-010"],
      evidence: ["E2E-010 must be implemented before phase exit"],
      tests: ["manual review", "npm run test:e2e:phase -- --phase=2 exit 0"]
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2C-001: verified row missing structured E2E evidence for E2E-010");
  });

  it("rejects P2 rows whose required_e2e field is missing", () => {
    const matrixPath = writeP2MatrixFixture("missing-required-e2e-field.json", {
      "P2-007": {
        status: "verified",
        required_e2e: undefined,
        evidence: ["API endpoints verified"],
        tests: ["npm run test:integration exit 0"],
        blocker: null
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2-007: required_e2e must exactly match phase contract");
  });

  it("rejects blocked P2 rows at phase exit without allow-blocked", () => {
    const matrixPath = writeP2MatrixFixture("blocked-phase-exit.json", {});

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2-001: blocked row requires --allow-blocked");
  });

  it("rejects P2 structured E2E evidence that points to Phase 1", () => {
    const matrixPath = writeP2MatrixFixture("phase1-e2e-evidence.json", {
      "P2-001": {
        status: "verified",
        evidence: ["Tenant isolation verified"],
        tests: ["npm run test:e2e:phase -- --phase=1 exit 0"],
        e2e_evidence: [
          {
            id: "E2E-010",
            command: "npm run test:e2e:phase -- --phase=1",
            test_path: "e2e/tests/phase1/app-boot.spec.ts",
            exit_code: 0,
            checked_at: "2026-05-14T10:28:24+07:00"
          }
        ],
        blocker: null
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2-001: E2E-010 E2E evidence command must target phase 2");
    expect(result.stderr).toContain(
      "P2-001: E2E-010 E2E evidence test_path must match e2e/tests/phase2/tenant-isolation.spec.ts"
    );
  });

  it("reports missing tests on verified rows instead of crashing", () => {
    const matrixPath = writeMatrixFixture("missing-tests.json", {
      tests: undefined
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2C-001: verified row missing tests");
    expect(result.stderr).not.toContain("TypeError");
  });

  it("accepts verified rows with required E2E evidence", () => {
    const matrixPath = writeMatrixFixture("present-e2e.json", {
      required_e2e: ["E2E-013"],
      evidence: ["E2E-013 tenant label trace verified"],
      tests: ["npm run test:e2e:phase -- --phase=2 exit 0"],
      e2e_evidence: [
        {
          id: "E2E-013",
          command: "npm run test:e2e:phase -- --phase=2",
          test_path: "e2e/tests/phase2/tenant-labels.spec.ts",
          exit_code: 0,
          checked_at: "2026-05-14T10:28:24+07:00"
        }
      ]
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("accepts a complete P2 matrix only when every row is verified with required structured E2E evidence", () => {
    const checkedAt = "2026-05-14T16:10:00+07:00";
    const matrixPath = writeP2MatrixFixture(
      "complete-p2-phase-exit.json",
      Object.fromEntries(
        Object.entries(p2RequiredE2e).map(([id, requiredE2e]) => [
          id,
          {
            status: "verified",
            evidence: [`${id} verified`],
            tests: ["npm run test:e2e:phase -- --phase=2 exit 0"],
            blocker: "None",
          e2e_evidence: requiredE2e.map((e2eId) => ({
            id: e2eId,
            command: "npm run test:e2e:phase -- --phase=2",
            test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
            exit_code: 0,
            checked_at: checkedAt
          }))
          }
        ])
      )
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("accepts the initial blocked P3 matrix only with allow-blocked", () => {
    const matrixPath = writePhaseMatrixFixture("P3", "blocked-p3-contract.json", p3RequiredE2e, {});

    const blockedResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("P3-001: blocked row requires --allow-blocked");
    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P3 rows whose required_e2e field does not match the phase contract", () => {
    const matrixPath = writePhaseMatrixFixture("P3", "wrong-p3-required-e2e.json", p3RequiredE2e, {
      "P3-007": {
        required_e2e: ["E2E-020"]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P3-007: required_e2e must exactly match phase contract");
  });

  it("rejects P3 structured E2E evidence that points to a non-ledger phase3 file", () => {
    const matrixPath = writePhaseMatrixFixture("P3", "wrong-p3-test-path.json", p3RequiredE2e, {
      "P3-001": {
        status: "verified",
        evidence: ["P3-001 verified"],
        tests: ["npm run test:e2e:phase -- --phase=3 exit 0"],
        blocker: null,
        e2e_evidence: [
          {
            id: "E2E-020",
            command: "npm run test:e2e:phase -- --phase=3",
            test_path: "e2e/tests/phase3/e2e-020.spec.ts",
            exit_code: 0,
            checked_at: "2026-05-14T17:57:59+07:00"
          }
        ]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "P3-001: E2E-020 E2E evidence test_path must match e2e/tests/phase3/opportunity-create.spec.ts"
    );
  });

  it("accepts a complete P3 matrix only when every row is verified with phase 3 structured E2E evidence", () => {
    const checkedAt = "2026-05-14T17:57:59+07:00";
    const matrixPath = writePhaseMatrixFixture(
      "P3",
      "complete-p3-phase-exit.json",
      p3RequiredE2e,
      Object.fromEntries(
        Object.entries(p3RequiredE2e).map(([id, requiredE2e]) => [
          id,
          {
            status: "verified",
            evidence: [`${id} verified`],
            tests: ["npm run test:e2e:phase -- --phase=3 exit 0"],
            blocker: "None",
            e2e_evidence: requiredE2e.map((e2eId) => ({
              id: e2eId,
              command: "npm run test:e2e:phase -- --phase=3",
              test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
              exit_code: 0,
              checked_at: checkedAt
            }))
          }
        ])
      )
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });
});
