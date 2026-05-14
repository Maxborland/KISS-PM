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
const p4RequiredE2e = {
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
  "E2E-024": "e2e/tests/phase3/project-draft-canonical.spec.ts",
  "E2E-030": "e2e/tests/phase4/project-from-template.spec.ts",
  "E2E-031": "e2e/tests/phase4/stage-transition.spec.ts",
  "E2E-032": "e2e/tests/phase4/stage-gate-block.spec.ts",
  "E2E-033": "e2e/tests/phase4/my-tasks-relations.spec.ts",
  "E2E-034": "e2e/tests/phase4/kanban-canonical-task.spec.ts"
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

function writeE2eRunMetadata(
  fileName: string,
  options: {
    status?: string;
    exitCode?: number;
    profile?: string;
    phase?: string | null;
    testPaths?: string[];
    e2eIds?: string[];
    startedAt?: string;
    finishedAt?: string;
  } = {}
) {
  mkdirSync(fixtureDir, { recursive: true });
  const artifactPath = resolve(fixtureDir, fileName);
  writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        profile: options.profile ?? "phase",
        phase: options.phase ?? "3",
        status: options.status ?? "passed",
        exitCode: options.exitCode ?? 0,
        command: [process.execPath, "node_modules/@playwright/test/cli.js", "test", "e2e/tests/phase3"],
        startedAt: options.startedAt ?? "2026-05-14T11:00:00.000Z",
        finishedAt: options.finishedAt ?? "2026-05-14T11:01:00.000Z",
        testPaths: options.testPaths ?? Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase3/")),
        e2eIds: options.e2eIds ?? Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-02"))
      },
      null,
      2
    )
  );
  return artifactPath;
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
  phase: "P2" | "P3" | "P4",
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

function completeP3Overrides(checkedAt: string) {
  return Object.fromEntries(
    Object.entries(p3RequiredE2e).map(([id, requiredE2e]) => [
      id,
      {
        status: "verified",
        evidence: [`${id} verified`],
        tests: ["npm run test:e2e:phase -- --phase=3 exit 0"],
        blocker: null,
        e2e_evidence: requiredE2e.map((e2eId) => ({
          id: e2eId,
          command: "npm run test:e2e:phase -- --phase=3",
          test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
          exit_code: 0,
          status: "passed",
          checked_at: checkedAt
        }))
      }
    ])
  );
}

function completeP4Overrides(checkedAt: string) {
  return Object.fromEntries(
    Object.entries(p4RequiredE2e).map(([id, requiredE2e]) => [
      id,
      {
        status: "verified",
        evidence: [`${id} verified`],
        tests: ["npm run test:e2e:phase -- --phase=4 exit 0"],
        blocker: null,
        e2e_evidence: requiredE2e.map((e2eId) => ({
          id: e2eId,
          command: "npm run test:e2e:phase -- --phase=4",
          test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
          exit_code: 0,
          status: "passed",
          checked_at: checkedAt
        }))
      }
    ])
  );
}

function writeRequiredE2eSpecFiles(projectRoot: string, e2eIds: string[]) {
  for (const e2eId of e2eIds) {
    const relativePath = e2eTestPaths[e2eId as keyof typeof e2eTestPaths];
    const filePath = resolve(projectRoot, relativePath);
    mkdirSync(resolve(filePath, ".."), { recursive: true });
    writeFileSync(filePath, `// ${e2eId} fixture spec\n`);
  }
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
            status: "passed",
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

  it("rejects verified rows that retain blocker text", () => {
    const matrixPath = writeMatrixFixture("verified-with-blocker.json", {
      blocker: "E2E evidence is still missing"
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2C-001: verified row must not retain blocker text");
  });

  it("rejects verified rows that retain malformed blocker values", () => {
    const matrixPath = writeMatrixFixture("verified-with-object-blocker.json", {
      blocker: { reason: "still blocked" }
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2C-001: verified row must not retain blocker text");
  });

  it("rejects structured E2E evidence without passed status", () => {
    const matrixPath = writeMatrixFixture("missing-e2e-status.json", {
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

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2C-001: E2E-013 E2E evidence status must be passed");
  });

  it("rejects structured E2E evidence older than the row last_checked_at", () => {
    const matrixPath = writeMatrixFixture("stale-e2e-evidence.json", {
      required_e2e: ["E2E-013"],
      evidence: ["E2E-013 tenant label trace verified"],
      tests: ["npm run test:e2e:phase -- --phase=2 exit 0"],
      last_checked_at: "2026-05-14T11:00:00+07:00",
      e2e_evidence: [
        {
          id: "E2E-013",
          command: "npm run test:e2e:phase -- --phase=2",
          test_path: "e2e/tests/phase2/tenant-labels.spec.ts",
          exit_code: 0,
          status: "passed",
          checked_at: "2026-05-14T10:28:24+07:00"
        }
      ]
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2C-001: E2E-013 E2E evidence is older than row last_checked_at");
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
          status: "passed",
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
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p2-run-metadata.json", {
      phase: "2",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase2/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-01"))
    });
    const matrixPath = writeP2MatrixFixture(
      "complete-p2-phase-exit.json",
      Object.fromEntries(
        Object.entries(p2RequiredE2e).map(([id, requiredE2e]) => [
          id,
          {
            status: "verified",
            evidence: [`${id} verified`],
            tests: ["npm run test:e2e:phase -- --phase=2 exit 0"],
            blocker: null,
          e2e_evidence: requiredE2e.map((e2eId) => ({
            id: e2eId,
            command: "npm run test:e2e:phase -- --phase=2",
            test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
            exit_code: 0,
            status: "passed",
            checked_at: checkedAt
          }))
          }
        ])
      )
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
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
            status: "passed",
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
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p3-run-metadata.json");
    const matrixPath = writePhaseMatrixFixture(
      "P3",
      "complete-p3-phase-exit.json",
      p3RequiredE2e,
      completeP3Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("rejects phase-exit matrices when structured E2E claims lack a runtime Playwright artifact", () => {
    const checkedAt = new Date().toISOString();
    const matrixPath = writePhaseMatrixFixture(
      "P3",
      "complete-p3-without-runtime-artifact.json",
      p3RequiredE2e,
      completeP3Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: resolve(fixtureDir, "missing", "last-run.json") },
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P3: missing readable E2E run metadata");
  });

  it("rejects phase-exit matrices when runtime metadata comes from the wrong phase", () => {
    const checkedAt = "2026-05-14T17:57:59+07:00";
    const e2eRunMetadataPath = writeE2eRunMetadata("wrong-phase-p3-run-metadata.json", {
      phase: "1",
      testPaths: ["e2e/tests/phase1/app-boot.spec.ts"],
      e2eIds: ["E2E-001"]
    });
    const matrixPath = writePhaseMatrixFixture(
      "P3",
      "complete-p3-wrong-phase-runtime-artifact.json",
      p3RequiredE2e,
      completeP3Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P3: E2E run metadata must come from phase 3");
    expect(result.stderr).toContain("P3: E2E run metadata missing E2E-020");
    expect(result.stderr).toContain("P3: E2E run metadata missing e2e/tests/phase3/opportunity-create.spec.ts");
  });

  it("rejects phase-exit matrices when runtime metadata finishedAt predates recorded E2E evidence", () => {
    const checkedAt = "2026-05-14T17:57:59+07:00";
    const e2eRunMetadataPath = writeE2eRunMetadata("stale-finished-at-p3-run-metadata.json", {
      finishedAt: "2026-05-14T10:01:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P3",
      "complete-p3-stale-finished-at-runtime-artifact.json",
      p3RequiredE2e,
      completeP3Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P3: E2E run metadata finishedAt is older than recorded E2E evidence");
  });

  it("rejects P3-010 phase-exit verification when the current verifier run still allows blocked rows", () => {
    const checkedAt = "2026-05-14T17:57:59+07:00";
    const e2eRunMetadataPath = writeE2eRunMetadata("allow-blocked-p3-run-metadata.json");
    const matrixPath = writePhaseMatrixFixture(
      "P3",
      "complete-p3-allow-blocked-final-gate.json",
      p3RequiredE2e,
      completeP3Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "P3-010: final matrix row must be verified by running the verifier without --allow-blocked"
    );
  });

  it("accepts the initial blocked P4 matrix only with allow-blocked", () => {
    const matrixPath = writePhaseMatrixFixture("P4", "blocked-p4-contract.json", p4RequiredE2e, {});

    const blockedResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("P4-001: blocked row requires --allow-blocked");
    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P4 rows whose required_e2e field does not match the phase contract", () => {
    const matrixPath = writePhaseMatrixFixture("P4", "wrong-p4-required-e2e.json", p4RequiredE2e, {
      "P4-008": {
        required_e2e: ["E2E-030"]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P4-008: required_e2e must exactly match phase contract");
  });

  it("accepts partially implemented P4 rows without E2E evidence only in allow-blocked tracking mode", () => {
    const matrixPath = writePhaseMatrixFixture("P4", "partial-p4-without-e2e.json", p4RequiredE2e, {
      "P4-001": {
        status: "verified",
        evidence: ["P4-001 domain templates verified by unit tests"],
        tests: ["npm test -- packages/project-core/src/processTemplate.test.ts exit 0"],
        cleanup: "No runtime cleanup",
        blocker: null
      }
    });

    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const phaseExitResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
    expect(phaseExitResult.status).toBe(1);
    expect(phaseExitResult.stderr).toContain("P4-001: verified row missing structured E2E evidence for E2E-030");
  });

  it("still requires structured E2E evidence for completed earlier phase rows in allow-blocked mode", () => {
    const matrixPath = writePhaseMatrixFixture("P3", "partial-p3-without-e2e.json", p3RequiredE2e, {
      "P3-001": {
        status: "verified",
        evidence: ["P3-001 should not defer E2E after Phase 3 completion"],
        tests: ["npm run test:e2e:phase -- --phase=3 exit 0"],
        cleanup: "No runtime cleanup",
        blocker: null
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P3-001: verified row missing structured E2E evidence for E2E-020");
  });

  it("rejects malformed supplied E2E evidence in allow-blocked tracking mode", () => {
    const matrixPath = writePhaseMatrixFixture("P4", "partial-p4-malformed-e2e.json", p4RequiredE2e, {
      "P4-001": {
        status: "verified",
        evidence: ["P4-001 domain templates verified by unit tests"],
        tests: ["npm test -- packages/project-core/src/processTemplate.test.ts exit 0"],
        cleanup: "No runtime cleanup",
        blocker: null,
        e2e_evidence: "bad"
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P4-001: e2e_evidence must be an array when supplied");
  });

  it("accepts a complete P4 matrix only when every row is verified with phase 4 structured E2E evidence", () => {
    const checkedAt = "2026-05-15T02:13:52+07:00";
    const projectRoot = resolve(fixtureDir, "complete-p4-project-root");
    writeRequiredE2eSpecFiles(projectRoot, Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-03")));
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p4-run-metadata.json", {
      phase: "4",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase4/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-03")),
      startedAt: "2026-05-14T19:10:00.000Z",
      finishedAt: "2026-05-14T19:15:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P4",
      "complete-p4-phase-exit.json",
      p4RequiredE2e,
      completeP4Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: projectRoot,
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P4 phase-exit matrices when runtime metadata comes from the wrong phase", () => {
    const checkedAt = "2026-05-15T02:13:52+07:00";
    const e2eRunMetadataPath = writeE2eRunMetadata("wrong-phase-p4-run-metadata.json", {
      phase: "3",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase3/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-02"))
    });
    const matrixPath = writePhaseMatrixFixture(
      "P4",
      "complete-p4-wrong-phase-runtime-artifact.json",
      p4RequiredE2e,
      completeP4Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P4: E2E run metadata must come from phase 4");
    expect(result.stderr).toContain("P4: E2E run metadata missing E2E-030");
    expect(result.stderr).toContain("P4: E2E run metadata missing e2e/tests/phase4/project-from-template.spec.ts");
  });

  it("rejects phase-exit matrices when a required E2E spec file is missing", () => {
    const checkedAt = "2026-05-15T02:13:52+07:00";
    const e2eRunMetadataPath = writeE2eRunMetadata("missing-spec-p4-run-metadata.json", {
      phase: "4",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase4/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-03")),
      startedAt: "2026-05-14T19:10:00.000Z",
      finishedAt: "2026-05-14T19:15:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P4",
      "complete-p4-missing-spec-file.json",
      p4RequiredE2e,
      completeP4Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "P4: required E2E test file missing at e2e/tests/phase4/project-from-template.spec.ts"
    );
  });

  it("rejects P4-010 phase-exit verification when the current verifier run still allows blocked rows", () => {
    const checkedAt = "2026-05-15T02:13:52+07:00";
    const projectRoot = resolve(fixtureDir, "allow-blocked-p4-project-root");
    writeRequiredE2eSpecFiles(projectRoot, Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-03")));
    const e2eRunMetadataPath = writeE2eRunMetadata("allow-blocked-p4-run-metadata.json", {
      phase: "4",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase4/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-03")),
      startedAt: "2026-05-14T19:10:00.000Z",
      finishedAt: "2026-05-14T19:15:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P4",
      "complete-p4-allow-blocked-final-gate.json",
      p4RequiredE2e,
      completeP4Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: projectRoot,
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "P4-010: final matrix row must be verified by running the verifier without --allow-blocked"
    );
  });

  it("rejects verified P4-010 in allow-blocked mode even when E2E evidence is deferred", () => {
    const matrixPath = writePhaseMatrixFixture("P4", "verified-p4-final-row-without-e2e.json", p4RequiredE2e, {
      "P4-010": {
        status: "verified",
        evidence: ["P4-010 final row cannot use tracking-mode verification"],
        tests: ["npm run verify:matrix -- --allow-blocked docs/status/phase4-requirements-matrix.json exit 0"],
        cleanup: "No runtime cleanup",
        blocker: null
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "P4-010: final matrix row must be verified by running the verifier without --allow-blocked"
    );
  });
});
