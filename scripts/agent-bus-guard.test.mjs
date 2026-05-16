import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const guardPath = fileURLToPath(new URL("./agent-bus-guard.mjs", import.meta.url));
const tempRoots = [];

function createTempRepo() {
  const root = mkdtempSync(join(tmpdir(), "agent-bus-guard-"));
  tempRoots.push(root);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}

function writeText(root, relativePath, text) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function writeJson(root, relativePath, value) {
  writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function commitAll(root) {
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=Agent Bus Test", "-c", "user.email=agent-bus@example.test", "commit", "-m", "baseline"], {
    cwd: root,
    stdio: "ignore"
  });
}

function writeBus(root) {
  const now = new Date().toISOString();
  writeJson(root, ".agent-bus/queue.json", {
    version: 1,
    policy: { default_stale_claim_hours: 4 },
    tasks: [
      {
        id: "P4-005-task-participants-assignment-roles",
        aliases: ["P4-005"],
        status: "active",
        depends_on: [],
        write_scope: ["docs/**"],
        forbidden: ["packages/**"],
        required_locks: ["docs/status/phase4-requirements-matrix.json"]
      }
    ]
  });
  writeJson(root, ".agent-bus/claims/p4-005.claim.json", {
    task_id: "P4-005",
    claimed_by: "codex-test",
    status: "active",
    heartbeat_at: now
  });
  writeJson(root, ".agent-bus/locks/docs-status.lock/owner.json", {
    task_id: "P4-005",
    agent: "codex-test",
    created_at: now,
    locked_paths: ["docs/status/phase4-requirements-matrix.json"]
  });
  writeText(root, ".agent-bus/state/CURRENT.md", "Name: Test\n");
  writeText(root, ".agent-bus/handoff/latest.md", "# Latest\n");
}

function runGuard(root) {
  return spawnSync("node", [guardPath, "--task", "P4-005", "--once"], {
    cwd: root,
    encoding: "utf8"
  });
}

test.afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

test("guard exits 0 and logs a pass event when the selected task is within bounds", () => {
  const root = createTempRepo();
  writeBus(root);
  writeText(root, "docs/status/phase4-requirements-matrix.json", "{}\n");
  commitAll(root);
  writeText(root, "docs/status/phase4-requirements-matrix.json", "{\"P4-005\":\"verified\"}\n");

  const result = runGuard(root);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /agent-bus guard ok/);
  const events = readFileSync(join(root, ".agent-bus/events/events.jsonl"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  assert.equal(events.at(-1).type, "agent-bus.guard.pass");
  assert.equal(events.at(-1).task_id, "P4-005");
});

test("guard exits 1 and logs a fail event when dirty files leave the task boundary", () => {
  const root = createTempRepo();
  writeBus(root);
  writeText(root, "packages/project-core/src/index.ts", "export const baseline = true;\n");
  commitAll(root);
  writeText(root, "packages/project-core/src/index.ts", "export const changed = true;\n");

  const result = runGuard(root);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /agent-bus guard failed/);
  assert.ok(existsSync(join(root, ".agent-bus/events/events.jsonl")));
  const events = readFileSync(join(root, ".agent-bus/events/events.jsonl"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  assert.equal(events.at(-1).type, "agent-bus.guard.fail");
  assert.match(events.at(-1).summary, /Dirty file is forbidden/);
});
