import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const checkerPath = fileURLToPath(new URL("./agent-bus-orchestration-check.mjs", import.meta.url));
const tempRoots = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "agent-bus-orchestration-"));
  tempRoots.push(root);
  return root;
}

function writeJson(root, relativePath, value) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

function validLedger(overrides = {}) {
  const now = new Date().toISOString();
  return {
    version: 1,
    run_id: "run-test",
    objective: "Verify Lead/Worker orchestration",
    status: "in_progress",
    timeout_policy: {
      heartbeat_timeout_minutes: 30
    },
    lead_agent: {
      id: "agent-a",
      role: "lead",
      heartbeat_at: now
    },
    worker_agent: {
      id: "agent-b",
      role: "worker",
      heartbeat_at: now
    },
    work_blocks: [
      {
        id: "block-1",
        title: "Worker implementation",
        owner_agent_id: "agent-b",
        status: "blocked",
        heartbeat_at: now,
        blocked: {
          reason: "Vitest cannot start because Rollup optional native package is missing.",
          evidence: {
            command: "npm test -- scripts/agent-bus-status.test.ts",
            exit_code: 1,
            summary: "Cannot find module @rollup/rollup-linux-x64-gnu"
          },
          action_taken_instead: "Lead ran node:test guard coverage and continued docs/process hardening."
        }
      },
      {
        id: "block-2",
        title: "Lead acceptance check",
        owner_agent_id: "agent-a",
        status: "verified",
        heartbeat_at: now,
        verification: {
          verified_by: "agent-a",
          verified_at: now,
          evidence: [
            {
              type: "command",
              command: "node scripts/agent-bus-status.mjs --check",
              exit_code: 0,
              summary: "No agent-bus consistency problems found."
            }
          ]
        }
      }
    ],
    gates: [
      {
        id: "gate-ledger-health",
        title: "Ledger is checkable",
        status: "verified",
        owner_agent_id: "agent-a",
        evidence: [
          {
            type: "command",
            command: "node scripts/agent-bus-orchestration-check.mjs --ledger <ledger>",
            exit_code: 0,
            summary: "Ledger health passed."
          }
        ]
      }
    ],
    final_verdict: {
      status: "pending",
      decided_by: null,
      decided_at: null,
      evidence: []
    },
    ...overrides
  };
}

function runChecker(ledgerPath, extraArgs = []) {
  return spawnSync("node", [checkerPath, "--ledger", ledgerPath, ...extraArgs], {
    encoding: "utf8"
  });
}

test.afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts a healthy active ledger with documented blocker evidence", () => {
  const root = createTempRoot();
  const ledgerPath = writeJson(root, "run.json", validLedger());

  const result = runChecker(ledgerPath);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /orchestration ledger ok/);
});

test("rejects blocked work without evidence and parallel action", () => {
  const root = createTempRoot();
  const ledger = validLedger();
  ledger.work_blocks[0].blocked = {
    reason: "Tests failed"
  };
  const ledgerPath = writeJson(root, "run.json", ledger);

  const result = runChecker(ledgerPath);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /blocked work block block-1 is missing evidence/);
  assert.match(result.stdout, /blocked work block block-1 is missing action_taken_instead/);
});

test("acceptance mode requires lead verdict and verified blocks", () => {
  const root = createTempRoot();
  const ledger = validLedger({
    status: "accepted",
    work_blocks: [
      {
        id: "block-1",
        title: "Worker implementation",
        owner_agent_id: "agent-b",
        status: "verified",
        heartbeat_at: new Date().toISOString(),
        verification: {
          verified_by: "agent-a",
          verified_at: new Date().toISOString(),
          evidence: [
            {
              type: "command",
              command: "npm run lint",
              exit_code: 0,
              summary: "Lint passed."
            }
          ]
        }
      }
    ],
    final_verdict: {
      status: "accepted",
      decided_by: "agent-a",
      decided_at: new Date().toISOString(),
      evidence: [
        {
          type: "command",
          command: "npm run lint",
          exit_code: 0,
          summary: "Lead verified lint."
        }
      ]
    }
  });
  const ledgerPath = writeJson(root, "run.json", ledger);

  const result = runChecker(ledgerPath, ["--acceptance"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /orchestration acceptance ok/);
});
