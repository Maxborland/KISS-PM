import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const p5RequiredE2e = {
  "P5-001": ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"],
  "P5-002": ["E2E-040", "E2E-041"],
  "P5-003": ["E2E-042"],
  "P5-004": ["E2E-043"],
  "P5-005": ["E2E-044"],
  "P5-006": ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"],
  "P5-007": ["E2E-040"],
  "P5-008": ["E2E-041", "E2E-042", "E2E-043", "E2E-044"],
  "P5-009": ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"],
  "P5-010": ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"]
};
const p6RequiredE2e = {
  "P6-001": ["E2E-050", "E2E-051"],
  "P6-002": ["E2E-050", "E2E-051"],
  "P6-003": ["E2E-050"],
  "P6-004": ["E2E-050", "E2E-051"],
  "P6-005": ["E2E-051"],
  "P6-006": ["E2E-050", "E2E-051", "E2E-052", "E2E-053", "E2E-054", "E2E-055"],
  "P6-007": ["E2E-050", "E2E-051", "E2E-052"],
  "P6-008": ["E2E-052", "E2E-053", "E2E-054", "E2E-055"],
  "P6-009": ["E2E-050", "E2E-051", "E2E-052", "E2E-053", "E2E-054", "E2E-055"],
  "P6-010": ["E2E-050", "E2E-051", "E2E-052", "E2E-053", "E2E-054", "E2E-055"]
};
const p7RequiredE2e = {
  "P7-001": ["E2E-060", "E2E-063", "E2E-064"],
  "P7-002": ["E2E-060", "E2E-061", "E2E-062", "E2E-063"],
  "P7-003": ["E2E-061", "E2E-062"],
  "P7-004": ["E2E-061", "E2E-062", "E2E-063"],
  "P7-005": ["E2E-061", "E2E-062"],
  "P7-006": ["E2E-060", "E2E-063", "E2E-064"],
  "P7-007": ["E2E-060", "E2E-063", "E2E-064"],
  "P7-008": ["E2E-061", "E2E-062"],
  "P7-009": ["E2E-060", "E2E-061", "E2E-062", "E2E-063", "E2E-064"],
  "P7-010": ["E2E-060", "E2E-061", "E2E-062", "E2E-063", "E2E-064"]
};
const p8RequiredE2e = {
  "P8-001": ["E2E-070", "E2E-074", "E2E-075"],
  "P8-002": ["E2E-070", "E2E-074", "E2E-075"],
  "P8-003": ["E2E-071", "E2E-072", "E2E-073", "E2E-074", "E2E-075"],
  "P8-004": ["E2E-072", "E2E-073", "E2E-074"],
  "P8-005": ["E2E-070", "E2E-071", "E2E-073", "E2E-074", "E2E-075"],
  "P8-006": ["E2E-071", "E2E-075"],
  "P8-007": ["E2E-072", "E2E-075"],
  "P8-008": ["E2E-073", "E2E-074", "E2E-075"],
  "P8-009": ["E2E-070", "E2E-071", "E2E-072", "E2E-073", "E2E-074", "E2E-075"],
  "P8-010": ["E2E-070", "E2E-071", "E2E-072", "E2E-073", "E2E-074", "E2E-075"]
};
const p9RequiredE2e = {
  "P9-001": ["E2E-080"],
  "P9-002": ["E2E-080", "E2E-081"],
  "P9-003": ["E2E-081", "E2E-082"],
  "P9-004": ["E2E-082", "E2E-083"],
  "P9-005": ["E2E-082", "E2E-083"],
  "P9-006": ["E2E-082"],
  "P9-007": ["E2E-082"],
  "P9-008": ["E2E-083"],
  "P9-009": ["E2E-080", "E2E-081", "E2E-082", "E2E-083"],
  "P9-010": ["E2E-080", "E2E-081", "E2E-082", "E2E-083"]
};
const p10RequiredE2e = {
  "P10-001": ["E2E-090", "E2E-095"],
  "P10-002": ["E2E-090"],
  "P10-003": ["E2E-090", "E2E-095"],
  "P10-004": ["E2E-091"],
  "P10-005": ["E2E-092", "E2E-094"],
  "P10-006": ["E2E-093"],
  "P10-007": ["E2E-093", "E2E-094", "E2E-095"],
  "P10-008": ["E2E-090", "E2E-091", "E2E-092", "E2E-093", "E2E-094", "E2E-095"],
  "P10-009": ["E2E-090", "E2E-091", "E2E-092", "E2E-093", "E2E-094", "E2E-095"],
  "P10-010": ["E2E-090", "E2E-091", "E2E-092", "E2E-093", "E2E-094", "E2E-095"]
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
  "E2E-034": "e2e/tests/phase4/kanban-canonical-task.spec.ts",
  "E2E-040": "e2e/tests/phase5/open-gantt.spec.ts",
  "E2E-041": "e2e/tests/phase5/gantt-task-cross-view.spec.ts",
  "E2E-042": "e2e/tests/phase5/gantt-date-persist.spec.ts",
  "E2E-043": "e2e/tests/phase5/gantt-dependency.spec.ts",
  "E2E-044": "e2e/tests/phase5/baseline-stability.spec.ts",
  "E2E-050": "e2e/tests/phase6/resource-load.spec.ts",
  "E2E-051": "e2e/tests/phase6/overload-detection.spec.ts",
  "E2E-052": "e2e/tests/phase6/overload-resolution-entry.spec.ts",
  "E2E-053": "e2e/tests/phase6/resolution-dry-run.spec.ts",
  "E2E-054": "e2e/tests/phase6/resolution-apply-audit.spec.ts",
  "E2E-055": "e2e/tests/phase6/resource-resolution-permissions.spec.ts",
  "E2E-060": "e2e/tests/phase7/kpi-threshold.spec.ts",
  "E2E-061": "e2e/tests/phase7/kpi-control-signal.spec.ts",
  "E2E-062": "e2e/tests/phase7/kpi-traceability.spec.ts",
  "E2E-063": "e2e/tests/phase7/kpi-versioning.spec.ts",
  "E2E-064": "e2e/tests/phase7/kpi-permissions.spec.ts",
  "E2E-070": "e2e/tests/phase8/portfolio-to-gantt.spec.ts",
  "E2E-071": "e2e/tests/phase8/kpi-corrective-task.spec.ts",
  "E2E-072": "e2e/tests/phase8/resource-control-action.spec.ts",
  "E2E-073": "e2e/tests/phase8/accept-risk-audit.spec.ts",
  "E2E-074": "e2e/tests/phase8/action-permissions.spec.ts",
  "E2E-075": "e2e/tests/phase8/control-surface-refresh.spec.ts",
  "E2E-080": "e2e/tests/phase9/project-closure.spec.ts",
  "E2E-081": "e2e/tests/phase9/closed-snapshot-stability.spec.ts",
  "E2E-082": "e2e/tests/phase9/closed-portfolio-trends.spec.ts",
  "E2E-083": "e2e/tests/phase9/template-improvement-action.spec.ts",
  "E2E-090": "e2e/tests/phase10/labels-runtime.spec.ts",
  "E2E-091": "e2e/tests/phase10/custom-field-control-surface.spec.ts",
  "E2E-092": "e2e/tests/phase10/kpi-builder-effect.spec.ts",
  "E2E-093": "e2e/tests/phase10/control-surface-layout-builder.spec.ts",
  "E2E-094": "e2e/tests/phase10/config-validation.spec.ts",
  "E2E-095": "e2e/tests/phase10/config-regression.spec.ts"
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
  phase: "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9" | "P10",
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

function completeP5Overrides(checkedAt: string) {
  return Object.fromEntries(
    Object.entries(p5RequiredE2e).map(([id, requiredE2e]) => [
      id,
      {
        status: "verified",
        evidence: [`${id} verified`],
        tests: ["npm run test:e2e:phase -- --phase=5 exit 0"],
        blocker: null,
        e2e_evidence: requiredE2e.map((e2eId) => ({
          id: e2eId,
          command: "npm run test:e2e:phase -- --phase=5",
          test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
          exit_code: 0,
          status: "passed",
          checked_at: checkedAt
        }))
      }
    ])
  );
}

function completeP6Overrides(checkedAt: string) {
  return Object.fromEntries(
    Object.entries(p6RequiredE2e).map(([id, requiredE2e]) => [
      id,
      {
        status: "verified",
        evidence: [`${id} verified`],
        tests: ["npm run test:e2e:phase -- --phase=6 exit 0"],
        blocker: null,
        e2e_evidence: requiredE2e.map((e2eId) => ({
          id: e2eId,
          command: "npm run test:e2e:phase -- --phase=6",
          test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
          exit_code: 0,
          status: "passed",
          checked_at: checkedAt
        }))
      }
    ])
  );
}

function completeP7Overrides(checkedAt: string) {
  return Object.fromEntries(
    Object.entries(p7RequiredE2e).map(([id, requiredE2e]) => [
      id,
      {
        status: "verified",
        evidence: [`${id} verified`],
        tests: ["npm run test:e2e:phase -- --phase=7 exit 0"],
        blocker: null,
        e2e_evidence: requiredE2e.map((e2eId) => ({
          id: e2eId,
          command: "npm run test:e2e:phase -- --phase=7",
          test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
          exit_code: 0,
          status: "passed",
          checked_at: checkedAt
        }))
      }
    ])
  );
}

function completeP8Overrides(checkedAt: string) {
  return Object.fromEntries(
    Object.entries(p8RequiredE2e).map(([id, requiredE2e]) => [
      id,
      {
        status: "verified",
        evidence: [`${id} verified`],
        tests: ["npm run test:e2e:phase -- --phase=8 exit 0"],
        cleanup: `${id} cleanup verified by Phase 8 fixture reset, API/domain readback, audit/action readback, and reload persistence.`,
        blocker: null,
        e2e_evidence: requiredE2e.map((e2eId) => ({
          id: e2eId,
          command: "npm run test:e2e:phase -- --phase=8",
          test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
          exit_code: 0,
          status: "passed",
          checked_at: checkedAt
        }))
      }
    ])
  );
}

function completeP9Overrides(checkedAt: string) {
  return Object.fromEntries(
    Object.entries(p9RequiredE2e).map(([id, requiredE2e]) => [
      id,
      {
        status: "verified",
        evidence: [`${id} verified`],
        tests: ["npm run test:e2e:phase -- --phase=9 exit 0"],
        cleanup: `${id} cleanup verified by Phase 9 fixture reset, snapshot/readback stability, audit/action readback, and reload persistence.`,
        blocker: null,
        e2e_evidence: requiredE2e.map((e2eId) => ({
          id: e2eId,
          command: "npm run test:e2e:phase -- --phase=9",
          test_path: e2eTestPaths[e2eId as keyof typeof e2eTestPaths],
          exit_code: 0,
          status: "passed",
          checked_at: checkedAt
        }))
      }
    ])
  );
}

function completeP10Overrides(checkedAt: string) {
  return Object.fromEntries(
    Object.entries(p10RequiredE2e).map(([id, requiredE2e]) => [
      id,
      {
        status: "verified",
        evidence: [`${id} verified`],
        tests: ["npm run test:e2e:phase -- --phase=10 exit 0"],
        cleanup: `${id} cleanup verified by Phase 10 fixture reset, config-version readback, audit readback, runtime reload persistence, and export/import reset.`,
        blocker: null,
        e2e_evidence: requiredE2e.map((e2eId) => ({
          id: e2eId,
          command: "npm run test:e2e:phase -- --phase=10",
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
  mkdirSync(resolve(projectRoot, "docs/status"), { recursive: true });
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

  it("rejects verified rows whose literal owned scope path is missing", () => {
    const matrixPath = writeMatrixFixture("missing-owned-scope.json", {
      owned_scope: ["docs/phases/MISSING_PHASE.md"]
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P2C-001: owned_scope path missing: docs/phases/MISSING_PHASE.md");
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
    const projectRoot = resolve(fixtureDir, "missing-spec-p4-project-root");
    mkdirSync(projectRoot, { recursive: true });
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
      cwd: projectRoot,
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

  it("accepts the initial blocked P5 matrix only with allow-blocked", () => {
    const matrixPath = writePhaseMatrixFixture("P5", "blocked-p5-contract.json", p5RequiredE2e, {});

    const blockedResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("P5-001: blocked row requires --allow-blocked");
    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P5 rows whose required_e2e field does not match the phase contract", () => {
    const matrixPath = writePhaseMatrixFixture("P5", "wrong-p5-required-e2e.json", p5RequiredE2e, {
      "P5-008": {
        required_e2e: ["E2E-041"]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P5-008: required_e2e must exactly match phase contract");
  });

  it("rejects P5 structured E2E evidence that points to a non-ledger phase5 file", () => {
    const matrixPath = writePhaseMatrixFixture("P5", "wrong-p5-test-path.json", p5RequiredE2e, {
      "P5-007": {
        status: "verified",
        evidence: ["P5-007 verified"],
        tests: ["npm run test:e2e:phase -- --phase=5 exit 0"],
        blocker: null,
        e2e_evidence: [
          {
            id: "E2E-040",
            command: "npm run test:e2e:phase -- --phase=5",
            test_path: "e2e/tests/phase5/gantt.spec.ts",
            exit_code: 0,
            status: "passed",
            checked_at: "2026-05-15T16:35:00+07:00"
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
      "P5-007: E2E-040 E2E evidence test_path must match e2e/tests/phase5/open-gantt.spec.ts"
    );
  });

  it("rejects P5 matrices missing a required row", () => {
    const matrixPath = writePhaseMatrixFixture("P5", "missing-p5-row.json", p5RequiredE2e, {});
    const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
    matrix.rows = matrix.rows.filter((row: { id: string }) => row.id !== "P5-010");
    writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P5-010: missing required P5 row");
  });

  it("accepts a complete P5 matrix only when every row is verified with phase 5 structured E2E evidence", () => {
    const checkedAt = "2026-05-15T16:35:00+07:00";
    const projectRoot = resolve(fixtureDir, "complete-p5-project-root");
    writeRequiredE2eSpecFiles(projectRoot, Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-04")));
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p5-run-metadata.json", {
      phase: "5",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase5/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-04")),
      startedAt: "2026-05-15T09:30:00.000Z",
      finishedAt: "2026-05-15T09:35:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P5",
      "complete-p5-phase-exit.json",
      p5RequiredE2e,
      completeP5Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: projectRoot,
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("accepts the initial blocked P6 matrix only with allow-blocked", () => {
    const matrixPath = writePhaseMatrixFixture("P6", "blocked-p6-contract.json", p6RequiredE2e, {});

    const blockedResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("P6-001: blocked row requires --allow-blocked");
    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P6 rows whose required_e2e field does not match the phase contract", () => {
    const matrixPath = writePhaseMatrixFixture("P6", "wrong-p6-required-e2e.json", p6RequiredE2e, {
      "P6-006": {
        required_e2e: ["E2E-050"]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P6-006: required_e2e must exactly match phase contract");
  });

  it("rejects P6 structured E2E evidence that points to a non-ledger phase6 file", () => {
    const matrixPath = writePhaseMatrixFixture("P6", "wrong-p6-test-path.json", p6RequiredE2e, {
      "P6-010": {
        status: "verified",
        evidence: ["P6-010 verified"],
        tests: ["npm run test:e2e:phase -- --phase=6 exit 0"],
        blocker: null,
        e2e_evidence: [
          {
            id: "E2E-055",
            command: "npm run test:e2e:phase -- --phase=6",
            test_path: "e2e/tests/phase6/permissions.spec.ts",
            exit_code: 0,
            status: "passed",
            checked_at: "2026-05-16T15:05:00+07:00"
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
      "P6-010: E2E-055 E2E evidence test_path must match e2e/tests/phase6/resource-resolution-permissions.spec.ts"
    );
  });

  it("accepts a complete P6 matrix only when every row is verified with phase 6 structured E2E evidence", () => {
    const checkedAt = "2026-05-16T07:55:00.000Z";
    const projectRoot = resolve(fixtureDir, "complete-p6-project-root");
    writeRequiredE2eSpecFiles(projectRoot, Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-05")));
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p6-run-metadata.json", {
      phase: "6",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase6/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-05")),
      startedAt: "2026-05-16T07:56:00.000Z",
      finishedAt: "2026-05-16T07:58:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P6",
      "complete-p6-phase-exit.json",
      p6RequiredE2e,
      completeP6Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: projectRoot,
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("accepts the initial blocked P7 matrix only with allow-blocked", () => {
    const matrixPath = writePhaseMatrixFixture("P7", "blocked-p7-contract.json", p7RequiredE2e, {});

    const blockedResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("P7-001: blocked row requires --allow-blocked");
    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P7 rows whose required_e2e field does not match the phase contract", () => {
    const matrixPath = writePhaseMatrixFixture("P7", "wrong-p7-required-e2e.json", p7RequiredE2e, {
      "P7-008": {
        required_e2e: ["E2E-061"]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P7-008: required_e2e must exactly match phase contract");
  });

  it("rejects P7 structured E2E evidence that points to a non-ledger phase7 file", () => {
    const matrixPath = writePhaseMatrixFixture("P7", "wrong-p7-test-path.json", p7RequiredE2e, {
      "P7-010": {
        status: "verified",
        evidence: ["P7-010 verified"],
        tests: ["npm run test:e2e:phase -- --phase=7 exit 0"],
        blocker: null,
        e2e_evidence: [
          {
            id: "E2E-064",
            command: "npm run test:e2e:phase -- --phase=7",
            test_path: "e2e/tests/phase7/permissions.spec.ts",
            exit_code: 0,
            status: "passed",
            checked_at: "2026-05-16T12:10:00.000Z"
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
      "P7-010: E2E-064 E2E evidence test_path must match e2e/tests/phase7/kpi-permissions.spec.ts"
    );
  });

  it("accepts a complete P7 matrix only when every row is verified with phase 7 structured E2E evidence", () => {
    const checkedAt = "2026-05-16T07:55:00.000Z";
    const projectRoot = resolve(fixtureDir, "complete-p7-project-root");
    writeRequiredE2eSpecFiles(projectRoot, Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-06")));
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p7-run-metadata.json", {
      phase: "7",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase7/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-06")),
      startedAt: "2026-05-16T07:56:00.000Z",
      finishedAt: "2026-05-16T07:58:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P7",
      "complete-p7-phase-exit.json",
      p7RequiredE2e,
      completeP7Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: projectRoot,
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("accepts the initial blocked P8 matrix only with allow-blocked", () => {
    const matrixPath = writePhaseMatrixFixture("P8", "blocked-p8-contract.json", p8RequiredE2e, {});

    const blockedResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("P8-001: blocked row requires --allow-blocked");
    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P8 rows whose required_e2e field does not match the phase contract", () => {
    const matrixPath = writePhaseMatrixFixture("P8", "wrong-p8-required-e2e.json", p8RequiredE2e, {
      "P8-003": {
        required_e2e: ["E2E-071"]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P8-003: required_e2e must exactly match phase contract");
  });

  it("rejects P8 structured E2E evidence that points to a non-ledger phase8 file", () => {
    const matrixPath = writePhaseMatrixFixture("P8", "wrong-p8-test-path.json", p8RequiredE2e, {
      "P8-010": {
        status: "verified",
        evidence: ["P8-010 verified"],
        tests: ["npm run test:e2e:phase -- --phase=8 exit 0"],
        blocker: null,
        e2e_evidence: [
          {
            id: "E2E-075",
            command: "npm run test:e2e:phase -- --phase=8",
            test_path: "e2e/tests/phase8/refresh.spec.ts",
            exit_code: 0,
            status: "passed",
            checked_at: "2026-05-16T13:40:00.000Z"
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
      "P8-010: E2E-075 E2E evidence test_path must match e2e/tests/phase8/control-surface-refresh.spec.ts"
    );
  });

  it("rejects complete P8 rows that keep placeholder cleanup evidence", () => {
    const checkedAt = "2026-05-16T07:55:00.000Z";
    const matrixPath = writePhaseMatrixFixture("P8", "placeholder-p8-cleanup.json", p8RequiredE2e, {
      ...completeP8Overrides(checkedAt),
      "P8-002": {
        ...completeP8Overrides(checkedAt)["P8-002"],
        cleanup: "No runtime cleanup"
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P8-002: verified row cleanup evidence is still a placeholder");
  });

  it("accepts a complete P8 matrix only when every row is verified with phase 8 structured E2E evidence", () => {
    const checkedAt = "2026-05-16T07:55:00.000Z";
    const projectRoot = resolve(fixtureDir, "complete-p8-project-root");
    writeRequiredE2eSpecFiles(projectRoot, Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-07")));
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p8-run-metadata.json", {
      phase: "8",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase8/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-07")),
      startedAt: "2026-05-16T07:56:00.000Z",
      finishedAt: "2026-05-16T07:58:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P8",
      "complete-p8-phase-exit.json",
      p8RequiredE2e,
      completeP8Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: projectRoot,
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("accepts the initial blocked P9 matrix only with allow-blocked", () => {
    const matrixPath = writePhaseMatrixFixture("P9", "blocked-p9-contract.json", p9RequiredE2e, {});

    const blockedResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("P9-001: blocked row requires --allow-blocked");
    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P9 rows whose required_e2e field does not match the phase contract", () => {
    const matrixPath = writePhaseMatrixFixture("P9", "wrong-p9-required-e2e.json", p9RequiredE2e, {
      "P9-002": {
        required_e2e: ["E2E-080"]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P9-002: required_e2e must exactly match phase contract");
  });

  it("rejects P9 blocked rows with placeholder blocker text", () => {
    const matrixPath = writePhaseMatrixFixture("P9", "placeholder-p9-blocker.json", p9RequiredE2e, {
      "P9-001": {
        blocker: "TBD"
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P9-001: blocked row requires a fresh, specific blocker reason");
    expect(result.stderr).toContain("P9-001: blocked row has placeholder blocker text");
  });

  it("rejects P9 structured E2E evidence that points to a non-ledger phase9 file", () => {
    const matrixPath = writePhaseMatrixFixture("P9", "wrong-p9-test-path.json", p9RequiredE2e, {
      "P9-010": {
        status: "verified",
        evidence: ["P9-010 verified"],
        tests: ["npm run test:e2e:phase -- --phase=9 exit 0"],
        cleanup: "P9-010 cleanup verified by fixture reset, audit/readback, and reload persistence.",
        blocker: null,
        e2e_evidence: [
          {
            id: "E2E-083",
            command: "npm run test:e2e:phase -- --phase=9",
            test_path: "e2e/tests/phase9/improvement.spec.ts",
            exit_code: 0,
            status: "passed",
            checked_at: "2026-05-16T13:40:00.000Z"
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
      "P9-010: E2E-083 E2E evidence test_path must match e2e/tests/phase9/template-improvement-action.spec.ts"
    );
  });

  it("rejects complete P9 rows that keep placeholder cleanup evidence", () => {
    const checkedAt = "2026-05-16T13:55:00.000Z";
    const matrixPath = writePhaseMatrixFixture("P9", "placeholder-p9-cleanup.json", p9RequiredE2e, {
      ...completeP9Overrides(checkedAt),
      "P9-003": {
        ...completeP9Overrides(checkedAt)["P9-003"],
        cleanup: "No runtime cleanup"
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P9-003: verified row cleanup evidence is still a placeholder");
  });

  it("accepts a complete P9 matrix only when every row is verified with phase 9 structured E2E evidence", () => {
    const checkedAt = "2026-05-16T13:55:00.000Z";
    const projectRoot = resolve(fixtureDir, "complete-p9-project-root");
    writeRequiredE2eSpecFiles(projectRoot, Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-08")));
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p9-run-metadata.json", {
      phase: "9",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase9/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-08")),
      startedAt: "2026-05-16T13:56:00.000Z",
      finishedAt: "2026-05-16T13:58:00.000Z"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P9",
      "complete-p9-phase-exit.json",
      p9RequiredE2e,
      completeP9Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: projectRoot,
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });

  it("accepts the initial blocked P10 matrix only with allow-blocked", () => {
    const matrixPath = writePhaseMatrixFixture("P10", "blocked-p10-contract.json", p10RequiredE2e, {});

    const blockedResult = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });
    const trackingResult = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("P10-001: blocked row requires --allow-blocked");
    expect(trackingResult.status).toBe(0);
    expect(trackingResult.stdout).toContain("Requirements matrix verified");
  });

  it("rejects P10 rows whose required_e2e field does not match the phase contract", () => {
    const matrixPath = writePhaseMatrixFixture("P10", "wrong-p10-required-e2e.json", p10RequiredE2e, {
      "P10-008": {
        required_e2e: ["E2E-094"]
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P10-008: required_e2e must exactly match phase contract");
  });

  it("rejects P10 blocked rows with placeholder blocker text", () => {
    const matrixPath = writePhaseMatrixFixture("P10", "placeholder-p10-blocker.json", p10RequiredE2e, {
      "P10-001": {
        blocker: "TODO"
      }
    });

    const result = spawnSync(process.execPath, [scriptPath, "--allow-blocked", matrixPath], {
      cwd: resolve("."),
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P10-001: blocked row requires a fresh, specific blocker reason");
    expect(result.stderr).toContain("P10-001: blocked row has placeholder blocker text");
  });

  it("rejects P10 structured E2E evidence that points to a non-ledger phase10 file", () => {
    const matrixPath = writePhaseMatrixFixture("P10", "wrong-p10-test-path.json", p10RequiredE2e, {
      "P10-010": {
        status: "verified",
        evidence: ["P10-010 verified"],
        tests: ["npm run test:e2e:phase -- --phase=10 exit 0"],
        cleanup: "P10-010 cleanup verified by fixture reset, audit/readback, and reload persistence.",
        blocker: null,
        e2e_evidence: [
          {
            id: "E2E-093",
            command: "npm run test:e2e:phase -- --phase=10",
            test_path: "e2e/tests/phase10/layout.spec.ts",
            exit_code: 0,
            status: "passed",
            checked_at: "2026-05-17T02:10:00.000Z"
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
      "P10-010: E2E-093 E2E evidence test_path must match e2e/tests/phase10/control-surface-layout-builder.spec.ts"
    );
  });

  it("accepts a complete P10 matrix only when every row is verified with phase 10 structured E2E evidence", () => {
    const checkedAt = "2026-05-17T02:15:00.000+07:00";
    const projectRoot = resolve(fixtureDir, "complete-p10-project-root");
    writeRequiredE2eSpecFiles(projectRoot, Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-09")));
    const e2eRunMetadataPath = writeE2eRunMetadata("complete-p10-run-metadata.json", {
      phase: "10",
      testPaths: Object.values(e2eTestPaths).filter((testPath) => testPath.includes("/phase10/")),
      e2eIds: Object.keys(e2eTestPaths).filter((e2eId) => e2eId.startsWith("E2E-09")),
      startedAt: "2026-05-17T02:16:00.000+07:00",
      finishedAt: "2026-05-17T02:18:00.000+07:00"
    });
    const matrixPath = writePhaseMatrixFixture(
      "P10",
      "complete-p10-phase-exit.json",
      p10RequiredE2e,
      completeP10Overrides(checkedAt)
    );

    const result = spawnSync(process.execPath, [scriptPath, matrixPath], {
      cwd: projectRoot,
      env: { ...process.env, KISS_PM_E2E_RUN_METADATA_PATH: e2eRunMetadataPath },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Requirements matrix verified");
  });
});
