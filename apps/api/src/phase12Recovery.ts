export type Phase12RecoveryScenarioKey = "release-readiness-state";

export type Phase12RecoveryStateSnapshot = {
  marker: "seed" | "corrupted";
  usable: boolean;
  checksum: string;
};

export type Phase12RecoverySmokeRun = {
  id: string;
  tenantId: string;
  scenarioKey: Phase12RecoveryScenarioKey;
  status: "passed";
  startedAt: string;
  finishedAt: string;
  before: Phase12RecoveryStateSnapshot;
  simulatedFailure: Phase12RecoveryStateSnapshot;
  after: Phase12RecoveryStateSnapshot;
  auditEventId: string;
};

export type Phase12RecoverySmokeReadModel = {
  tenantId: string;
  status: "not_run" | "passed";
  policy: {
    mode: "deterministic_in_memory_smoke";
    productionBackupRequired: true;
    productionPolicyDoc: "docs/operations/PHASE_12_RECOVERY_BACKUP_POLICY.md";
  };
  latestRun: Phase12RecoverySmokeRun | null;
};

const baselineSnapshot: Phase12RecoveryStateSnapshot = {
  marker: "seed",
  usable: true,
  checksum: "phase12-recovery-seed-v1"
};

const corruptedSnapshot: Phase12RecoveryStateSnapshot = {
  marker: "corrupted",
  usable: false,
  checksum: "phase12-recovery-corrupted"
};

function cloneSnapshot(snapshot: Phase12RecoveryStateSnapshot): Phase12RecoveryStateSnapshot {
  return { ...snapshot };
}

function cloneRun(run: Phase12RecoverySmokeRun): Phase12RecoverySmokeRun {
  return {
    ...run,
    before: cloneSnapshot(run.before),
    simulatedFailure: cloneSnapshot(run.simulatedFailure),
    after: cloneSnapshot(run.after)
  };
}

export function createPhase12RecoveryRuntimeState() {
  const latestRuns = new Map<string, Phase12RecoverySmokeRun>();
  let runCounter = 0;

  function read(tenantId: string): Phase12RecoverySmokeReadModel {
    const latestRun = latestRuns.get(tenantId);
    return {
      tenantId,
      status: latestRun === undefined ? "not_run" : latestRun.status,
      policy: {
        mode: "deterministic_in_memory_smoke",
        productionBackupRequired: true,
        productionPolicyDoc: "docs/operations/PHASE_12_RECOVERY_BACKUP_POLICY.md"
      },
      latestRun: latestRun === undefined ? null : cloneRun(latestRun)
    };
  }

  function run(input: {
    tenantId: string;
    scenarioKey: Phase12RecoveryScenarioKey;
    now: string;
  }): Phase12RecoverySmokeRun {
    runCounter += 1;
    const runId = `p12-recovery-${input.tenantId}-${runCounter.toString().padStart(4, "0")}`;
    const run: Phase12RecoverySmokeRun = {
      id: runId,
      tenantId: input.tenantId,
      scenarioKey: input.scenarioKey,
      status: "passed",
      startedAt: input.now,
      finishedAt: input.now,
      before: cloneSnapshot(baselineSnapshot),
      simulatedFailure: cloneSnapshot(corruptedSnapshot),
      after: cloneSnapshot(baselineSnapshot),
      auditEventId: `audit-${runId}`
    };

    latestRuns.set(input.tenantId, cloneRun(run));
    return cloneRun(run);
  }

  return {
    read,
    run
  };
}
