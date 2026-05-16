import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve("scripts", "agent-bus-status.mjs");
const tempRoots: string[] = [];

function createTempRepo() {
  const root = mkdtempSync(join(tmpdir(), "agent-bus-status-"));
  tempRoots.push(root);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}

function writeText(root: string, relativePath: string, text: string) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function writeJson(root: string, relativePath: string, value: unknown) {
  writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function commitAll(root: string) {
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync(
    "git",
    ["-c", "user.name=Agent Bus Test", "-c", "user.email=agent-bus@example.test", "commit", "-m", "baseline"],
    { cwd: root, stdio: "ignore" }
  );
}

function writeBus(root: string, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  writeJson(root, ".agent-bus/queue.json", {
    version: 1,
    policy: {
      default_stale_claim_hours: 4
    },
    tasks: [
      {
        id: "P4-005-task-participants-assignment-roles",
        aliases: ["P4-005"],
        title: "Task participants and assignment roles",
        status: "active",
        depends_on: [],
        write_scope: ["docs/**"],
        forbidden: ["packages/**"],
        required_locks: ["docs/status/phase4-requirements-matrix.json"],
        ...overrides
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

function runStatus(root: string, args: string[] = []) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("agent-bus-status", () => {
  it("accepts task aliases and lock created_at timestamps", () => {
    const root = createTempRepo();
    writeBus(root);
    commitAll(root);

    const result = runStatus(root, ["--check", "--task", "P4-005"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Selected task P4-005-task-participants-assignment-roles");
    expect(result.stdout).toContain("No agent-bus consistency problems found.");
  });

  it("rejects dirty files outside the selected task boundary", () => {
    const root = createTempRepo();
    writeBus(root);
    writeText(root, "packages/project-core/src/index.ts", "export const baseline = true;\n");
    commitAll(root);
    writeText(root, "packages/project-core/src/index.ts", "export const changed = true;\n");

    const result = runStatus(root, ["--check", "--task", "P4-005"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Dirty file is forbidden for task P4-005");
  });

  it("allows dirty files inside the selected task boundary when required locks exist", () => {
    const root = createTempRepo();
    writeBus(root);
    writeText(root, "docs/status/phase4-requirements-matrix.json", "{}\n");
    commitAll(root);
    writeText(root, "docs/status/phase4-requirements-matrix.json", "{\"P4-005\":\"verified\"}\n");

    const result = runStatus(root, ["--check", "--task", "P4-005"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dirty files fit selected task boundaries.");
  });
});
